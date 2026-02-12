"""식당 메뉴 API 엔드포인트"""
import os
import logging

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from lib.supabase import get_supabase_admin
from lib.timezone import today_kst
from rag.vector_store import embed_and_store_document

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/menu", tags=["menu"])

DAY_MAP = {0: "월", 1: "화", 2: "수", 3: "목", 4: "금", 5: "토", 6: "일"}


class WeeklyMenuRequest(BaseModel):
    post_title: str
    post_date: str | None = None
    week_title: str | None = None
    period: str | None = None
    menus: dict


def _verify_scraper_key(x_scraper_key: str | None):
    """스크래퍼 시크릿 키 검증"""
    expected = os.environ.get("SCRAPER_SECRET_KEY", "")
    if not expected or x_scraper_key != expected:
        raise HTTPException(status_code=403, detail="Invalid scraper key")


@router.post("/weekly")
async def save_weekly_menu(
    body: WeeklyMenuRequest,
    x_scraper_key: str | None = Header(None),
):
    """주간 메뉴 저장 (스크래퍼에서 호출)"""
    _verify_scraper_key(x_scraper_key)
    supabase = get_supabase_admin()

    # Upsert: post_title 기준
    existing = (
        supabase.table("cafeteria_menus")
        .select("id")
        .eq("post_title", body.post_title)
        .execute()
    )

    row = {
        "post_title": body.post_title,
        "post_date": body.post_date,
        "week_title": body.week_title,
        "period": body.period,
        "menus": body.menus,
        "scraped_at": today_kst().isoformat(),
    }

    if existing.data:
        supabase.table("cafeteria_menus").update(row).eq("id", existing.data[0]["id"]).execute()
        action = "updated"
    else:
        supabase.table("cafeteria_menus").insert(row).execute()
        action = "created"

    # 사이드 이펙트: NPC 상태 메시지 + RAG 지식베이스 업데이트
    _update_npc_status(supabase, body.menus)
    _update_knowledge_base(supabase, body)

    return {"message": f"Menu {action} successfully", "post_title": body.post_title}


@router.get("/today")
async def get_today_menu():
    """오늘의 메뉴 조회 (public)"""
    supabase = get_supabase_admin()

    result = (
        supabase.table("cafeteria_menus")
        .select("*")
        .order("scraped_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return {"menu": None, "message": "등록된 식단 정보가 없습니다."}

    latest = result.data[0]
    today_weekday = DAY_MAP.get(today_kst().weekday())
    today_menu = latest.get("menus", {}).get(today_weekday)

    return {
        "week_title": latest.get("week_title"),
        "period": latest.get("period"),
        "today_weekday": today_weekday,
        "today_menu": today_menu,
        "all_menus": latest.get("menus"),
    }


@router.post("/refresh-npc-status")
async def refresh_npc_status(
    x_scraper_key: str | None = Header(None),
):
    """매일 호비의 status_message를 오늘 메뉴로 갱신"""
    _verify_scraper_key(x_scraper_key)
    supabase = get_supabase_admin()

    result = (
        supabase.table("cafeteria_menus")
        .select("menus")
        .order("scraped_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return {"message": "No menu data found"}

    menus = result.data[0].get("menus", {})
    _update_npc_status(supabase, menus)

    today_weekday = DAY_MAP.get(today_kst().weekday())
    return {"message": f"NPC status refreshed for {today_weekday}요일"}


@router.get("/weekly/latest")
async def get_latest_weekly_menu():
    """최신 주간 전체 메뉴 조회 (public)"""
    supabase = get_supabase_admin()

    result = (
        supabase.table("cafeteria_menus")
        .select("*")
        .order("scraped_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="등록된 식단 정보가 없습니다.")
    return result.data[0]


def _update_npc_status(supabase, menus: dict):
    """NPC 호비의 status_message를 오늘 메뉴로 업데이트"""
    today_weekday = DAY_MAP.get(today_kst().weekday())
    today_menu = menus.get(today_weekday)

    if not today_menu:
        status = "오늘 식단 정보 없음"
    else:
        items = today_menu.get("lunch", [])
        if items:
            status = f"오늘 점심: {', '.join(items[:3])}"
            if len(items) > 3:
                status += " 외"
        else:
            status = "오늘 메뉴 정보 없음"

    try:
        # is_npc 플래그로 NPC를 찾음 (username 변경에 영향 안 받도록)
        npc = (
            supabase.table("profiles")
            .select("id, username")
            .eq("is_npc", True)
            .execute()
        )
        if npc.data:
            for row in npc.data:
                supabase.table("profiles").update(
                    {"status_message": status}
                ).eq("id", row["id"]).execute()
            logger.info(f"NPC 상태 메시지 업데이트: {status}")
        else:
            logger.warning("NPC 프로필을 찾을 수 없습니다 (is_npc=True)")
    except Exception as e:
        logger.warning(f"NPC 상태 업데이트 실패: {e}")


def _update_knowledge_base(supabase, body: WeeklyMenuRequest):
    """RAG 지식베이스에 식단표 문서 업데이트"""
    lines = [f"# {body.week_title or body.post_title}", ""]
    if body.period:
        lines.append(f"기간: {body.period}")
        lines.append("")

    for day in ["월", "화", "수", "목", "금"]:
        day_menu = body.menus.get(day, {})
        day_date = day_menu.get("date", "")
        items = day_menu.get("lunch", [])
        special = day_menu.get("special", "")

        header = f"## {day}요일"
        if day_date:
            header += f" ({day_date})"
        lines.append(header)

        if items:
            for item in items:
                lines.append(f"- {item}")
        else:
            lines.append("- 메뉴 정보 없음")

        if special:
            lines.append(f"- **특별 메뉴**: {special}")
        lines.append("")

    content = "\n".join(lines)
    filename = "식단표.md"

    try:
        existing = (
            supabase.table("knowledge_documents")
            .select("id")
            .eq("filename", filename)
            .execute()
        )

        if existing.data:
            doc_id = existing.data[0]["id"]
            supabase.table("knowledge_documents").update(
                {"content": content}
            ).eq("id", doc_id).execute()
        else:
            result = supabase.table("knowledge_documents").insert(
                {"filename": filename, "content": content}
            ).execute()
            doc_id = result.data[0]["id"]

        embed_and_store_document(doc_id, filename, content)
        logger.info(f"지식베이스 업데이트 완료: {filename}")
    except Exception as e:
        logger.warning(f"지식베이스 업데이트 실패: {e}")
