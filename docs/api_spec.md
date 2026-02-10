# API 명세서

## 기본 정보

- Base URL: `http://localhost:8000`
- Content-Type: `application/json`

---

## 엔드포인트 목록

### 헬스 체크

#### GET /
서버 상태 확인

**Response**
```json
{
  "message": "CG Inside 직원 도감 API 서버가 실행 중입니다!"
}
```

#### GET /api/health
API 상태 확인

**Response**
```json
{
  "status": "healthy"
}
```

---

### 프로필

#### GET /api/profiles
전체 직원 프로필 조회 (인증 필요)

#### GET /api/profiles/{user_id}
특정 직원 프로필 조회

#### PUT /api/profiles/me
내 프로필 수정 (인증 필요)

---

### NPC 채팅 (RAG)

#### POST /api/npc/chat
NPC에게 질문 (일반 응답)

#### POST /api/npc/chat/stream
NPC에게 질문 (SSE 스트리밍 응답)

#### GET /api/npc/documents
지식베이스 문서 목록 조회

#### POST /api/npc/documents
지식베이스 문서 생성

#### POST /api/npc/documents/upload
파일 업로드 (.md, .txt, .pdf, .docx)

#### PUT /api/npc/documents/{filename}
문서 수정

#### DELETE /api/npc/documents/{filename}
문서 삭제

#### POST /api/npc/rebuild-index
임베딩 전체 재빌드

---

### 식당 메뉴

#### GET /api/menu/today
오늘의 메뉴 조회 (인증 불필요)

**Response**
```json
{
  "week_title": "2월 2째주 식단표",
  "period": "2025-02-10 ~ 2025-02-14",
  "today_weekday": "화",
  "today_menu": {
    "date": "2025-02-11",
    "lunch": ["찰흑미밥", "순살양념치킨", "숙주나물", "배추김치", "소고기무국"]
  },
  "all_menus": { ... }
}
```

#### GET /api/menu/weekly/latest
최신 주간 전체 메뉴 조회 (인증 불필요)

#### POST /api/menu/weekly
주간 메뉴 저장 (스크래퍼 전용, `X-Scraper-Key` 헤더 필요)

**Request**
```json
{
  "post_title": "[키친인큐베이터] 메뉴공지 2월 2째주",
  "post_date": "2026-02-06 12:01:11",
  "week_title": "2월 2째주 식단표",
  "period": "2025-02-10 ~ 2025-02-14",
  "menus": {
    "월": { "date": "2025-02-10", "lunch": ["귀리백미밥", "매콤우삼겹불고기", ...] },
    "화": { ... },
    "수": { ... },
    "목": { ... },
    "금": { ... }
  }
}
```

---

### WebSocket

#### WS /ws?token={jwt_token}
실시간 멀티플레이어 (이동, 접속/퇴장)
