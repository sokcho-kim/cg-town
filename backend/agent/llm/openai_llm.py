"""OpenAI LLM 프로바이더 (function calling 지원)."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from agent.types import Message, ToolSpec, LLMResponse, ToolCall
from agent.llm.base import BaseLLM

logger = logging.getLogger(__name__)


class OpenAILLM(BaseLLM):
    """OpenAI Chat Completion API 기반 LLM."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        temperature: float = 0.3,
        api_key: str | None = None,
    ):
        self.model = model
        self.temperature = temperature
        self.client = AsyncOpenAI(api_key=api_key)

    # ------------------------------------------------------------------
    # 메시지 변환
    # ------------------------------------------------------------------

    @staticmethod
    def _to_openai_messages(messages: list[Message]) -> list[dict]:
        """내부 Message → OpenAI API 형식 변환."""
        out = []
        for m in messages:
            msg: dict = {"role": m.role, "content": m.content or ""}
            if m.role == "tool":
                msg["tool_call_id"] = m.tool_call_id or ""
                if m.name:
                    msg["name"] = m.name
            out.append(msg)
        return out

    @staticmethod
    def _to_openai_tools(tools: list[ToolSpec]) -> list[dict]:
        """ToolSpec → OpenAI tools 형식 변환."""
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in tools
        ]

    # ------------------------------------------------------------------
    # chat (동기)
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
    ) -> LLMResponse:
        kwargs: dict = {
            "model": self.model,
            "temperature": self.temperature,
            "messages": self._to_openai_messages(messages),
        }
        if tools:
            kwargs["tools"] = self._to_openai_tools(tools)

        resp = await self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0]

        tool_calls: list[ToolCall] = []
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, TypeError):
                    args = {}
                tool_calls.append(ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=args,
                ))

        return LLMResponse(
            content=choice.message.content,
            tool_calls=tool_calls,
        )

    # ------------------------------------------------------------------
    # chat_stream (토큰 스트리밍)
    # ------------------------------------------------------------------

    async def chat_stream(
        self,
        messages: list[Message],
    ) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            messages=self._to_openai_messages(messages),
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content
