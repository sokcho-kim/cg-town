"""질문 의도 분류 (TAG vs RAG 라우팅)"""
import json
import logging
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from rag.config import OPENAI_API_KEY, get_settings
from rag.tag_queries import TAG_QUERY_MAP
from rag.chain import query_rag, query_rag_stream

logger = logging.getLogger(__name__)

CLASSIFIER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """당신은 질문을 분류하는 시스템입니다.
사용자의 질문을 분석하여 아래 카테고리 중 하나로 분류하세요.

카테고리:
- "employee_count": 직원 수, 몇 명인지 묻는 질문
- "department_count": 부서별 인원, 부서 구성 관련 질문
- "employees_by_department": 특정 부서 직원 목록 (부서명 추출 필요)
- "npc_list": NPC 목록 관련 질문
- "cafeteria_menu": 식당 메뉴, 오늘 점심, 식단표, 밥 뭐 나오는지 관련 질문
- "rag": 위 카테고리에 해당하지 않는 모든 질문 (회사 소개, 복리후생, 업무 프로세스, 입사 가이드 등)

JSON 형식으로만 응답하세요:
{{"intent": "카테고리명", "params": {{"department": "부서명(있을 경우)"}}}}
"""),
    ("human", "{question}"),
])


async def classify_and_route(question: str) -> dict:
    """질문을 분류하고 적절한 파이프라인으로 라우팅"""
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=0,
        openai_api_key=OPENAI_API_KEY,
    )

    try:
        messages = CLASSIFIER_PROMPT.format_messages(question=question)
        response = llm.invoke(messages)
        classification = json.loads(response.content)
        intent = classification.get("intent", "rag")
        params = classification.get("params", {})
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"의도 분류 실패, RAG로 폴백: {e}")
        intent = "rag"
        params = {}

    logger.info(f"질문: '{question}' → 의도: {intent}, 파라미터: {params}")

    # TAG 경로
    if intent in TAG_QUERY_MAP:
        tag_func = TAG_QUERY_MAP[intent]
        if intent == "employees_by_department" and params.get("department"):
            result = await tag_func(params["department"])
        else:
            result = await tag_func()
        result["route"] = "tag"
        result["intent"] = intent
        return result

    # RAG 경로 (기본)
    result = await query_rag(question)
    result["route"] = "rag"
    result["intent"] = intent
    return result


async def classify_intent(question: str) -> tuple[str, dict]:
    """의도만 분류하여 반환 (스트리밍용)"""
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=0,
        openai_api_key=OPENAI_API_KEY,
    )

    try:
        messages = CLASSIFIER_PROMPT.format_messages(question=question)
        response = llm.invoke(messages)
        classification = json.loads(response.content)
        return classification.get("intent", "rag"), classification.get("params", {})
    except Exception as e:
        logger.warning(f"의도 분류 실패, RAG로 폴백: {e}")
        return "rag", {}


async def classify_and_route_stream(question: str):
    """스트리밍 라우팅: TAG는 즉시 반환, RAG는 스트리밍"""
    intent, params = await classify_intent(question)

    # TAG 경로 (스트리밍 불필요, 즉시 반환)
    if intent in TAG_QUERY_MAP:
        tag_func = TAG_QUERY_MAP[intent]
        if intent == "employees_by_department" and params.get("department"):
            result = await tag_func(params["department"])
        else:
            result = await tag_func()
        result["route"] = "tag"
        result["intent"] = intent
        yield {"type": "tag_result", "data": result}
        return

    # RAG 경로 (스트리밍)
    yield {"type": "route_info", "route": "rag", "intent": intent}
    async for event in query_rag_stream(question):
        yield event
