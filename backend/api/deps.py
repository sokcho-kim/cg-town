from fastapi import Depends, HTTPException, Header

from lib.supabase import get_supabase_client


async def get_current_user(authorization: str = Header(None)):
    """
    JWT 토큰을 검증하고 현재 사용자 정보를 반환하는 FastAPI 의존성 함수입니다.

    Authorization 헤더에서 Bearer 토큰을 추출한 후,
    Supabase auth.get_user()를 사용하여 토큰을 검증합니다.
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is missing",
        )

    # Bearer 토큰 추출
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Expected 'Bearer <token>'",
        )

    token = parts[1]

    try:
        supabase = get_supabase_client()
        user_response = supabase.auth.get_user(token)
        return user_response.user
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )
