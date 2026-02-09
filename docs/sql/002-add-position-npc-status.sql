-- 002-add-position-npc-status.sql
-- profiles 테이블에 직급, NPC 여부, 상태 메시지 컬럼 추가
--
-- position: 직급 (대표, 이사, 팀장, 사원 등)
-- is_npc: NPC 여부 (기본값 false)
-- status_message: 머리 위에 표시할 상태 메시지 (휴가, 외근, 파견 등)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS position text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_npc boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_message text DEFAULT '';

-- RLS 정책은 기존 profiles 테이블 정책을 따릅니다.
-- 새 컬럼은 기존 SELECT/UPDATE 정책에 자동으로 포함됩니다.
