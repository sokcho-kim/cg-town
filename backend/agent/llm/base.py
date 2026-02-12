"""BaseLLM — LLM 프로바이더 추상 베이스 클래스."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from agent.types import Message, ToolSpec, LLMResponse


class BaseLLM(ABC):
    """모든 LLM 프로바이더가 구현하는 인터페이스."""

    @abstractmethod
    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
    ) -> LLMResponse:
        """메시지에 대해 응답(텍스트 or 도구 호출)을 반환."""
        ...

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[Message],
    ) -> AsyncGenerator[str, None]:
        """텍스트 응답을 토큰 단위로 스트리밍.

        도구 호출이 필요 없는 최종 응답 단계에서 사용한다.
        """
        ...
