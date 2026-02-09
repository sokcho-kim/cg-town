from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging

# 환경변수 로드 (import보다 먼저 실행해야 OPENAI_API_KEY 등이 적용됨)
load_dotenv()

from api.router import router
from api.npc_router import router as npc_router
from ws.endpoint import router as ws_router

# 로깅 설정
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="CG Inside 직원 도감 API",
    description="CG Inside 사내 직원 도감 서비스 백엔드 API",
    version="0.1.0"
)

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js 개발 서버
        "http://localhost:3001",  # Next.js 개발 서버 (대체 포트)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(router)

# NPC 채팅 라우터 등록
app.include_router(npc_router)

# WebSocket 라우터 등록
app.include_router(ws_router)


@app.get("/")
async def root():
    """헬스 체크 엔드포인트"""
    return {"message": "CG Inside 직원 도감 API 서버가 실행 중입니다!"}
