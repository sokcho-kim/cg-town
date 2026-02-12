"""에이전트 코어 타입 정의."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class Message:
    """대화 메시지."""
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    tool_call_id: str | None = None
    name: str | None = None  # tool name (role=="tool" 일 때)


@dataclass
class ToolSpec:
    """LLM에 전달할 도구 스키마 (OpenAI function-calling 형식 기준)."""
    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=lambda: {
        "type": "object",
        "properties": {},
    })


@dataclass
class ToolCall:
    """LLM이 요청한 도구 호출."""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ToolResult:
    """도구 실행 결과."""
    content: str
    metadata: dict[str, Any] | None = None


@dataclass
class LLMResponse:
    """LLM 응답 (텍스트 또는 도구 호출)."""
    content: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0


@dataclass
class StreamEvent:
    """SSE 스트리밍 이벤트."""
    type: Literal["token", "sources", "tag_result", "route_info", "done", "error"]
    data: Any = None
