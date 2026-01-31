from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# 환경변수 로드
load_dotenv()

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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """헬스 체크 엔드포인트"""
    return {"message": "CG Inside 직원 도감 API 서버가 실행 중입니다!"}


@app.get("/api/health")
async def health_check():
    """API 상태 확인"""
    return {"status": "healthy"}
