"""정형 데이터 질의 (TAG) - Supabase DB 직접 조회"""
import logging
from lib.supabase import get_supabase_client

logger = logging.getLogger(__name__)


def _query_profiles(select: str, filters: dict | None = None, exclude_npc: bool = True):
    """프로필 쿼리 헬퍼 (is_npc 컬럼 없을 때 폴백)"""
    supabase = get_supabase_client()

    if exclude_npc:
        try:
            query = supabase.table("profiles").select(select, count="exact")
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            return query.eq("is_npc", False).execute()
        except Exception:
            logger.warning("is_npc 컬럼 없음, 필터 없이 조회")

    # is_npc 없거나 exclude_npc=False일 때
    query = supabase.table("profiles").select(select, count="exact")
    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)
    return query.execute()


async def get_employee_search(position: str | None = None, department: str | None = None, name: str | None = None) -> dict:
    """직원 검색 (이름/직급/부서 복합 필터)"""
    supabase = get_supabase_client()
    select_fields = "username, department, position, field"

    # 필터가 하나도 없으면 전체 인원수
    if not position and not department and not name:
        result = _query_profiles("id")
        return {"answer": f"현재 CG Inside에는 총 {result.count}명의 직원이 있습니다."}

    try:
        query = supabase.table("profiles").select(select_fields, count="exact").eq("is_npc", False)
    except Exception:
        query = supabase.table("profiles").select(select_fields, count="exact")

    if position:
        query = query.ilike("position", f"%{position}%")
    if department:
        query = query.ilike("department", f"%{department}%")
    if name:
        query = query.ilike("username", f"%{name}%")

    result = query.execute()

    filters_desc = []
    if position:
        filters_desc.append(f"직급 '{position}'")
    if department:
        filters_desc.append(f"부서 '{department}'")
    if name:
        filters_desc.append(f"이름 '{name}'")
    filter_label = ", ".join(filters_desc)

    if not result.data:
        return {"answer": f"{filter_label}에 해당하는 직원이 없습니다."}

    lines = []
    for emp in result.data:
        ename = emp.get("username", "이름 없음")
        dept = emp.get("department", "")
        pos = emp.get("position", "")
        field = emp.get("field", "")
        info = f"- {ename}"
        if pos:
            info += f" ({pos})"
        if dept:
            info += f" - {dept}"
        if field:
            info += f" [{field}]"
        lines.append(info)

    answer = f"{filter_label} 검색 결과 ({result.count}명):\n" + "\n".join(lines)
    return {"answer": answer}


async def get_department_count() -> dict:
    """부서별 직원 수 조회"""
    result = _query_profiles("department")

    dept_counts: dict[str, int] = {}
    for row in result.data:
        dept = row.get("department") or "미지정"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

    lines = [f"- {dept}: {count}명" for dept, count in sorted(dept_counts.items())]
    answer = "부서별 직원 현황입니다:\n" + "\n".join(lines)
    return {"answer": answer}


async def get_npc_list() -> dict:
    """NPC 목록 조회"""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("profiles")
            .select("username, department, field")
            .eq("is_npc", True)
            .execute()
        )
    except Exception:
        return {"answer": "NPC 시스템이 아직 설정되지 않았습니다. (is_npc 컬럼 필요)"}

    if not result.data:
        return {"answer": "등록된 NPC가 없습니다."}

    lines = [f"- {npc.get('username', '이름 없음')}" for npc in result.data]
    answer = "현재 등록된 NPC 목록입니다:\n" + "\n".join(lines)
    return {"answer": answer}


async def get_cafeteria_menu(day_param: str | None = None) -> dict:
    """식당 메뉴 조회 (오늘/내일/특정 요일)"""
    from lib.timezone import today_kst

    supabase = get_supabase_client()
    DAY_MAP = {0: "월", 1: "화", 2: "수", 3: "목", 4: "금", 5: "토", 6: "일"}
    DAY_LIST = ["월", "화", "수", "목", "금"]

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
        return {"answer": "아직 등록된 식단 정보가 없습니다. 담당자에게 문의해 주세요."}

    menus = result.data[0].get("menus", {})

    # 요일 결정
    today_wd = today_kst().weekday()
    if day_param:
        dp = day_param.strip()
        if dp == "내일":
            target_day = DAY_MAP.get((today_wd + 1) % 7, "")
            label = "내일"
        elif dp == "모레":
            target_day = DAY_MAP.get((today_wd + 2) % 7, "")
            label = "모레"
        elif dp in DAY_LIST or dp in ["토", "일"]:
            target_day = dp
            label = f"{dp}요일"
        else:
            target_day = DAY_MAP.get(today_wd, "")
            label = "오늘"
    else:
        target_day = DAY_MAP.get(today_wd, "")
        label = "오늘"

    target_menu = menus.get(target_day)

    if not target_menu:
        answer = f"{label}({target_day}요일)은 식단 정보가 없습니다.\n\n"
        answer += f"이번 주 식단 ({result.data[0].get('period', '')}):\n"
        for day in DAY_LIST:
            dm = menus.get(day, {})
            items = dm.get("lunch", [])
            answer += f"\n{day}요일: {', '.join(items) if items else '정보 없음'}"
        return {"answer": answer}

    items = target_menu.get("lunch", [])
    answer = f"{label}({target_day}요일) 점심 메뉴입니다:\n"
    for item in items:
        answer += f"- {item}\n"
    if target_menu.get("special"):
        answer += f"\n특별 메뉴: {target_menu['special']}"

    return {"answer": answer}


TAG_QUERY_MAP = {
    "employee_search": get_employee_search,
    "department_count": get_department_count,
    "npc_list": get_npc_list,
    "cafeteria_menu": get_cafeteria_menu,
}
