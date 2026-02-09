"""문서 로딩 및 청킹 (Supabase DB 기반)"""
import io
import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rag.config import get_settings

logger = logging.getLogger(__name__)


def extract_text_from_pdf(content: bytes) -> str:
    """PDF 바이트에서 텍스트 추출"""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def extract_text_from_docx(content: bytes) -> str:
    """DOCX 바이트에서 텍스트 추출"""
    from docx import Document
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def extract_text(content: bytes, filename: str) -> str:
    """파일 확장자에 따라 텍스트 추출"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        return extract_text_from_pdf(content)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(content)
    else:
        # txt, md 등 텍스트 파일
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            return content.decode("euc-kr", errors="replace")


def chunk_text(content: str, filename: str) -> list[dict]:
    """텍스트를 청크로 분할하여 반환"""
    settings = get_settings()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings["chunk_size"],
        chunk_overlap=settings["chunk_overlap"],
        separators=["\n\n", "\n", ".", "!", "?", ";", ":", " ", ""],
    )

    chunks = splitter.split_text(content)
    return [
        {"content": chunk, "metadata": {"source": filename}}
        for chunk in chunks
    ]
