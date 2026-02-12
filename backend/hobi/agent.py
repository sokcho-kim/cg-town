"""호비 에이전트 조립 — 도구 + LLM + 프롬프트를 결합."""

from __future__ import annotations

import logging

from agent import Agent
from agent.llm import get_llm
from rag.config import OPENAI_API_KEY, get_settings
from hobi.prompts import SYSTEM_PROMPT
from hobi.tools import KeywordTool, DBQueryTool, RAGSearchTool, WebSearchTool

logger = logging.getLogger(__name__)

# 싱글턴 캐시
_cached_agent: Agent | None = None
_cached_model: str | None = None


def get_hobi_agent() -> Agent:
    """호비 에이전트 인스턴스를 반환 (모델 변경 시 자동 재생성)."""
    global _cached_agent, _cached_model
    settings = get_settings()
    model = settings["chat_model"]

    if _cached_agent is None or _cached_model != model:
        # LLM 프로바이더 결정
        provider = _detect_provider(model)
        llm = get_llm(
            provider=provider,
            model=model,
            temperature=settings["chat_temperature"],
            api_key=OPENAI_API_KEY,
        )

        # 도구 등록
        tools = [
            KeywordTool(),
            DBQueryTool(),
            RAGSearchTool(),
            WebSearchTool(),
        ]

        # 시스템 프롬프트 (settings.json 에 커스텀이 있으면 그걸 사용)
        system_prompt = settings.get("system_prompt") or SYSTEM_PROMPT

        _cached_agent = Agent(llm=llm, tools=tools, system_prompt=system_prompt)
        _cached_model = model
        logger.info(f"호비 에이전트 생성: provider={provider}, model={model}")

    return _cached_agent


def _detect_provider(model: str) -> str:
    """모델 이름으로 LLM 프로바이더를 추론."""
    model_lower = model.lower()
    if "gpt" in model_lower or "o1" in model_lower or "o3" in model_lower:
        return "openai"
    elif "gemini" in model_lower:
        return "gemini"
    elif "claude" in model_lower:
        return "claude"
    # 기본값은 OpenAI
    return "openai"


def reset_agent():
    """에이전트 캐시를 초기화 (설정 변경 후 호출)."""
    global _cached_agent, _cached_model
    _cached_agent = None
    _cached_model = None
