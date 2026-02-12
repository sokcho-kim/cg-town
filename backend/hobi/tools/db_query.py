"""데이터베이스 조회 도구 (직원 프로필 + 식단 메뉴)."""

from __future__ import annotations

import json
import logging

from agent.tool import BaseTool
from agent.types import ToolResult

logger = logging.getLogger(__name__)


class DBQueryTool(BaseTool):
    """CG Inside 직원 정보 및 식단 메뉴를 DB에서 조회하는 도구.

    내부적으로 기존 rag.db_query 모듈을 호출한다.
    """

    name = "db_query"
    description = (
        "CG Inside 직원 정보(이름, 부서, 직급) 또는 식단 메뉴를 데이터베이스에서 조회합니다. "
        "직원 검색, 인원수 확인, 오늘/내일 점심 메뉴 등에 사용하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "table": {
                "type": "string",
                "enum": ["profiles", "cafeteria_menus"],
                "description": "조회할 테이블. 직원 정보는 profiles, 식단은 cafeteria_menus",
            },
            "filters": {
                "type": "object",
                "description": "검색 조건. profiles: {position, department, username}. cafeteria_menus: {day: '월'~'금' 또는 '내일'/'모레'}",
                "properties": {
                    "position": {"type": "string", "description": "직급 (CEO, CTO, 팀장, 대리, 사원, 소장, 부소장, 연구원, 이사)"},
                    "department": {"type": "string", "description": "부서 (AI, 경영, 기획, 서비스개발, 연구소)"},
                    "username": {"type": "string", "description": "직원 이름"},
                    "day": {"type": "string", "description": "요일 (월/화/수/목/금/내일/모레)"},
                },
            },
        },
        "required": ["table"],
    }

    async def execute(self, *, table: str = "", filters: dict | None = None, **_) -> ToolResult:
        from rag.db_query import query_db

        filters = filters or {}
        try:
            result = await query_db(table, filters)
            return ToolResult(
                content=result.get("answer", "조회 결과가 없습니다."),
                metadata={"table": table, "filters": filters},
            )
        except Exception as e:
            logger.error(f"DB 조회 실패: {e}")
            return ToolResult(content=f"DB 조회 중 오류가 발생했습니다: {e}")
