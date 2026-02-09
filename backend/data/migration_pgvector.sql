-- ============================================
-- pgvector 마이그레이션: 지식베이스 + 벡터 검색
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. pgvector 확장 활성화
create extension if not exists vector;

-- 2. 지식베이스 문서 테이블
create table if not exists knowledge_documents (
  id uuid default gen_random_uuid() primary key,
  filename text not null unique,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 문서 청크 + 임베딩 테이블 (text-embedding-3-small = 1536 차원)
create table if not exists knowledge_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references knowledge_documents(id) on delete cascade,
  content text not null,
  metadata jsonb default '{}',
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 4. 벡터 검색 인덱스 (HNSW - 빠르고 정확)
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- 5. 유사도 검색 함수
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.3,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 6. updated_at 자동 갱신 트리거
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger knowledge_documents_updated_at
  before update on knowledge_documents
  for each row execute function update_updated_at();

-- 7. RLS 정책 (서비스 키 사용 시 bypass되지만, 안전을 위해)
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

-- 인증된 사용자는 읽기 가능
create policy "Authenticated users can read documents"
  on knowledge_documents for select
  to authenticated
  using (true);

create policy "Authenticated users can read chunks"
  on knowledge_chunks for select
  to authenticated
  using (true);

-- service_role만 쓰기 가능
create policy "Service role can manage documents"
  on knowledge_documents for all
  to service_role
  using (true)
  with check (true);

create policy "Service role can manage chunks"
  on knowledge_chunks for all
  to service_role
  using (true)
  with check (true);
