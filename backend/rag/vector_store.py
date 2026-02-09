"""FAISS 벡터 스토어 관리"""
import os
import logging
from langchain_community.vectorstores import FAISS
from rag.embeddings import get_embeddings
from rag.document_loader import load_knowledge_base
from rag.config import FAISS_INDEX_DIR

logger = logging.getLogger(__name__)

_vector_store: FAISS | None = None


def build_vector_store() -> FAISS:
    """지식베이스에서 FAISS 인덱스를 새로 빌드하고 디스크에 저장"""
    global _vector_store

    chunks = load_knowledge_base()
    if not chunks:
        raise ValueError("지식베이스에 문서가 없습니다. knowledge_base/ 디렉토리를 확인하세요.")

    logger.info(f"벡터 스토어 빌드 중... ({len(chunks)}개 청크)")

    embeddings = get_embeddings()
    store = FAISS.from_documents(chunks, embeddings)

    os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
    store.save_local(FAISS_INDEX_DIR)
    logger.info(f"벡터 스토어 저장 완료: {FAISS_INDEX_DIR}")

    _vector_store = store
    return store


def get_vector_store() -> FAISS:
    """벡터 스토어 인스턴스 반환 (lazy loading)"""
    global _vector_store

    if _vector_store is not None:
        return _vector_store

    index_path = os.path.join(FAISS_INDEX_DIR, "index.faiss")
    if os.path.exists(index_path):
        logger.info("디스크에서 FAISS 인덱스 로드 중...")
        embeddings = get_embeddings()
        _vector_store = FAISS.load_local(
            FAISS_INDEX_DIR,
            embeddings,
            allow_dangerous_deserialization=True,
        )
        return _vector_store

    return build_vector_store()
