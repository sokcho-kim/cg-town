-- 식당 메뉴 스크래핑 데이터 저장 테이블
CREATE TABLE cafeteria_menus (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_title text NOT NULL UNIQUE,          -- 게시글 제목 (중복 방지 키)
    post_date text,                            -- 원본 게시일
    week_title text,                           -- 파싱된 주차 제목
    period text,                               -- "2025-02-10 ~ 2025-02-14"
    menus jsonb NOT NULL DEFAULT '{}',         -- { "월": { "date": "...", "lunch": [...] }, ... }
    scraped_at date NOT NULL DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cafeteria_menus_scraped_at ON cafeteria_menus (scraped_at DESC);
