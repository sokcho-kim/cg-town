from fastapi import APIRouter, Depends

from api.deps import get_current_user

router = APIRouter(prefix="/api")


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
