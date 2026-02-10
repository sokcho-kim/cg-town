"""웹 검색 → LLM 요약 (DuckDuckGo + GPT)"""
import logging
from ddgs import DDGS
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from rag.config import OPENAI_API_KEY, get_settings

logger = logging.getLogger(__name__)

ANSWER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """당신은 CG Inside 회사의 온보딩 도우미 NPC '호비'입니다.
아래 웹 검색 결과를 참고하여 사용자 질문에 친절하게 답변하세요.
검색 결과가 부족하면 솔직히 잘 모르겠다고 말하세요.
답변은 간결하게, 핵심만 전달하세요."""),
    ("human", "질문: {question}\n\n웹 검색 결과:\n{search_results}"),
])


async def query_web(question: str) -> dict:
    """DuckDuckGo 검색 후 LLM으로 요약"""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(question, region="kr-kr", max_results=5))
    except Exception as e:
        logger.warning(f"웹 검색 실패: {e}")
        return {"answer": "웹 검색에 실패했습니다. 잠시 후 다시 시도해 주세요."}

    if not results:
        return {"answer": "검색 결과가 없습니다."}

    # 검색 결과 포맷
    search_text = ""
    for i, r in enumerate(results, 1):
        title = r.get("title", "")
        body = r.get("body", "")
        search_text += f"[{i}] {title}\n{body}\n\n"

    # LLM으로 요약
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=settings["chat_temperature"],
        openai_api_key=OPENAI_API_KEY,
    )

    try:
        messages = ANSWER_PROMPT.format_messages(
            question=question,
            search_results=search_text,
        )
        response = llm.invoke(messages)
        return {"answer": response.content}
    except Exception as e:
        logger.warning(f"웹 검색 요약 실패: {e}")
        return {"answer": "검색은 했지만 요약에 실패했습니다."}
