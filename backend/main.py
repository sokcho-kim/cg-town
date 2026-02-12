from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging

# 환경변수 로드 (import보다 먼저 실행해야 OPENAI_API_KEY 등이 적용됨)
load_dotenv()

from api.router import router
from api.npc_router import router as npc_router
from api.menu_router import router as menu_router
from ws.endpoint import router as ws_router

# 로깅 설정
APP_ENV = os.environ.get("APP_ENV", "development")
log_level = logging.DEBUG if APP_ENV == "development" else logging.INFO
logging.basicConfig(level=log_level)
logger = logging.getLogger(__name__)
logger.info(f"Starting server in {APP_ENV} mode")

def _refresh_npc_status():
    """호비 상태메시지를 오늘 메뉴로 갱신"""
    try:
        from lib.supabase import get_supabase_admin
        from lib.timezone import today_kst

        DAY_MAP = {0: "월", 1: "화", 2: "수", 3: "목", 4: "금", 5: "토", 6: "일"}
        supabase = get_supabase_admin()

        result = (
            supabase.table("cafeteria_menus")
            .select("menus")
            .order("scraped_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            from api.menu_router import _update_npc_status
            _update_npc_status(supabase, result.data[0].get("menus", {}))
            logger.info("서버 시작 시 NPC 상태메시지 갱신 완료")
        else:
            logger.info("메뉴 데이터 없음 — NPC 상태메시지 갱신 스킵")
    except Exception as e:
        logger.warning(f"NPC 상태메시지 갱신 실패: {e}")


async def _daily_npc_refresh():
    """매일 06:00 KST 에 호비 상태메시지를 오늘 메뉴로 갱신하는 백그라운드 태스크."""
    from lib.timezone import now_kst
    while True:
        try:
            now = now_kst()
            # 다음 06:00 까지 대기 시간 계산
            tomorrow_6am = now.replace(hour=6, minute=0, second=0, microsecond=0)
            if now.hour >= 6:
                tomorrow_6am += __import__("datetime").timedelta(days=1)
            wait_seconds = (tomorrow_6am - now).total_seconds()
            logger.info(f"다음 NPC 상태 갱신까지 {wait_seconds/3600:.1f}시간 대기")
            await asyncio.sleep(wait_seconds)
            _refresh_npc_status()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"NPC 스케줄러 오류: {e}")
            await asyncio.sleep(3600)  # 오류 시 1시간 후 재시도


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 라이프사이클 — 시작 시 NPC 상태 갱신 + 일일 스케줄러."""
    # startup
    _refresh_npc_status()
    task = asyncio.create_task(_daily_npc_refresh())
    yield
    # shutdown
    task.cancel()


app = FastAPI(
    title="CG Inside 직원 도감 API",
    description="CG Inside 사내 직원 도감 서비스 백엔드 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 — 환경별 자동 분기
_CORS_ORIGINS = {
    "development": [
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    "production": [
        "https://cg-town.vercel.app",
    ],
}
allow_origins = _CORS_ORIGINS.get(APP_ENV, _CORS_ORIGINS["production"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(router)

# NPC 채팅 라우터 등록
app.include_router(npc_router)

# 식당 메뉴 라우터 등록
app.include_router(menu_router)

# WebSocket 라우터 등록
app.include_router(ws_router)


@app.get("/")
async def root():
    """헬스 체크 엔드포인트"""
    return {"message": "CG Inside 직원 도감 API 서버가 실행 중입니다!"}
