-- ============================================
-- 하이브리드 검색: pgvector + tsvector (키워드)
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. knowledge_chunks에 키워드 검색용 tsvector 컬럼 추가
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS content_fts tsvector;

-- 2. GIN 인덱스 (키워드 검색 고속화)
CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
  ON knowledge_chunks USING GIN (content_fts);

-- 3. INSERT/UPDATE 시 자동 tsvector 생성 트리거
CREATE OR REPLACE FUNCTION kb_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.content_fts := to_tsvector('simple', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_chunks_tsvector ON knowledge_chunks;
CREATE TRIGGER knowledge_chunks_tsvector
  BEFORE INSERT OR UPDATE ON knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION kb_tsvector_trigger();

-- 4. 기존 데이터에 tsvector 채우기
UPDATE knowledge_chunks
SET content_fts = to_tsvector('simple', COALESCE(content, ''))
WHERE content_fts IS NULL;

-- 5. 하이브리드 검색 RPC 함수 (벡터 + 키워드 → RRF 병합)
CREATE OR REPLACE FUNCTION match_knowledge_hybrid(
  query_embedding vector(1536),
  query_text text,
  match_count int default 5,
  vector_weight float default 0.7,
  keyword_weight float default 0.3,
  rrf_k int default 60
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  search_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- 벡터 검색 (코사인 유사도)
  vector_results AS (
    SELECT
      kc.id,
      kc.content,
      kc.metadata,
      1 - (kc.embedding <=> query_embedding) AS score,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> query_embedding) AS rank
    FROM knowledge_chunks kc
    WHERE kc.embedding IS NOT NULL
    LIMIT match_count * 2
  ),
  -- 키워드 검색 (tsvector)
  keyword_results AS (
    SELECT
      kc.id,
      kc.content,
      kc.metadata,
      ts_rank(kc.content_fts, websearch_to_tsquery('simple', query_text)) AS score,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(kc.content_fts, websearch_to_tsquery('simple', query_text)) DESC
      ) AS rank
    FROM knowledge_chunks kc
    WHERE kc.content_fts @@ websearch_to_tsquery('simple', query_text)
    LIMIT match_count * 2
  ),
  -- RRF (Reciprocal Rank Fusion) 병합
  combined AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.content, k.content) AS content,
      COALESCE(v.metadata, k.metadata) AS metadata,
      COALESCE(vector_weight / (rrf_k + v.rank), 0) +
      COALESCE(keyword_weight / (rrf_k + k.rank), 0) AS rrf_score,
      CASE
        WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 'hybrid'
        WHEN v.id IS NOT NULL THEN 'vector'
        ELSE 'keyword'
      END AS search_type
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  )
  SELECT
    combined.id,
    combined.content,
    combined.metadata,
    combined.rrf_score AS similarity,
    combined.search_type
  FROM combined
  ORDER BY combined.rrf_score DESC
  LIMIT match_count;
END;
$$;
