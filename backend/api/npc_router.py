"""NPC 채팅 API 엔드포인트"""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.deps import get_current_user
from rag.router import classify_and_route
from rag.vector_store import build_vector_store, get_vector_store
from rag.document_loader import load_knowledge_base
from rag.config import get_settings, save_settings, KNOWLEDGE_BASE_DIR

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


# ===== 채팅 =====


@router.post("/chat", response_model=ChatResponse)
async def npc_chat(body: ChatRequest, current_user=Depends(get_current_user)):
    """NPC에게 질문하기"""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")

    result = await classify_and_route(body.message)

    return ChatResponse(
        answer=result["answer"],
        route=result.get("route", "rag"),
        intent=result.get("intent", "unknown"),
        sources=result.get("sources"),
    )


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


# ===== 문서 관리 =====


@router.get("/documents")
async def list_documents(current_user=Depends(get_current_user)):
    """지식베이스 문서 목록 조회"""
    chunks = load_knowledge_base()

    files: dict[str, int] = {}
    for chunk in chunks:
        source = chunk.metadata.get("source", "unknown")
        files[source] = files.get(source, 0) + 1

    return {
        "total_chunks": len(chunks),
        "files": [
            {"filename": name, "chunk_count": count}
            for name, count in sorted(files.items())
        ],
    }


@router.get("/documents/{filename}")
async def get_document(filename: str, current_user=Depends(get_current_user)):
    """문서 내용 조회"""
    file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
    if not os.path.exists(file_path) or not filename.endswith(".md"):
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    return {"filename": filename, "content": content}


@router.post("/documents")
async def create_document(body: DocumentRequest, current_user=Depends(get_current_user)):
    """새 문서 추가"""
    filename = body.title if body.title.endswith(".md") else f"{body.title}.md"
    file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)

    if os.path.exists(file_path):
        raise HTTPException(status_code=409, detail="같은 이름의 문서가 이미 존재합니다.")

    os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(body.content)

    return {"filename": filename, "message": "문서가 생성되었습니다."}


@router.put("/documents/{filename}")
async def update_document(filename: str, body: DocumentRequest, current_user=Depends(get_current_user)):
    """문서 수정"""
    file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
    if not os.path.exists(file_path) or not filename.endswith(".md"):
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(body.content)

    return {"filename": filename, "message": "문서가 수정되었습니다."}


@router.delete("/documents/{filename}")
async def delete_document(filename: str, current_user=Depends(get_current_user)):
    """문서 삭제"""
    file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
    if not os.path.exists(file_path) or not filename.endswith(".md"):
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    os.remove(file_path)
    return {"filename": filename, "message": "문서가 삭제되었습니다."}


# ===== 인덱스 =====


@router.post("/rebuild-index")
async def rebuild_index(current_user=Depends(get_current_user)):
    """지식베이스 인덱스 재빌드"""
    store = build_vector_store()
    doc_count = len(store.docstore._dict)
    return {"message": f"인덱스 재빌드 완료 ({doc_count}개 청크)"}


@router.get("/health")
async def npc_health():
    """NPC 시스템 상태 확인"""
    try:
        store = get_vector_store()
        doc_count = len(store.docstore._dict)
        return {
            "status": "healthy",
            "vector_store": "loaded",
            "document_count": doc_count,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }
