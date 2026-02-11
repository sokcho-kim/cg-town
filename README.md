# CG Town

CG Inside 사내 가상 오피스 & 직원 도감 서비스

> Phaser.js 기반 2D 멀티플레이어 오피스에서 동료를 만나고, AI NPC에게 회사 정보를 물어보세요.

---

## 주요 기능

- **가상 오피스** — Phaser.js 2D 맵에서 실시간 멀티플레이어 이동 (WebSocket)
- **직원 도감** — 부서별 직원 프로필 조회 및 편집
- **AI NPC 채팅** — RAG 기반 사내 정보 답변 (DB → RAG → 웹 검색 폴백)
- **구내식당 메뉴** — 자동 스크래핑으로 오늘의 메뉴 안내

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), Phaser.js 3, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python FastAPI, LangChain, OpenAI API |
| Database | Supabase (PostgreSQL + pgvector) |
| Infra | GitHub Actions (메뉴 스크래핑, NPC 상태 갱신) |

---

## 프로젝트 구조

```
cg-town/
├── frontend/                # Next.js 프론트엔드
│   ├── app/                 # App Router 페이지
│   │   ├── auth/            # 로그인 / 회원가입 / 비밀번호 재설정
│   │   ├── dogam/           # 직원 도감 (목록 / 상세 / 편집)
│   │   └── admin/           # 관리자 패널
│   ├── components/          # React 컴포넌트 (PhaserGame, NpcChat 등)
│   ├── hooks/               # 커스텀 훅 (useMultiplayer 등)
│   ├── lib/                 # 유틸리티, Supabase 클라이언트, 게임 설정
│   └── public/              # 정적 에셋 (맵, 캐릭터 이미지)
│
├── backend/                 # FastAPI 백엔드
│   ├── api/                 # REST API (프로필, NPC 채팅, 메뉴)
│   ├── ws/                  # WebSocket (멀티플레이어)
│   ├── rag/                 # RAG 시스템 (벡터 검색 + 키워드 검색)
│   └── main.py              # 서버 진입점
│
├── docs/                    # 문서 (API 명세, 컨벤션, ADR)
├── scripts/                 # 유틸리티 스크립트 (일괄 등록, 아바타 업로드)
├── tests/                   # 프로토타입 테스트
└── notebooks/               # 학습용 노트북
```

---

## 시작하기

### 프론트엔드

```bash
cd frontend
npm install
cp .env.local.example .env.local   # Supabase 정보 입력
npm run dev                         # http://localhost:3000
```

### 백엔드

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # Supabase, OpenAI 키 입력
uvicorn main:app --reload           # http://localhost:8000
```

---

## 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 운영 (프로덕션) |
| `dev` | 개발 |

---

## 문서

- [API 명세서](./docs/api_spec.md)
- [코딩 컨벤션](./docs/convention.md)
- [셋업 가이드](./docs/SETUP-GUIDE.md)
- [아키텍처 결정 기록](./docs/decisions/)
