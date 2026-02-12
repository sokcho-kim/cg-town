"""Agent — 도구 사용 기반 LLM 에이전트 오케스트레이터."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Any

from agent.types import Message, ToolCall, StreamEvent, LLMResponse
from agent.tool import BaseTool
from agent.llm.base import BaseLLM

logger = logging.getLogger(__name__)

# 도구 호출 무한 루프 방지
_MAX_TOOL_ROUNDS = 5


class Agent:
    """도구(Tool)들을 장착한 LLM 에이전트.

    동작 흐름:
      1. 유저 질문 + 시스템 프롬프트 → LLM
      2. LLM이 tool_call 을 반환하면 해당 도구 실행 → 결과를 메시지에 추가 → 다시 LLM
      3. LLM이 텍스트 응답을 반환하면 최종 답변으로 반환
    """

    def __init__(
        self,
        llm: BaseLLM,
        tools: list[BaseTool],
        system_prompt: str,
    ):
        self.llm = llm
        self.tools: dict[str, BaseTool] = {t.name: t for t in tools}
        self.system_prompt = system_prompt

    # ------------------------------------------------------------------
    # 동기(전체 응답)
    # ------------------------------------------------------------------

    async def run(
        self,
        question: str,
        history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """질문에 대해 최종 답변을 dict 로 반환.

        Returns:
            {"answer": str, "route": str, "sources": list|None, "tool_calls": list}
        """
        messages = self._build_messages(question, history)
        tool_specs = [t.get_spec() for t in self.tools.values()]
        executed_tools: list[str] = []

        for _ in range(_MAX_TOOL_ROUNDS):
            response: LLMResponse = await self.llm.chat(messages, tools=tool_specs)

            if not response.has_tool_calls:
                return {
                    "answer": response.content or "",
                    "route": executed_tools[-1] if executed_tools else "llm",
                    "tool_calls": executed_tools,
                }

            # 도구 실행
            for tc in response.tool_calls:
                result = await self._execute_tool(tc)
                executed_tools.append(tc.name)

                # assistant 메시지(tool_call 포함)는 LLM 프로바이더가 내부적으로
                # 처리하므로, 여기선 tool 결과 메시지만 추가
                messages.append(Message(
                    role="tool",
                    content=result,
                    tool_call_id=tc.id,
                    name=tc.name,
                ))

            # tool_calls 가 있었던 assistant 메시지도 히스토리에 추가
            messages.append(Message(
                role="assistant",
                content=response.content or "",
            ))

        # 최대 라운드 초과
        logger.warning("도구 호출 최대 라운드 초과")
        return {
            "answer": "죄송합니다, 처리 중 문제가 발생했습니다.",
            "route": "error",
            "tool_calls": executed_tools,
        }

    # ------------------------------------------------------------------
    # 스트리밍
    # ------------------------------------------------------------------

    async def run_stream(
        self,
        question: str,
        history: list[dict[str, str]] | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        """질문에 대해 StreamEvent 를 yield.

        도구 호출 → 실행 → 최종 응답 스트리밍 순서로 진행.
        """
        messages = self._build_messages(question, history)
        tool_specs = [t.get_spec() for t in self.tools.values()]
        executed_tools: list[str] = []
        need_final_stream = True

        for _ in range(_MAX_TOOL_ROUNDS):
            response: LLMResponse = await self.llm.chat(messages, tools=tool_specs)

            if not response.has_tool_calls:
                # 도구를 한 번도 호출하지 않았고 LLM이 바로 응답한 경우
                # → 이미 받은 텍스트를 그대로 yield (이중 LLM 호출 방지)
                if not executed_tools and response.content:
                    need_final_stream = False
                break

            # 도구 실행 단계
            for tc in response.tool_calls:
                result = await self._execute_tool(tc)
                executed_tools.append(tc.name)
                messages.append(Message(
                    role="tool",
                    content=result,
                    tool_call_id=tc.id,
                    name=tc.name,
                ))

            messages.append(Message(
                role="assistant",
                content=response.content or "",
            ))
        else:
            yield StreamEvent(type="error", data="도구 호출 최대 라운드 초과")
            return

        # 라우트 정보
        route = executed_tools[-1] if executed_tools else "llm"
        yield StreamEvent(type="route_info", data=route)

        if need_final_stream:
            # 도구 실행 후 최종 응답을 스트리밍으로 생성
            async for token in self.llm.chat_stream(messages):
                yield StreamEvent(type="token", data=token)
        else:
            # 도구 없이 직접 응답한 경우 — 이미 받은 텍스트를 한 번에 yield
            yield StreamEvent(type="token", data=response.content)

        yield StreamEvent(type="done")

    # ------------------------------------------------------------------
    # 내부 헬퍼
    # ------------------------------------------------------------------

    def _build_messages(
        self,
        question: str,
        history: list[dict[str, str]] | None,
    ) -> list[Message]:
        """시스템 프롬프트 + 히스토리 + 유저 질문 조립."""
        msgs = [Message(role="system", content=self.system_prompt)]
        for h in (history or [])[-4:]:
            role = "user" if h["role"] == "user" else "assistant"
            msgs.append(Message(role=role, content=h["content"]))
        msgs.append(Message(role="user", content=question))
        return msgs

    async def _execute_tool(self, tc: ToolCall) -> str:
        """ToolCall 을 실행하고 결과 문자열을 반환."""
        tool = self.tools.get(tc.name)
        if not tool:
            logger.warning(f"알 수 없는 도구: {tc.name}")
            return f"Error: unknown tool '{tc.name}'"

        try:
            logger.info(f"도구 실행: {tc.name}({tc.arguments})")
            result = await tool.execute(**tc.arguments)
            logger.info(f"도구 결과: {tc.name} → {result.content[:100]}...")
            return result.content
        except Exception as e:
            logger.error(f"도구 실행 실패: {tc.name} — {e}")
            return f"Error executing {tc.name}: {e}"
