-- NPC 대화 히스토리 테이블
CREATE TABLE npc_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_npc_chat_user ON npc_chat_messages(user_id, created_at DESC);

-- RLS 정책: 본인 대화만 조회 가능
ALTER TABLE npc_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat" ON npc_chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat" ON npc_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- service_role은 RLS 무시하므로 별도 정책 불필요
