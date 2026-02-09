"""LangChain RAG 체인 구성 (pgvector + 하이브리드 검색)"""
import json
from collections.abc import AsyncGenerator
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from rag.config import OPENAI_API_KEY, get_settings
from rag.vector_store import search_similar


def _parse_metadata(doc: dict) -> dict:
    metadata = doc.get("metadata", {})
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
    return metadata


def format_docs(docs: list[dict]) -> str:
    """검색된 문서들을 문자열로 포맷"""
    parts = []
    for doc in docs:
        metadata = _parse_metadata(doc)
        source = metadata.get("source", "알 수 없음")
        parts.append(f"[출처: {source}]\n{doc['content']}")
    return "\n\n---\n\n".join(parts)


def _build_rag_messages(question: str, retrieved_docs: list[dict], settings: dict):
    """RAG 프롬프트 메시지 구성"""
    system_prompt = settings["system_prompt"] + "\n\n컨텍스트:\n{context}"
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{question}"),
    ])
    context = format_docs(retrieved_docs)
    return prompt.format_messages(context=context, question=question)


def _build_sources(retrieved_docs: list[dict], settings: dict) -> list[dict] | None:
    """출처 정보 구성"""
    if not settings.get("show_sources", True):
        return None
    return [
        {
            "source": _parse_metadata(doc).get("source", ""),
            "content": doc["content"][:200],
        }
        for doc in retrieved_docs
    ]


async def query_rag(question: str) -> dict:
    """RAG 파이프라인으로 질문에 답변 (동기, 전체 응답)"""
    settings = get_settings()

    retrieved_docs = search_similar(query=question, k=settings["retrieval_k"])

    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=settings["chat_temperature"],
        openai_api_key=OPENAI_API_KEY,
    )

    messages = _build_rag_messages(question, retrieved_docs, settings)
    response = llm.invoke(messages)

    return {
        "answer": response.content,
        "sources": _build_sources(retrieved_docs, settings),
    }


async def query_rag_stream(question: str) -> AsyncGenerator[dict, None]:
    """RAG 파이프라인 스트리밍 응답 (SSE용)"""
    settings = get_settings()

    retrieved_docs = search_similar(query=question, k=settings["retrieval_k"])

    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=settings["chat_temperature"],
        openai_api_key=OPENAI_API_KEY,
        streaming=True,
    )

    messages = _build_rag_messages(question, retrieved_docs, settings)

    # 소스 먼저 전송
    sources = _build_sources(retrieved_docs, settings)
    yield {"type": "sources", "sources": sources}

    # 토큰 스트리밍
    async for chunk in llm.astream(messages):
        if chunk.content:
            yield {"type": "token", "content": chunk.content}

    yield {"type": "done"}
