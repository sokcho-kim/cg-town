"""키워드 즉시 응답 도구 (LLM 호출 없이 패턴 매칭)."""

from __future__ import annotations

import json
import re

from agent.tool import BaseTool
from agent.types import ToolResult


# 패턴 → 응답 매핑
_PATTERNS: list[tuple[re.Pattern, dict]] = [
    (
        re.compile(r"와이파이|wifi|wi-fi|와이파이\s*비번|와이파이\s*비밀번호", re.IGNORECASE),
        {
            "answer": "와이파이 QR코드입니다! 카메라로 스캔해주세요 📱",
            "image": "/images/wifi-qr.png",
        },
    ),
]


class KeywordTool(BaseTool):
    """키워드 패턴 매칭으로 즉시 답변하는 도구.

    와이파이 비밀번호 등 자주 묻는 간단한 질문에 LLM 없이 바로 응답.
    """

    name = "keyword_lookup"
    description = (
        "자주 묻는 간단한 질문(와이파이 비밀번호, QR코드 등)에 즉시 답변합니다. "
        "사용자가 와이파이, WiFi, 비밀번호 등을 물어볼 때 사용하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "사용자의 원래 질문",
            },
        },
        "required": ["question"],
    }

    async def execute(self, *, question: str = "", **_) -> ToolResult:
        for pattern, response in _PATTERNS:
            if pattern.search(question):
                return ToolResult(
                    content=json.dumps(response, ensure_ascii=False),
                    metadata={"matched": True},
                )
        return ToolResult(content="해당하는 키워드 응답이 없습니다.", metadata={"matched": False})
