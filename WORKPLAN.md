# CG Town 작업 계획

## 완료된 작업
- [x] 프로젝트 세팅 및 실행 (Next.js + FastAPI + Supabase)
- [x] 백엔드 JWT 인증 미들웨어 (api/deps.py, api/router.py)
- [x] WebSocket 실시간 멀티플레이어 (ws/manager.py, ws/endpoint.py)
- [x] 프론트엔드 멀티플레이어 훅 (useMultiplayer.ts, RemoteCharacter.tsx)
- [x] 타일 기반 그리드 이동 시스템 (64px 타일, 24x12 그리드)
- [x] 랜덤 스폰 + 충돌 감지 (서버사이드)
- [x] 캐릭터 이름 표시
- [x] 대표님 계정 생성 (psc@ihopper.co.kr / CgTown2026@ / 박선춘)
- [x] 마지막 방향 포즈 유지 (키 떼도 방향 유지)
- [x] Space키 → default 포즈 전환

## 미완료 작업

### 1. 위치 저장/복원 (우선순위 높음)
- 현재: 접속할 때마다 랜덤 스폰, 서버 재시작 시 위치 소멸
- 목표: 마지막 위치 기억해서 재접속 시 복원
- 방법: Supabase user_metadata에 last_position 저장 (테이블 생성 불필요)
  - `PUT /auth/v1/user` + 유저 JWT로 user_metadata.last_position 업데이트
  - 접속 시 user_metadata에서 last_position 읽어서 스폰 위치로 사용
  - httpx (supabase-py 의존성에 포함) 사용하여 async REST 호출
- 수정 파일: backend/ws/manager.py, backend/ws/endpoint.py
- 참고: service role key 없이 anon key + 유저 토큰으로 가능

### 2. 초기 로딩 시 캐릭터 깜빡임/이동 숨기기
- 위치 복원 구현 후 확인 필요
- 필요 시 Character 컴포넌트에 opacity 0 → 1 트랜지션 추가

### 3. 45도 포즈 (낮은 우선순위)
- 별도 키 매핑으로 대각선 포즈 표시 (이동과 무관)
- 추후 논의 필요

## 기술 메모
- Supabase: anon key만 보유, service role key 없음
- DB 테이블: 없음 (auth만 사용 중)
- 포트: 백엔드 8000, 프론트엔드 3000
- WS 인증 실패(4001) 시 재연결 안 하도록 수정 완료
