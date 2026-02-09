"""LangChain RAG 체인 구성"""
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from rag.config import OPENAI_API_KEY, get_settings
from rag.vector_store import get_vector_store


def format_docs(docs) -> str:
    """검색된 문서들을 문자열로 포맷"""
    return "\n\n---\n\n".join(
        f"[출처: {doc.metadata.get('source', '알 수 없음')}]\n{doc.page_content}"
        for doc in docs
    )


async def query_rag(question: str) -> dict:
    """RAG 파이프라인으로 질문에 답변"""
    settings = get_settings()

    vector_store = get_vector_store()
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": settings["retrieval_k"]},
    )

    retrieved_docs = retriever.invoke(question)

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
        result["sources"] = [
            {
                "source": doc.metadata.get("source", ""),
                "content": doc.page_content[:200],
            }
            for doc in retrieved_docs
        ]

    return result
