# CG Inside 직원 도감

CG Inside 사내 직원 도감 서비스입니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Python FastAPI |
| Database | Supabase (PostgreSQL) |

---

## 프로젝트 구조

```
cg-town/
├── frontend/          # Next.js 프론트엔드
│   ├── app/           # App Router 페이지
│   ├── components/    # 재사용 컴포넌트
│   └── lib/           # 유틸리티 함수
│
├── backend/           # FastAPI 백엔드
│   ├── api/           # API 라우터
│   └── main.py        # 서버 진입점
│
└── docs/              # 문서
    ├── api_spec.md    # API 명세
    └── convention.md  # 코딩 컨벤션
```

---

## 시작하기

### 1. 프론트엔드 실행

```bash
cd frontend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일을 열어 Supabase 정보 입력

# 개발 서버 실행
npm run dev
```

→ http://localhost:3000 에서 확인

### 2. 백엔드 실행

```bash
cd backend

# 가상환경 생성 및 활성화
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어 Supabase 정보 입력

# 서버 실행
uvicorn main:app --reload
```

→ http://localhost:8000 에서 확인
→ http://localhost:8000/docs 에서 API 문서 확인

---

## 팀원

| 역할 | 담당 |
|------|------|
| Frontend | 은빈 |
| Backend | 지민 |

---

## 문서

- [API 명세서](./docs/api_spec.md)
- [코딩 컨벤션](./docs/convention.md)
