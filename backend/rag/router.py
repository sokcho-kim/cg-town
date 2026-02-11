"""질문 의도 분류 (DB / RAG / Web 3단 라우팅)"""
import json
import logging
import re
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from rag.config import OPENAI_API_KEY, get_settings
from rag.db_query import query_db
from rag.chain import query_rag, query_rag_stream
from rag.web_search import query_web
from rag.vector_store import search_similar

logger = logging.getLogger(__name__)

# ── 키워드 프리체크 (LLM 호출 없이 즉시 응답) ──

_WIFI_PATTERN = re.compile(r"와이파이|wifi|wi-fi|와이파이\s*비번|와이파이\s*비밀번호", re.IGNORECASE)

def _keyword_precheck(question: str) -> dict | None:
    """키워드 매칭으로 즉시 응답할 수 있는 질문 감지"""
    if _WIFI_PATTERN.search(question):
        return {
            "answer": "와이파이 QR코드입니다! 카메라로 스캔해주세요 📱",
            "image": "/images/wifi-qr.png",
            "route": "keyword",
        }
    return None


CLASSIFIER_SYSTEM = """당신은 질문을 분류하는 시스템입니다.
사용자의 질문을 분석하여 "db" 또는 "rag" 중 하나로 분류하세요.
이전 대화 맥락이 있으면 참고하세요.

"db" — 아래 테이블에서 조회할 수 있는 질문:
  - profiles 테이블: 직원 이름(username), 부서(department), 직급(position), 분야(field)
    부서: AI, 경영, 기획, 서비스개발, 연구소
    직급: CEO, CTO, 대리, 부소장, 사원, 소장, 연구원, 이사, 팀장
    예: "팀장 누구야?", "몇 명이야?", "서비스개발팀 누구 있어?", "대표(=CEO) 누구야?", "전병훈이 뭐하는 사람이야?", "AI팀에 사원 누구?"
    ※ "대표"→"CEO", "개발팀"→"서비스개발" 등 사용자 표현을 DB 값으로 변환하세요
  - cafeteria_menus 테이블: 식당 메뉴, 점심, 식단표
    예: "오늘 점심 뭐야?", "내일 메뉴는?"

"rag" — 위 DB에 해당하지 않는 모든 질문 (회사 문서, 일반 질문 등)

중요: 특정 사람 이름이 언급되면 무조건 "db"로 분류하세요.

JSON 형식으로만 응답:
{{"intent": "db 또는 rag", "table": "profiles 또는 cafeteria_menus(db일 때)", "filters": {{"position": "값", "department": "값", "username": "값", "day": "월/화/수/목/금/내일/모레"}}}}
filters에는 질문에서 추출한 조건만 넣으세요. 사용자 표현을 DB 값으로 변환해서 넣으세요. 없으면 빈 객체 {{}}."""


def _build_classifier_messages(question: str, history: list[dict] | None = None) -> list:
    """분류기용 메시지 구성 (대화 맥락 포함)"""
    msgs = [("system", CLASSIFIER_SYSTEM)]
    for h in (history or [])[-4:]:
        role = "human" if h["role"] == "user" else "assistant"
        msgs.append((role, h["content"]))
    msgs.append(("human", question))
    return ChatPromptTemplate.from_messages(msgs).format_messages()


async def _classify(question: str, history: list[dict] | None = None) -> dict:
    """질문 분류 → {"intent": "db|rag", "table": ..., "filters": {...}}"""
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings["chat_model"],
        temperature=0,
        openai_api_key=OPENAI_API_KEY,
    )
    try:
        messages = _build_classifier_messages(question, history)
        response = llm.invoke(messages)
        result = json.loads(response.content)
        logger.info(f"질문: '{question}' → 분류: {result}")
        return result
    except Exception as e:
        logger.warning(f"의도 분류 실패, RAG로 폴백: {e}")
        return {"intent": "rag"}


_RAG_SIMILARITY_THRESHOLD = 0.35


async def classify_and_route(question: str, history: list[dict] | None = None) -> dict:
    """질문을 분류하고 적절한 파이프라인으로 라우팅 (DB → RAG → Web 폴백)"""
    pre = _keyword_precheck(question)
    if pre:
        return pre

    c = await _classify(question, history)
    intent = c.get("intent", "rag")

    if intent == "db":
        result = await query_db(c.get("table", ""), c.get("filters", {}))
        result["route"] = "db"
        return result

    # RAG: 문서 유사도 확인 후, 낮으면 웹 검색으로 폴백
    try:
        settings = get_settings()
        docs = search_similar(question, k=settings["retrieval_k"])
        best_score = max((d.get("similarity", 0) for d in docs), default=0)

        if docs and best_score >= _RAG_SIMILARITY_THRESHOLD:
            result = await query_rag(question, history=history, docs=docs)
            result["route"] = "rag"
            return result

        logger.info(f"RAG 유사도 낮음 (best={best_score:.3f}), 웹 검색 폴백")
    except Exception as e:
        logger.warning(f"RAG 검색 실패, 웹 검색 폴백: {e}")

    try:
        result = await query_web(question)
        result["route"] = "web"
        return result
    except Exception as e:
        logger.warning(f"웹 검색도 실패: {e}")
        return {"answer": "죄송합니다, 지금은 답변을 찾을 수 없어요. 잠시 후 다시 시도해 주세요.", "route": "error"}


async def classify_and_route_stream(question: str, history: list[dict] | None = None):
    """스트리밍 라우팅: DB → RAG → Web 폴백 체인"""
    pre = _keyword_precheck(question)
    if pre:
        yield {"type": "tag_result", "data": pre}
        return

    c = await _classify(question, history)
    intent = c.get("intent", "rag")

    if intent == "db":
        result = await query_db(c.get("table", ""), c.get("filters", {}))
        result["route"] = "db"
        yield {"type": "tag_result", "data": result}
        return

    # RAG: 문서 유사도 확인 후, 낮으면 웹 검색으로 폴백
    try:
        settings = get_settings()
        docs = search_similar(question, k=settings["retrieval_k"])
        best_score = max((d.get("similarity", 0) for d in docs), default=0)

        if docs and best_score >= _RAG_SIMILARITY_THRESHOLD:
            yield {"type": "route_info", "route": "rag"}
            async for event in query_rag_stream(question, history=history, docs=docs):
                yield event
            return

        logger.info(f"RAG 유사도 낮음 (best={best_score:.3f}), 웹 검색 폴백")
    except Exception as e:
        logger.warning(f"RAG 검색 실패, 웹 검색 폴백: {e}")

    try:
        result = await query_web(question)
        result["route"] = "web"
        yield {"type": "tag_result", "data": result}
    except Exception as e:
        logger.warning(f"웹 검색도 실패: {e}")
        yield {"type": "tag_result", "data": {"answer": "죄송합니다, 지금은 답변을 찾을 수 없어요. 잠시 후 다시 시도해 주세요.", "route": "error"}}
