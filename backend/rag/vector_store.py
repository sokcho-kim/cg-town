"""pgvector 벡터 스토어 관리 (Supabase)"""
import json
import logging
from lib.supabase import get_supabase_admin
from rag.embeddings import get_embeddings
from rag.document_loader import chunk_text

logger = logging.getLogger(__name__)


def embed_and_store_document(document_id: str, filename: str, content: str) -> int:
    """문서를 청크로 분할하고, 임베딩 생성 후 DB에 저장. 청크 수 반환.

    안전 전략: 새 임베딩을 먼저 생성한 뒤, 성공 시에만 기존 청크를 삭제하고 교체.
    임베딩 생성 실패 시 기존 데이터가 보존된다.
    """
    supabase = get_supabase_admin()
    embeddings = get_embeddings()

    # 청크 분할
    chunks = chunk_text(content, filename)
    if not chunks:
        # 내용이 비었으면 기존 청크만 삭제
        supabase.table("knowledge_chunks").delete().eq("document_id", document_id).execute()
        return 0

    # 임베딩 생성 (실패하면 기존 청크 보존)
    texts = [c["content"] for c in chunks]
    try:
        vectors = embeddings.embed_documents(texts)
    except Exception as e:
        logger.error(f"'{filename}' 임베딩 생성 실패 — 기존 청크 보존: {e}")
        raise

    if len(vectors) != len(chunks):
        logger.error(f"'{filename}' 임베딩 수 불일치: chunks={len(chunks)}, vectors={len(vectors)}")
        raise ValueError(f"임베딩 수 불일치: {len(chunks)} != {len(vectors)}")

    rows = [
        {
            "document_id": document_id,
            "content": chunk["content"],
            "metadata": json.dumps(chunk["metadata"], ensure_ascii=False),
            "embedding": vector,
        }
        for chunk, vector in zip(chunks, vectors)
    ]

    # 새 임베딩 생성 성공 → 기존 청크 삭제 후 교체
    supabase.table("knowledge_chunks").delete().eq("document_id", document_id).execute()

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


def search_similar(query: str, k: int = 3) -> list[dict]:
    """하이브리드 검색: 벡터(pgvector) + 키워드(tsvector) → RRF 병합"""
    supabase = get_supabase_admin()
    embeddings = get_embeddings()

    query_vector = embeddings.embed_query(query)

    # 하이브리드 검색 시도, 실패 시 벡터 전용 폴백
    try:
        result = supabase.rpc("match_knowledge_hybrid", {
            "query_embedding": query_vector,
            "query_text": query,
            "match_count": k,
        }).execute()
    except Exception as e:
        logger.warning(f"하이브리드 검색 실패, 벡터 검색으로 폴백: {e}")
        result = supabase.rpc("match_knowledge_chunks", {
            "query_embedding": query_vector,
            "match_threshold": 0.3,
            "match_count": k,
        }).execute()

    docs = result.data or []
    for doc in docs:
        st = doc.get("search_type", "vector")
        logger.info(f"  [{st}] score={doc.get('similarity', 0):.4f} - {doc['content'][:50]}...")
    return docs


def get_total_chunks() -> int:
    """전체 청크 수 반환"""
    supabase = get_supabase_admin()
    result = supabase.table("knowledge_chunks").select("id", count="exact").execute()
    return result.count or 0
