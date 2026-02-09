"""LangChain RAG 체인 구성 (pgvector)"""
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from rag.config import OPENAI_API_KEY, get_settings
from rag.vector_store import search_similar


def format_docs(docs: list[dict]) -> str:
    """검색된 문서들을 문자열로 포맷"""
    parts = []
    for doc in docs:
        metadata = doc.get("metadata", {})
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        source = metadata.get("source", "알 수 없음")
        parts.append(f"[출처: {source}]\n{doc['content']}")
    return "\n\n---\n\n".join(parts)


async def query_rag(question: str) -> dict:
    """RAG 파이프라인으로 질문에 답변 (pgvector 검색)"""
    settings = get_settings()

    # pgvector 유사도 검색
    retrieved_docs = search_similar(
        query=question,
        k=settings["retrieval_k"],
    )

    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=settings["chat_temperature"],
        openai_api_key=OPENAI_API_KEY,
    )

    system_prompt = settings["system_prompt"] + "\n\n컨텍스트:\n{context}"
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{question}"),
    ])

    context = format_docs(retrieved_docs)
    messages = prompt.format_messages(context=context, question=question)
    response = llm.invoke(messages)

    result = {"answer": response.content}

    if settings.get("show_sources", True):
        result["sources"] = []
        for doc in retrieved_docs:
            metadata = doc.get("metadata", {})
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            result["sources"].append({
                "source": metadata.get("source", ""),
                "content": doc["content"][:200],
            })

    return result
