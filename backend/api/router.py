from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.deps import get_current_user
from lib.supabase import get_supabase_client

router = APIRouter(prefix="/api")


# ===== Pydantic 모델 =====


class ProfileUpdate(BaseModel):
    """프로필 수정 요청 모델"""
    field: str | None = None
    project: str | None = None
    tmi: str | None = None
    tech_stack: list[str] | None = None
    position: str | None = None
    status_message: str | None = None


# ===== 기존 엔드포인트 =====


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """현재 로그인한 사용자의 정보를 반환합니다."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "user_metadata": current_user.user_metadata,
    }


@router.get("/health")
async def health_check():
    """API 상태 확인"""
    return {"status": "healthy"}


# ===== 프로필 API =====


@router.get("/profiles")
async def get_profiles(current_user=Depends(get_current_user)):
    """전체 직원 프로필 목록을 반환합니다. (도감용)"""
    supabase = get_supabase_client()
    result = supabase.table("profiles").select("*").execute()
    return {"profiles": result.data}


@router.get("/profiles/{user_id}")
async def get_profile(user_id: str, current_user=Depends(get_current_user)):
    """특정 직원의 프로필을 반환합니다."""
    supabase = get_supabase_client()
    result = (
        supabase.table("profiles")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"profile": result.data}


@router.put("/profiles/me")
async def update_my_profile(
    body: ProfileUpdate, current_user=Depends(get_current_user)
):
    """내 프로필을 수정합니다. (TMI, 기술스택, 분야, 프로젝트)"""
    supabase = get_supabase_client()

    # None이 아닌 필드만 업데이트
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("profiles")
        .update(update_data)
        .eq("id", current_user.id)
        .execute()
    )
    return {"profile": result.data[0] if result.data else None}
