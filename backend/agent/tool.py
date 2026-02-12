"""BaseTool — 에이전트 도구 플러그인 베이스 클래스."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from agent.types import ToolSpec, ToolResult


class BaseTool(ABC):
    """모든 에이전트 도구가 상속하는 추상 베이스 클래스.

    구현 시 ``name``, ``description``, ``parameters`` 를 정의하고
    ``execute()`` 를 구현한다.
    """

    # 서브클래스에서 반드시 설정
    name: str = ""
    description: str = ""
    parameters: dict[str, Any] = {
        "type": "object",
        "properties": {},
    }

    def get_spec(self) -> ToolSpec:
        """LLM에 전달할 ToolSpec 을 반환."""
        return ToolSpec(
            name=self.name,
            description=self.description,
            parameters=self.parameters,
        )

    @abstractmethod
    async def execute(self, **kwargs: Any) -> ToolResult:
        """도구를 실행하고 ToolResult 를 반환한다.

        kwargs 는 LLM이 생성한 arguments dict 가 언패킹되어 전달된다.
        """
        ...
