"""문서 로딩 및 청킹 (Supabase DB 기반)"""
import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rag.config import get_settings

logger = logging.getLogger(__name__)


def chunk_text(content: str, filename: str) -> list[dict]:
    """텍스트를 청크로 분할하여 반환"""
    settings = get_settings()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings["chunk_size"],
        chunk_overlap=settings["chunk_overlap"],
        separators=["\n\n", "\n", ".", " ", ""],
    )

    chunks = splitter.split_text(content)
    return [
        {"content": chunk, "metadata": {"source": filename}}
        for chunk in chunks
    ]
