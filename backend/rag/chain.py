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


def _build_rag_messages(question: str, retrieved_docs: list[dict], settings: dict, history: list[dict] | None = None):
    """RAG 프롬프트 메시지 구성 (대화 맥락 포함)"""
    context = format_docs(retrieved_docs)
    system_prompt = settings["system_prompt"] + """

컨텍스트에 답이 없으면 자연스럽게 모른다고 말하되, 대화 맥락에서 답할 수 있는 질문은 상식적으로 답변하세요.

컨텍스트:
""" + context

    msgs: list[tuple[str, str]] = [("system", system_prompt)]
    # 대화 히스토리 (최대 4턴)
    for h in (history or [])[-4:]:
        role = "human" if h["role"] == "user" else "assistant"
        msgs.append((role, h["content"]))
    msgs.append(("human", question))

    return ChatPromptTemplate.from_messages(msgs).format_messages()


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


async def query_rag(question: str, history: list[dict] | None = None, docs: list[dict] | None = None) -> dict:
    """RAG 파이프라인으로 질문에 답변 (동기, 전체 응답)"""
    settings = get_settings()

    retrieved_docs = docs if docs is not None else search_similar(query=question, k=settings["retrieval_k"])

    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=settings["chat_temperature"],
        openai_api_key=OPENAI_API_KEY,
    )

    messages = _build_rag_messages(question, retrieved_docs, settings, history)
    response = llm.invoke(messages)

    return {
        "answer": response.content,
        "sources": _build_sources(retrieved_docs, settings),
    }


async def query_rag_stream(question: str, history: list[dict] | None = None, docs: list[dict] | None = None) -> AsyncGenerator[dict, None]:
    """RAG 파이프라인 스트리밍 응답 (SSE용)"""
    settings = get_settings()

    retrieved_docs = docs if docs is not None else search_similar(query=question, k=settings["retrieval_k"])

    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=settings["chat_temperature"],
        openai_api_key=OPENAI_API_KEY,
        streaming=True,
    )

    messages = _build_rag_messages(question, retrieved_docs, settings, history)

    # 소스 먼저 전송
    sources = _build_sources(retrieved_docs, settings)
    yield {"type": "sources", "sources": sources}

    # 토큰 스트리밍
    async for chunk in llm.astream(messages):
        if chunk.content:
            yield {"type": "token", "content": chunk.content}

    yield {"type": "done"}
