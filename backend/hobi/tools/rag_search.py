"""RAG 문서 검색 도구 (pgvector 하이브리드 검색)."""

from __future__ import annotations

import json
import logging

from agent.tool import BaseTool
from agent.types import ToolResult

logger = logging.getLogger(__name__)


class RAGSearchTool(BaseTool):
    """회사 내부 문서(지식베이스)를 벡터 검색하는 도구.

    내부적으로 기존 rag.vector_store + rag.chain 모듈을 호출한다.
    """

    name = "rag_search"
    description = (
        "CG Inside 회사 내부 문서(사내 규정, 온보딩 가이드, 복지 정보 등)를 검색합니다. "
        "회사 정책, 규정, 제도, 복지, 근무, 휴가 등에 대한 질문에 사용하세요."
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
        from rag.vector_store import search_similar
        from rag.chain import format_docs
        from rag.config import get_settings

        settings = get_settings()

        try:
            docs = search_similar(query, k=settings["retrieval_k"])
        except Exception as e:
            logger.error(f"RAG 검색 실패: {e}")
            return ToolResult(content="문서 검색 중 오류가 발생했습니다.")

        if not docs:
            return ToolResult(
                content="관련 문서를 찾을 수 없습니다.",
                metadata={"similarity": 0, "doc_count": 0},
            )

        best_score = max((d.get("similarity", 0) for d in docs), default=0)
        threshold = 0.35

        if best_score < threshold:
            return ToolResult(
                content=f"관련 문서를 찾았지만 유사도가 낮습니다 (최고 {best_score:.2f}). 웹 검색을 시도해 주세요.",
                metadata={"similarity": best_score, "doc_count": len(docs), "below_threshold": True},
            )

        context = format_docs(docs)

        # 출처 정보
        sources = []
        if settings.get("show_sources", True):
            for doc in docs:
                metadata = doc.get("metadata", {})
                if isinstance(metadata, str):
                    metadata = json.loads(metadata)
                sources.append({
                    "source": metadata.get("source", ""),
                    "content": doc["content"][:200],
                })

        return ToolResult(
            content=context,
            metadata={
                "similarity": best_score,
                "doc_count": len(docs),
                "sources": sources,
            },
        )
