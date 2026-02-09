# CG Town 셋업 가이드 (은빈님용)

> 이 문서는 직원 등록, 캐릭터 이미지 업로드, DB 설정을 위한 가이드입니다.

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

## 2단계: 직원 CSV 작성

`scripts/users.csv` 파일을 편집합니다.

```csv
username,email,department,position,is_npc
조은빈,bin@ihopper.co.kr,디자인팀,사원,false
김지민,jimin@ihopper.co.kr,개발팀,사원,false
박선춘,psc@ihopper.co.kr,경영지원,대표,false
CG봇,npc_cg@ihopper.co.kr,CG Town,NPC,true
홍길동,gildong@ihopper.co.kr,개발팀,사원,false
```

| 컬럼 | 설명 | 예시 |
|------|------|------|
| username | 이름 | 조은빈 |
| email | 로그인 이메일 (고유) | bin@ihopper.co.kr |
| department | 부서 | 디자인팀 |
| position | 직급 | 사원, 팀장, 이사, 대표 |
| is_npc | NPC 여부 | false (일반 직원), true (NPC) |

---

## 3단계: 일괄 등록 실행

터미널에서:

```bash
cd scripts
npm install        # 최초 1회만
node bulk-register.js
```

- 기본 비밀번호: `CgTown2026!` (로그인 후 각자 변경)
- 이미 등록된 이메일은 건너뛰고 프로필 정보만 업데이트됩니다
- 결과가 터미널에 표시됩니다

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
| 김지민 | jimin@ihopper.co.kr | `jimin` | `characters/jimin/front.png` 등 |
| 박선춘 | psc@ihopper.co.kr | `psc` | `characters/psc/front.png` 등 |
| CG봇 | npc_cg@ihopper.co.kr | `npc_cg` | `characters/npc_cg/front.png` 등 |

> 폴더명 = 이메일에서 `@` 앞부분. 코드에서 자동으로 URL을 조합합니다.

---

## 작업 순서 요약

```
1. SQL 실행 (DB 컬럼 추가)
2. users.csv 작성 (30명 정보)
3. node bulk-register.js (계정 일괄 생성)
4. 피그마에서 캐릭터 Export → Supabase Storage 업로드
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `SUPABASE_SECRET_KEY is not set` | 환경변수 누락 | `backend/.env`에 Secret key 확인 |
| `User already registered` | 이미 등록된 이메일 | 정상 — SKIP 후 프로필만 업데이트됨 |
| 캐릭터 이미지 안 보임 | 폴더명 불일치 | 이메일 `@` 앞부분과 Storage 폴더명 일치 확인 |
| 로그인 안 됨 | 비밀번호 오류 | 기본 비밀번호: `CgTown2026!` |
