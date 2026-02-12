# CG Town 셋업 가이드

> 이 문서는 초기 DB 설정, 사원 등록, 캐릭터 이미지 업로드를 위한 가이드입니다.

---

## 1단계: DB 컬럼 추가 (1회만)

Supabase Dashboard > **SQL Editor**에서 아래 SQL을 실행합니다.

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS position text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_npc boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_message text DEFAULT '';
```

> 파일 위치: `docs/sql/002-add-position-npc-status.sql`

---

## 2단계: RLS 보안 정책 (1회만)

아래 테이블에 RLS를 활성화합니다:

```sql
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read" ON public.knowledge_base
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.cafeteria_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read" ON public.cafeteria_menus
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.meeting_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read" ON public.meeting_reservations
  FOR SELECT TO authenticated USING (true);
```

> 인증된 유저만 읽기 가능, 쓰기/삭제는 백엔드 service role key만 가능

---

## 3단계: 사원 등록 (관리자 웹 UI)

관리자 계정으로 로그인 후 `/admin/members` 페이지에서 사원을 등록합니다.

1. **+ 신규 사원 등록** 버튼 클릭
2. 이름, 이메일, 부서, 직급 입력
3. **등록** 클릭 → 초기 비밀번호 `CgTown2026!`로 계정 생성

기능:
- 사원 등록/수정/삭제
- 비밀번호 초기화
- 부서별 그룹 조회

> 관리자 권한 부여: Supabase에서 `profiles` 테이블의 `is_admin`을 `true`로 설정

---

## 4단계: 캐릭터 이미지 업로드

### 피그마 Export 규칙

각 직원당 5장의 PNG를 Export합니다:

| 파일명 | 설명 |
|--------|------|
| `front.png` | 정면 |
| `back.png` | 뒷면 |
| `left.png` | 왼쪽 |
| `right.png` | 오른쪽 |
| `default.png` | 기본 포즈 |

### 업로드 방법

Supabase Dashboard > **Storage** > `characters` 버킷에서:

1. 이메일 `@` 앞부분으로 폴더를 생성
2. 해당 폴더에 5장의 PNG를 드래그앤드롭

**예시:**

| 직원 | 이메일 | 폴더명 | 업로드 경로 |
|------|--------|--------|-------------|
| 조은빈 | bin@ihopper.co.kr | `bin` | `characters/bin/front.png` 등 |
| 호비 | npc_cg@ihopper.co.kr | `npc_cg` | `characters/npc_cg/front.png` 등 |

> 폴더명 = 이메일에서 `@` 앞부분. 코드에서 자동으로 URL을 조합합니다.

---

## 5단계: pgvector 마이그레이션 (RAG 지식베이스)

NPC 호비의 RAG 시스템을 위해 pgvector를 설정합니다.

Supabase Dashboard > **SQL Editor**에서 아래 파일 내용을 실행합니다:

```
backend/data/migration_pgvector.sql
```

생성되는 항목:
- `knowledge_documents` 테이블 — 지식베이스 문서 원본 저장
- `knowledge_chunks` 테이블 — 문서 청크 + 임베딩 벡터 (1536차원)
- `match_knowledge_chunks` RPC 함수 — pgvector 유사도 검색
- HNSW 인덱스, RLS 정책, updated_at 트리거

> 실행 후 `/admin/hop-e` 페이지에서 문서 업로드 및 RAG 테스트 가능

---

## 6단계: 하이브리드 검색 마이그레이션 (tsvector)

5단계 완료 후, 하이브리드 검색(벡터 + 키워드)을 활성화합니다.

Supabase Dashboard > **SQL Editor**에서 아래 파일 내용을 실행합니다:

```
backend/data/migration_hybrid_search.sql
```

생성되는 항목:
- `content_fts` tsvector 컬럼 — 키워드 검색용 전문 색인
- GIN 인덱스 — tsvector 빠른 검색
- 자동 tsvector 갱신 트리거
- `match_knowledge_hybrid` RPC 함수 — RRF 알고리즘으로 벡터+키워드 결과 병합

---

## 작업 순서 요약

```
1. SQL 실행 (DB 컬럼 추가)
2. RLS 보안 정책 적용
3. 관리자 웹 UI로 사원 등록 (/admin/members)
4. 피그마에서 캐릭터 Export → Supabase Storage 업로드
5. pgvector 마이그레이션 SQL 실행 (RAG 지식베이스)
6. 하이브리드 검색 마이그레이션 SQL 실행 (tsvector)
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `SUPABASE_SECRET_KEY is not set` | 환경변수 누락 | `backend/.env`에 Secret key 확인 |
| 관리자 페이지 접근 불가 | is_admin 미설정 | Supabase에서 해당 유저의 `is_admin`을 `true`로 |
| 캐릭터 이미지 안 보임 | 폴더명 불일치 | 이메일 `@` 앞부분과 Storage 폴더명 일치 확인 |
| 로그인 안 됨 | 비밀번호 오류 | 기본 비밀번호: `CgTown2026!` |
| 관리자가 다른 사원 수정 안 됨 | RLS 정책 | `/dogam/edit?id=` 사용 시 자동으로 admin API 경유 |
