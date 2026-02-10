# CG Town 작업 목록

> 최종 업데이트: 2026-02-10

---

## 담당자 분리

| 담당 | 역할 | 작업 범위 |
|------|------|-----------|
| **은빈** | 디자인/에셋 | 타일맵 Tiled 편집, 캐릭터 에셋 제작, UI 디자인, Supabase Storage 업로드 |
| **지민** | 개발 | 코드, NPC/RAG 백엔드, API, WebSocket, 프론트엔드 기능 |

> 충돌 최소화 원칙: 은빈은 에셋 파일(.png, .json 타일맵)만, 지민은 코드 파일(.ts, .tsx, .py)만 수정

---

## P0 — 지금 당장 (기반 작업)

### 맵/UI
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 1 | 타일맵 꾸미기 (Tiled 에디터) | 은빈 | TODO | Tiled로 배경/오브젝트 배치, Sprout Lands 에셋 활용 |
| 2 | 충돌 레이어 설정 (벽, 물, 오브젝트) | 은빈 | TODO | Tiled에서 collision 레이어 추가 → 지민이 코드 연동 |
| 2b | 충돌 레이어 코드 연동 | 지민 | TODO | Phaser에서 collision 레이어 읽어 이동 제한 적용 |

### 유저/세션
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 3 | ~~로그아웃 기능~~ | 지민 | DONE | 게임 + 도감 페이지 |
| 4 | ~~관리자 일괄 등록 스크립트~~ | 지민 | DONE | `scripts/bulk-register.js` |
| 4b | ~~CSV 작성 + 일괄 등록 실행~~ | 지민 | DONE | 28명 등록 완료, 아바타 동물 상태메시지 부여 |
| 4c | ~~캐릭터 이미지 Storage 업로드~~ | 지민 | DONE | Gemini 이미지 분류/리사이즈(128x256) → Supabase Storage 업로드 |
| 4d | ~~캐릭터 비율 수정~~ | 지민 | DONE | 128×256 → 64×128 (1:2 비율 유지), 텍스트 오프셋 조정 완료 |
| 5 | ~~캐릭터 머리 위 상태 텍스트~~ | 지민 | DONE | `status_message` 컬럼 + Phaser 표시 |

---

## P1 — 중요 (핵심 기능)

### 도감 개선
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 6 | 포켓몬 스타일 게임 UI | 은빈+지민 | TODO | 은빈: 디자인 시안, 지민: 코드 구현 |
| 7 | ~~부서별 필터/그룹~~ | 지민 | DONE | pill 버튼 + NPC 탭 |
| 8 | ~~기술스택 다중선택~~ | 지민 | DONE | 태그 입력 |
| 9 | ~~프로젝트 다중선택~~ | 지민 | DONE | 태그 다중 입력 |
| 10 | ~~직급 + 직무 둘 다 사용~~ | 지민 | DONE | `position` + `field` |
| 11 | ~~상태 입력~~ | 지민 | DONE | 30자 제한, 게임+도감 표시 |

### NPC
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 12 | ~~NPC 관리 방식 결정~~ | 지민 | DONE | `is_npc` 플래그 |
| 13 | 지식베이스 구축 + RAG | 지민 | 진행중 | pgvector + 하이브리드 검색 + SSE 스트리밍 완료, 문서 확장 남음 |
| 13a | ~~Supabase에 pgvector 마이그레이션 SQL 실행~~ | 지민 | DONE | `backend/data/migration_pgvector.sql` 실행 완료 |
| 13b | ~~기존 로컬 지식베이스 문서 DB로 마이그레이션~~ | 지민 | DONE | 4개 문서 → 7개 청크 이관 완료 |
| 13c | ~~RAG 파이프라인 동작 테스트~~ | 지민 | DONE | RAG/TAG 라우팅 + 질의응답 E2E 검증 완료 |
| 13d | **지식베이스 문서 확장** | 지민 | TODO | 조직도, 프로젝트 정보, 업무 프로세스 등 문서 추가 |
| 13e | ~~하이브리드 검색 (pgvector + tsvector)~~ | 지민 | DONE | RRF 알고리즘, `migration_hybrid_search.sql` 실행 완료 |
| 13f | ~~SSE 스트리밍 응답~~ | 지민 | DONE | `/chat/stream` 엔드포인트, 실시간 토큰 출력 |
| 13g | ~~PDF/DOCX 파일 업로드 지원~~ | 지민 | DONE | pypdf + python-docx, 50MB 제한 |
| 14 | ~~RAG 테스트 페이지~~ | 지민 | DONE | `/admin/hop-e` 호비 AI 트레이너 (파일 업로드 + 채팅 + 설정) |
| 15 | ~~정형데이터 질의 (TAG)~~ | 지민 | DONE | DB 직접 조회 (E2E 테스트 통과) |
| 16 | NPC 채팅 UI | 은빈+지민 | TODO | 게임 내 채팅창, NPC 근처 대화 |
| 16b | ~~NPC 캐릭터 에셋 (hop-e)~~ | 지민 | DONE | hop-e NPC 이미지 Supabase Storage 업로드 완료 |
| 17 | 입사 서류 다운로드 | 지민 | TODO | NPC 안내 + 파일 다운로드 |

---

## P2 — 보통 (테스트/프로토타입)

| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 18 | ~~테스트 개발 폴더 구조~~ | 지민 | DONE | `tests/` 생성 |
| 19 | 회의실 자동예약 기능 | 지민 | TODO | `tests/meeting-room-booking/` |
| 20 | ~~오늘 식당 메뉴 스크래핑~~ | 지민 | DONE | `tests/cafeteria-menu-scraper/` + `backend/api/menu_router.py` |
| 21 | ~~NPC 말풍선 (메뉴)~~ | 지민 | DONE | 식단 스크래핑 → NPC 호비 상태메시지 + RAG 지식베이스 자동 연동 |
| 22 | Phaser 스프라이트시트 애니메이션 | 은빈+지민 | TODO | 은빈: 걷기 스프라이트시트, 지민: Phaser 애니메이션 코드 |
| 23 | ~~기존 React 캐릭터 컴포넌트 삭제~~ | 지민 | DONE | -1666줄 정리 |

---

## P3 — 추후 개발

| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 24 | 인접 채팅 | 지민 | TODO | 거리 기반 채팅 |
| 25 | 담타존 | 지민 | TODO | 익명 채팅, 건의사항 |
| 26 | CG's Notes | 지민 | TODO | 업무 노트, 노션 연동 |
| 27 | 공지사항 연동 (hiworks) | 지민 | TODO | hiworks API |
| 28 | 45도 포즈 | 은빈 | TODO | 대각선 방향 캐릭터 이미지 |
| 29 | 아이디어 수집 체계 | 지민 | TODO | 팀원 아이디어 모아보기 |

---

## 결정 사항

| 주제 | 결정 | 비고 |
|------|------|------|
| 분야 vs 직급 | **둘 다 사용** | `field`(직무) + `position`(직급) 병행 |
| NPC 관리 | **is_npc 플래그** | profiles 테이블에 `is_npc` boolean |
| 정형데이터 질의 | **TAG + RAG 하이브리드** | 단순 집계 → DB, 문서 → RAG |
| 벡터 저장소 | **Supabase pgvector** | FAISS → pgvector 마이그레이션 완료 |
| 검색 방식 | **하이브리드 (벡터+키워드)** | pgvector + tsvector → RRF 병합 (0.7:0.3) |
| 식당 메뉴 | **GPT-4o Vision OCR** | 이미지 크롭(좌상단 1/4) → VLM → JSON 구조화 |
| 응답 방식 | **SSE 스트리밍** | 토큰 단위 실시간 출력 |
| 일괄 등록 | **Node.js 스크립트** | `scripts/bulk-register.js`, Secret key |
| 캐릭터 이미지 | **Supabase Storage** | `characters/{email_prefix}/{direction}.png` |
| 작업 분리 | **에셋 vs 코드** | 은빈: .png/.json 에셋만, 지민: 코드만 → git 충돌 최소화 |

---

## 완료된 작업

- [x] 프로젝트 세팅 (Next.js + FastAPI + Supabase)
- [x] JWT 인증 미들웨어
- [x] WebSocket 실시간 멀티플레이어
- [x] 타일 기반 그리드 이동 (64px, 24x12)
- [x] 랜덤 스폰 + 충돌 감지
- [x] 캐릭터 이름 표시
- [x] 방향 포즈 유지 + Space키 default 포즈
- [x] 위치 저장/복원 (user_metadata)
- [x] 비밀번호 재설정
- [x] Phaser.js 마이그레이션 (PhaserGame, EventBus, Tween 보간)
- [x] 직원 도감 기본 구현 (/dogam, /dogam/[id], /dogam/edit)
- [x] Supabase Storage 캐릭터 이미지 (email prefix 기반 URL)
- [x] 프로필 API (GET/PUT)
- [x] DB 스키마 확장 (tech_stack, field, project, tmi)
- [x] 에셋팩 추가 (Sprout Lands, Forest)
- [x] 로그아웃 기능 (게임 + 도감)
- [x] 일괄 등록 스크립트 (scripts/bulk-register.js)
- [x] DB 스키마: position, is_npc, status_message 추가
- [x] 상태 메시지 표시 (Phaser 머리 위 + 도감)
- [x] 도감 부서별 필터 + NPC 탭
- [x] 도감 편집 개선 (프로젝트 다중선택, 상태 입력, 직급 표시)
- [x] 미사용 React 컴포넌트 정리 (-1666줄)
- [x] tests/ 폴더 구조 생성
- [x] 문서화 (TODO.md, SETUP-GUIDE.md)
- [x] 기본 캐릭터 이미지 (Sprout Lands 추출, 로컬 폴백)
- [x] 호비 AI 트레이너 RAG 테스트 페이지 (`/admin/hop-e`)
- [x] 28명 사원 일괄 등록 + 아바타 동물 상태메시지
- [x] 캐릭터 이미지 분류/리사이즈/업로드 (27명 × 5방향 = 135장)
- [x] hop-e NPC 이미지 Supabase Storage 업로드
- [x] rag-test → hop-e 페이지 리네임
- [x] Phaser React Strict Mode 크래시 수정 (EventBus 정리, isShutDown 가드)
- [x] TAG E2E 테스트 통과
- [x] FAISS → pgvector 마이그레이션 (Supabase DB 벡터 검색)
- [x] 파일 업로드 → 자동 임베딩 생성 기능
- [x] TAG/RAG 하이브리드 라우팅 구현
- [x] 하이브리드 검색 (pgvector + tsvector, RRF 알고리즘)
- [x] SSE 스트리밍 응답 (토큰 단위 실시간 출력)
- [x] PDF/DOCX 파일 업로드 지원 (pypdf + python-docx)
- [x] 식당 메뉴 스크래핑 (키친인큐베이터 → GPT-4o Vision OCR → DB 저장)
- [x] 메뉴 API (`/api/menu/today`, `/api/menu/weekly/latest`)
- [x] TAG 라우팅 cafeteria_menu 의도 추가 ("오늘 점심 뭐야?" 직접 응답)
- [x] 메뉴 스크래핑 시 NPC 호비 상태메시지 + RAG 지식베이스 자동 업데이트
