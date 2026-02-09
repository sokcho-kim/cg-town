"""pgvector 벡터 스토어 관리 (Supabase)"""
import json
import logging
from lib.supabase import get_supabase_admin
from rag.embeddings import get_embeddings
from rag.document_loader import chunk_text

logger = logging.getLogger(__name__)


def embed_and_store_document(document_id: str, filename: str, content: str) -> int:
    """문서를 청크로 분할하고, 임베딩 생성 후 DB에 저장. 청크 수 반환."""
    supabase = get_supabase_admin()
    embeddings = get_embeddings()

    # 기존 청크 삭제
    supabase.table("knowledge_chunks").delete().eq("document_id", document_id).execute()

    # 청크 분할
    chunks = chunk_text(content, filename)
    if not chunks:
        return 0

    # 임베딩 생성 (배치)
    texts = [c["content"] for c in chunks]
    vectors = embeddings.embed_documents(texts)

    # DB 저장
    rows = [
        {
            "document_id": document_id,
            "content": chunk["content"],
            "metadata": json.dumps(chunk["metadata"], ensure_ascii=False),
            "embedding": vector,
        }
        for chunk, vector in zip(chunks, vectors)
    ]

    # 배치 삽입 (100개씩)
    for i in range(0, len(rows), 100):
        batch = rows[i : i + 100]
        supabase.table("knowledge_chunks").insert(batch).execute()

    logger.info(f"'{filename}' 임베딩 완료: {len(rows)}개 청크")
    return len(rows)


def rebuild_all_embeddings() -> int:
    """모든 문서의 임베딩을 재빌드. 총 청크 수 반환."""
    supabase = get_supabase_admin()

    docs = supabase.table("knowledge_documents").select("id, filename, content").execute()
    if not docs.data:
        logger.warning("지식베이스에 문서가 없습니다.")
        return 0

    total = 0
    for doc in docs.data:
        count = embed_and_store_document(doc["id"], doc["filename"], doc["content"])
        total += count

    logger.info(f"전체 재빌드 완료: {total}개 청크")
    return total


def search_similar(query: str, k: int = 3, threshold: float = 0.3) -> list[dict]:
    """쿼리와 유사한 청크 검색 (pgvector)"""
    supabase = get_supabase_admin()
    embeddings = get_embeddings()

    query_vector = embeddings.embed_query(query)

    result = supabase.rpc("match_knowledge_chunks", {
        "query_embedding": query_vector,
        "match_threshold": threshold,
        "match_count": k,
    }).execute()

    return result.data or []


def get_total_chunks() -> int:
    """전체 청크 수 반환"""
    supabase = get_supabase_admin()
    result = supabase.table("knowledge_chunks").select("id", count="exact").execute()
    return result.count or 0
