# 오늘 식당 메뉴 스크래핑

## 목적
오늘의 식당 메뉴 정보를 웹에서 자동으로 스크래핑하여 NPC 말풍선에 표시합니다.

## 구조

```
scrape_menu.py      # 메인 파이프라인 (실행 진입점)
├── scraper.py      # 게시판 API → 최신 글 → 이미지 다운로드
├── menu_parser.py  # GPT-4o-mini Vision → 요일별 메뉴 JSON
└── config.py       # URL, 프롬프트, 상수
```

## 사용법

```bash
# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정 (.env 파일 또는 export)
export OPENAI_API_KEY=sk-...
export BACKEND_API_URL=http://localhost:8000
export SCRAPER_SECRET_KEY=your-secret-key

# 스크래핑만 테스트 (백엔드 저장 안 함)
python scrape_menu.py --dry-run

# 스크래핑 + 백엔드 저장
python scrape_menu.py
```

## 데이터 흐름

1. 키친인큐베이터 게시판에서 최신 글 조회
2. 게시글 본문에서 메뉴 이미지 URL 추출
3. 이미지 다운로드 → GPT-4o-mini Vision으로 텍스트 추출
4. 백엔드 `/api/menu/weekly`로 POST
5. 백엔드에서 자동으로:
   - `cafeteria_menus` 테이블에 저장
   - NPC 호비 상태 메시지 업데이트
   - RAG 지식베이스(`식단표.md`) 업데이트

## 백엔드 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/menu/today` | GET | 오늘의 메뉴 조회 |
| `/api/menu/weekly/latest` | GET | 최신 주간 전체 메뉴 |
| `/api/menu/weekly` | POST | 주간 메뉴 저장 (스크래퍼용) |

## 참고
- 비용: GPT-4o-mini 주 1회 호출 기준 월 ~12원
- 공지사항은 추후 hiworks 연동 시 구현 예정입니다.
