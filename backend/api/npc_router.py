"""NPC 채팅 API 엔드포인트 (pgvector + 하이브리드 검색 + SSE 스트리밍)"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.deps import get_current_user
from lib.supabase import get_supabase_admin
from rag.router import classify_and_route, classify_and_route_stream
from rag.vector_store import embed_and_store_document, rebuild_all_embeddings, get_total_chunks
from rag.config import get_settings, save_settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".md", ".txt", ".pdf", ".docx", ".doc"}

router = APIRouter(prefix="/api/npc")


# ===== Pydantic 모델 =====


class ChatRequest(BaseModel):
    message: str
    npc_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    route: str
    intent: str
    sources: list[dict] | None = None


class DocumentRequest(BaseModel):
    title: str
    content: str


class SettingsRequest(BaseModel):
    system_prompt: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    embedding_model: str | None = None
    chat_model: str | None = None
    chat_temperature: float | None = None
    retrieval_k: int | None = None
    show_sources: bool | None = None


# ===== 대화 히스토리 헬퍼 =====

HISTORY_LIMIT = 20  # DB에서 가져올 최근 메시지 수


def _fetch_history(user_id: str) -> list[dict]:
    """DB에서 유저의 최근 대화 히스토리 조회"""
    try:
        supabase = get_supabase_admin()
        result = (
            supabase.table("npc_chat_messages")
            .select("role, content")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(HISTORY_LIMIT)
            .execute()
        )
        # 역순으로 뒤집어서 시간순 정렬
        return list(reversed(result.data)) if result.data else []
    except Exception as e:
        logger.warning(f"대화 히스토리 조회 실패: {e}")
        return []


def _save_message(user_id: str, role: str, content: str):
    """DB에 메시지 저장"""
    try:
        supabase = get_supabase_admin()
        supabase.table("npc_chat_messages").insert({
            "user_id": user_id,
            "role": role,
            "content": content,
        }).execute()
    except Exception as e:
        logger.warning(f"메시지 저장 실패: {e}")


# ===== 채팅 =====


@router.post("/chat", response_model=ChatResponse)
async def npc_chat(body: ChatRequest, current_user=Depends(get_current_user)):
    """NPC에게 질문하기"""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")

    user_id = current_user.id
    history = _fetch_history(user_id)

    # 유저 메시지 저장
    _save_message(user_id, "user", body.message)

    result = await classify_and_route(body.message, history=history)

    # 어시스턴트 응답 저장
    _save_message(user_id, "assistant", result["answer"])

    return ChatResponse(
        answer=result["answer"],
        route=result.get("route", "rag"),
        intent=result.get("intent", "unknown"),
        sources=result.get("sources"),
    )


@router.post("/chat/stream")
async def npc_chat_stream(body: ChatRequest, current_user=Depends(get_current_user)):
    """NPC에게 질문하기 (SSE 스트리밍)"""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")

    user_id = current_user.id
    history = _fetch_history(user_id)

    # 유저 메시지 저장
    _save_message(user_id, "user", body.message)

    full_answer_parts: list[str] = []

    async def event_generator():
        async for event in classify_and_route_stream(body.message, history=history):
            # 응답 토큰 수집 (저장용)
            if event.get("type") == "token" and event.get("content"):
                full_answer_parts.append(event["content"])
            elif event.get("type") == "tag_result" and event.get("data", {}).get("answer"):
                full_answer_parts.append(event["data"]["answer"])

            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        # 스트리밍 완료 후 어시스턴트 응답 DB 저장
        full_answer = "".join(full_answer_parts)
        if full_answer:
            _save_message(user_id, "assistant", full_answer)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/chat/history")
async def clear_chat_history(current_user=Depends(get_current_user)):
    """대화 히스토리 초기화"""
    supabase = get_supabase_admin()
    supabase.table("npc_chat_messages").delete().eq("user_id", current_user.id).execute()
    return {"message": "대화 히스토리가 초기화되었습니다."}


# ===== 설정 =====


@router.get("/settings")
async def get_npc_settings(current_user=Depends(get_current_user)):
    """현재 RAG 설정 조회"""
    return get_settings()


@router.put("/settings")
async def update_npc_settings(body: SettingsRequest, current_user=Depends(get_current_user)):
    """RAG 설정 변경"""
    current = get_settings()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    current.update(updates)
    save_settings(current)
    return current


# ===== 문서 관리 (Supabase DB) =====


@router.get("/documents")
async def list_documents(current_user=Depends(get_current_user)):
    """지식베이스 문서 목록 조회"""
    supabase = get_supabase_admin()

    docs = supabase.table("knowledge_documents").select("id, filename").execute()

    files = []
    for doc in docs.data or []:
        chunk_result = (
            supabase.table("knowledge_chunks")
            .select("id", count="exact")
            .eq("document_id", doc["id"])
            .execute()
        )
        files.append({
            "filename": doc["filename"],
            "chunk_count": chunk_result.count or 0,
        })

    total = get_total_chunks()
    return {"total_chunks": total, "files": files}


@router.get("/documents/{filename}")
async def get_document(filename: str, current_user=Depends(get_current_user)):
    """문서 내용 조회"""
    supabase = get_supabase_admin()

    result = (
        supabase.table("knowledge_documents")
        .select("filename, content")
        .eq("filename", filename)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    return {"filename": result.data["filename"], "content": result.data["content"]}


@router.post("/documents")
async def create_document(body: DocumentRequest, current_user=Depends(get_current_user)):
    """새 문서 추가 (텍스트 입력)"""
    supabase = get_supabase_admin()
    filename = body.title if body.title.endswith((".md", ".txt")) else f"{body.title}.md"

    # 중복 체크
    existing = (
        supabase.table("knowledge_documents")
        .select("id")
        .eq("filename", filename)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="같은 이름의 문서가 이미 존재합니다.")

    # 문서 저장
    result = (
        supabase.table("knowledge_documents")
        .insert({"filename": filename, "content": body.content})
        .execute()
    )
    doc_id = result.data[0]["id"]

    # 임베딩 생성 + 저장
    chunk_count = embed_and_store_document(doc_id, filename, body.content)

    return {
        "filename": filename,
        "message": f"문서가 생성되었습니다. ({chunk_count}개 청크)",
        "auto_rebuilt": True,
    }


@router.put("/documents/{filename}")
async def update_document(filename: str, body: DocumentRequest, current_user=Depends(get_current_user)):
    """문서 수정"""
    supabase = get_supabase_admin()

    existing = (
        supabase.table("knowledge_documents")
        .select("id")
        .eq("filename", filename)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    doc_id = existing.data["id"]

    # 문서 내용 업데이트
    supabase.table("knowledge_documents").update({"content": body.content}).eq("id", doc_id).execute()

    # 임베딩 재생성
    chunk_count = embed_and_store_document(doc_id, filename, body.content)

    return {
        "filename": filename,
        "message": f"문서가 수정되었습니다. ({chunk_count}개 청크)",
        "auto_rebuilt": True,
    }


@router.delete("/documents/{filename}")
async def delete_document(filename: str, current_user=Depends(get_current_user)):
    """문서 삭제 (연결된 청크도 cascade 삭제)"""
    supabase = get_supabase_admin()

    existing = (
        supabase.table("knowledge_documents")
        .select("id")
        .eq("filename", filename)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    supabase.table("knowledge_documents").delete().eq("filename", filename).execute()

    total = get_total_chunks()
    return {
        "filename": filename,
        "message": f"문서가 삭제되었습니다. (남은 청크: {total}개)",
        "auto_rebuilt": True,
    }


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    """파일 업로드로 문서 추가 (.md, .txt, .pdf, .docx)"""
    import os
    from rag.document_loader import extract_text

    if not file.filename:
        raise HTTPException(status_code=400, detail="파일 이름이 없습니다.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)}만 가능)",
        )

    content = await file.read()

    # 50MB 제한
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기가 50MB를 초과합니다.")

    try:
        text = extract_text(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일 처리 실패: {e}")

    supabase = get_supabase_admin()

    # 기존 문서 있으면 업데이트, 없으면 생성
    existing = (
        supabase.table("knowledge_documents")
        .select("id")
        .eq("filename", file.filename)
        .execute()
    )

    if existing.data:
        doc_id = existing.data[0]["id"]
        supabase.table("knowledge_documents").update({"content": text}).eq("id", doc_id).execute()
    else:
        result = (
            supabase.table("knowledge_documents")
            .insert({"filename": file.filename, "content": text})
            .execute()
        )
        doc_id = result.data[0]["id"]

    chunk_count = embed_and_store_document(doc_id, file.filename, text)

    return {
        "filename": file.filename,
        "message": f"'{file.filename}' 업로드 완료 ({chunk_count}개 청크)",
        "auto_rebuilt": True,
    }


# ===== 인덱스 =====


@router.post("/rebuild-index")
async def rebuild_index(current_user=Depends(get_current_user)):
    """전체 임베딩 재빌드"""
    total = rebuild_all_embeddings()
    return {"message": f"인덱스 재빌드 완료 ({total}개 청크)"}


@router.get("/health")
async def npc_health():
    """NPC 시스템 상태 확인"""
    try:
        total = get_total_chunks()
        return {
            "status": "healthy",
            "vector_store": "pgvector",
            "document_count": total,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }
