"""웹 검색 도구 (DuckDuckGo)."""

from __future__ import annotations

import logging

from agent.tool import BaseTool
from agent.types import ToolResult

logger = logging.getLogger(__name__)


class WebSearchTool(BaseTool):
    """DuckDuckGo 웹 검색으로 외부 정보를 찾는 도구.

    내부 문서에서 답을 찾지 못했을 때 폴백으로 사용한다.
    """

    name = "web_search"
    description = (
        "웹에서 정보를 검색합니다. "
        "회사 내부 문서에 없는 일반 지식, 최신 뉴스, 외부 정보가 필요할 때 사용하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "검색할 질문 또는 키워드",
            },
        },
        "required": ["query"],
    }

    async def execute(self, *, query: str = "", **_) -> ToolResult:
        from ddgs import DDGS

        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, region="kr-kr", max_results=5))
        except Exception as e:
            logger.warning(f"웹 검색 실패: {e}")
            return ToolResult(content="웹 검색에 실패했습니다.")

        if not results:
            return ToolResult(content="검색 결과가 없습니다.")

        parts = []
        for i, r in enumerate(results, 1):
            title = r.get("title", "")
            body = r.get("body", "")
            parts.append(f"[{i}] {title}\n{body}")

        return ToolResult(
            content="\n\n".join(parts),
            metadata={"result_count": len(results)},
        )
