"""범용 DB 쿼리 — 분류기가 추출한 table + filters로 자동 조회"""
import logging
from datetime import date
from lib.supabase import get_supabase_client

logger = logging.getLogger(__name__)

DAY_MAP = {0: "월", 1: "화", 2: "수", 3: "목", 4: "금", 5: "토", 6: "일"}


async def query_db(table: str, filters: dict) -> dict:
    """테이블명과 필터 조건으로 DB 조회 후 자연어 응답 생성"""
    if table == "profiles":
        return await _query_profiles(filters)
    elif table == "cafeteria_menus":
        return await _query_menu(filters)
    else:
        return {"answer": "조회할 수 있는 테이블이 아닙니다."}


async def _query_profiles(filters: dict) -> dict:
    """profiles 테이블 범용 조회"""
    supabase = get_supabase_client()
    select = "username, department, position, field"

    try:
        query = supabase.table("profiles").select(select, count="exact").eq("is_npc", False)
    except Exception:
        query = supabase.table("profiles").select(select, count="exact")

    # 필터 적용 (ilike로 부분 매칭)
    if filters.get("position"):
        query = query.ilike("position", f"%{filters['position']}%")
    if filters.get("department"):
        query = query.ilike("department", f"%{filters['department']}%")
    if filters.get("username"):
        query = query.ilike("username", f"%{filters['username']}%")
    if filters.get("field"):
        query = query.ilike("field", f"%{filters['field']}%")

    result = query.execute()

    # 필터 없으면 전체 인원수
    has_filter = any(filters.get(k) for k in ("position", "department", "username", "field"))
    if not has_filter:
        return {"answer": f"현재 CG Inside에는 총 {result.count}명의 직원이 있습니다."}

    if not result.data:
        desc = ", ".join(f"{k}='{v}'" for k, v in filters.items() if v)
        return {"answer": f"조건({desc})에 해당하는 직원이 없습니다."}

    lines = []
    for emp in result.data:
        name = emp.get("username", "이름 없음")
        dept = emp.get("department", "")
        pos = emp.get("position", "")
        field = emp.get("field", "")
        info = f"- {name}"
        if pos:
            info += f" ({pos})"
        if dept:
            info += f" - {dept}"
        if field:
            info += f" [{field}]"
        lines.append(info)

    answer = f"검색 결과 ({result.count}명):\n" + "\n".join(lines)
    return {"answer": answer}


async def _query_menu(filters: dict) -> dict:
    """cafeteria_menus 테이블 조회"""
    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("cafeteria_menus")
            .select("menus, week_title, period")
            .order("scraped_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        return {"answer": "식단 정보 시스템이 아직 설정되지 않았습니다."}

    if not result.data:
        return {"answer": "아직 등록된 식단 정보가 없습니다."}

    menus = result.data[0].get("menus", {})
    today_wd = date.today().weekday()
    day_param = filters.get("day", "")

    # 요일 결정
    if day_param:
        dp = day_param.strip()
        if dp == "내일":
            target = DAY_MAP.get((today_wd + 1) % 7, "")
            label = "내일"
        elif dp == "모레":
            target = DAY_MAP.get((today_wd + 2) % 7, "")
            label = "모레"
        elif dp in ("월", "화", "수", "목", "금", "토", "일"):
            target = dp
            label = f"{dp}요일"
        else:
            target = DAY_MAP.get(today_wd, "")
            label = "오늘"
    else:
        target = DAY_MAP.get(today_wd, "")
        label = "오늘"

    menu_data = menus.get(target)

    if not menu_data:
        answer = f"{label}({target}요일)은 식단 정보가 없습니다.\n\n"
        answer += f"이번 주 식단 ({result.data[0].get('period', '')}):\n"
        for d in ("월", "화", "수", "목", "금"):
            items = menus.get(d, {}).get("lunch", [])
            answer += f"\n{d}요일: {', '.join(items) if items else '정보 없음'}"
        return {"answer": answer}

    items = menu_data.get("lunch", [])
    answer = f"{label}({target}요일) 점심 메뉴입니다:\n"
    for item in items:
        answer += f"- {item}\n"
    if menu_data.get("special"):
        answer += f"\n특별 메뉴: {menu_data['special']}"

    return {"answer": answer}
