"""관리자 전용 API (사원 등록/관리)"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from api.deps import get_current_user
from lib.supabase import get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

DEFAULT_PASSWORD = "CgTown2026!"

DEPARTMENTS = ["AI", "경영", "기획", "서비스개발", "연구소"]
POSITIONS = ["CEO", "CTO", "이사", "소장", "부소장", "팀장", "대리", "사원", "연구원"]


# ===== 관리자 검증 =====


async def get_admin_user(current_user=Depends(get_current_user)):
    """현재 유저가 관리자인지 확인"""
    supabase = get_supabase_admin()
    result = (
        supabase.table("profiles")
        .select("is_admin")
        .eq("id", current_user.id)
        .single()
        .execute()
    )
    if not result.data or not result.data.get("is_admin"):
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return current_user


# ===== Pydantic 모델 =====


class CreateUserRequest(BaseModel):
    email: EmailStr
    username: str
    department: str
    position: str = ""
    status_message: str = ""


class UpdateUserRequest(BaseModel):
    username: str | None = None
    department: str | None = None
    position: str | None = None
    status_message: str | None = None
    field: str | None = None
    project: str | None = None
    tmi: str | None = None
    tech_stack: list[str] | None = None


# ===== 사원 목록 =====


@router.get("/users")
async def list_users(admin=Depends(get_admin_user)):
    """전체 사원 목록 (관리자용)"""
    supabase = get_supabase_admin()
    result = (
        supabase.table("profiles")
        .select("id, username, department, position, status_message, is_npc, is_admin")
        .eq("is_npc", False)
        .order("department")
        .execute()
    )
    return {"users": result.data or []}


# ===== 사원 등록 =====


@router.post("/users")
async def create_user(body: CreateUserRequest, admin=Depends(get_admin_user)):
    """신규 사원 등록"""
    supabase = get_supabase_admin()

    # 이메일 중복 체크
    try:
        users_resp = await _find_user_by_email(supabase, body.email)
        if users_resp:
            raise HTTPException(status_code=409, detail=f"이미 등록된 이메일입니다: {body.email}")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"이메일 체크 실패: {e}")

    # 1) Supabase Auth에 유저 생성
    try:
        auth_result = supabase.auth.admin.create_user({
            "email": body.email,
            "password": DEFAULT_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"username": body.username},
        })
        user_id = auth_result.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"계정 생성 실패: {e}")

    # 2) 프로필 업데이트 (트리거가 생성한 row)
    retries = 5
    for attempt in range(retries):
        import asyncio
        await asyncio.sleep(0.8)

        updates = {
            "username": body.username,
            "department": body.department,
            "position": body.position,
            "is_npc": False,
        }
        if body.status_message:
            updates["status_message"] = body.status_message

        result = (
            supabase.table("profiles")
            .update(updates)
            .eq("id", user_id)
            .execute()
        )
        if result.data:
            break
    else:
        logger.warning(f"프로필 업데이트 실패 (트리거 지연): {body.email}")

    logger.info(f"신규 사원 등록: {body.username} ({body.email})")
    return {
        "message": f"{body.username}님이 등록되었습니다.",
        "user_id": user_id,
        "default_password": DEFAULT_PASSWORD,
    }


# ===== 사원 수정 =====


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserRequest, admin=Depends(get_admin_user)):
    """사원 정보 수정 (관리자)"""
    supabase = get_supabase_admin()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목이 없습니다.")

    result = (
        supabase.table("profiles")
        .update(updates)
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="사원을 찾을 수 없습니다.")

    return {"message": "수정 완료", "profile": result.data[0]}


# ===== 비밀번호 초기화 =====


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, admin=Depends(get_admin_user)):
    """사원 비밀번호 초기화"""
    supabase = get_supabase_admin()

    try:
        supabase.auth.admin.update_user_by_id(user_id, {
            "password": DEFAULT_PASSWORD,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"비밀번호 초기화 실패: {e}")

    return {"message": f"비밀번호가 초기화되었습니다. (기본: {DEFAULT_PASSWORD})"}


# ===== 사원 삭제 =====


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(get_admin_user)):
    """사원 삭제 (Auth + Profile)"""
    supabase = get_supabase_admin()

    # 자기 자신 삭제 방지
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="자기 자신은 삭제할 수 없습니다.")

    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"삭제 실패: {e}")

    return {"message": "사원이 삭제되었습니다."}


# ===== 헬퍼 =====


async def _find_user_by_email(supabase, email: str):
    """이메일로 유저 조회"""
    page = 1
    while True:
        resp = supabase.auth.admin.list_users(page=page, per_page=1000)
        for u in resp.users:
            if u.email and u.email.lower() == email.lower():
                return u
        if len(resp.users) < 1000:
            break
        page += 1
    return None
