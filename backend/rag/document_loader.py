"""마크다운 문서 로딩 및 청킹"""
import os
import glob
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from rag.config import KNOWLEDGE_BASE_DIR, get_settings


def load_knowledge_base() -> list[Document]:
    """knowledge_base/ 디렉토리의 모든 .md 파일을 로드하고 청크로 분할"""
    settings = get_settings()
    documents = []

    md_files = glob.glob(os.path.join(KNOWLEDGE_BASE_DIR, "*.md"))

    for file_path in md_files:
        loader = TextLoader(file_path, encoding="utf-8")
        docs = loader.load()
        for doc in docs:
            doc.metadata["source"] = os.path.basename(file_path)
        documents.extend(docs)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings["chunk_size"],
        chunk_overlap=settings["chunk_overlap"],
        separators=["\n\n", "\n", ".", " ", ""],
    )

    chunks = splitter.split_documents(documents)
    return chunks
