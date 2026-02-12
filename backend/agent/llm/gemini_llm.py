"""Google Gemini LLM 프로바이더 (stub — 추후 구현)."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from agent.types import Message, ToolSpec, LLMResponse
from agent.llm.base import BaseLLM


class GeminiLLM(BaseLLM):
    """Google Gemini API 기반 LLM. (미구현 스텁)"""

    def __init__(self, model: str = "gemini-pro", api_key: str | None = None, **kwargs):
        self.model = model
        self.api_key = api_key

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
    ) -> LLMResponse:
        raise NotImplementedError("GeminiLLM은 아직 구현되지 않았습니다.")

    async def chat_stream(
        self,
        messages: list[Message],
    ) -> AsyncGenerator[str, None]:
        raise NotImplementedError("GeminiLLM은 아직 구현되지 않았습니다.")
        yield  # make it a generator  # noqa: E501
