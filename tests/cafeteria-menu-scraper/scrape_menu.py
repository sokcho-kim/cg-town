"""식당 메뉴 스크래핑 메인 파이프라인

사용법:
    python scrape_menu.py                    # 스크래핑 + 백엔드 저장
    python scrape_menu.py --dry-run          # 스크래핑만 (저장 안 함)
"""
import argparse
import json
import logging
import os
import sys

import requests
from dotenv import load_dotenv

from scraper import fetch_latest_post, fetch_image_url, download_image
from menu_parser import extract_menu_from_image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def save_to_backend(menu_data: dict, post_title: str, post_date: str) -> dict:
    """추출된 메뉴를 백엔드 API에 저장한다."""
    api_url = os.environ.get("BACKEND_API_URL", "http://localhost:8000")
    scraper_key = os.environ.get("SCRAPER_SECRET_KEY", "")

    payload = {
        "post_title": post_title,
        "post_date": post_date,
        "week_title": menu_data.get("week_title", ""),
        "period": menu_data.get("period", ""),
        "menus": menu_data.get("menus", {}),
    }

    resp = requests.post(
        f"{api_url}/api/menu/weekly",
        json=payload,
        headers={"X-Scraper-Key": scraper_key},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def run_scrape(dry_run: bool = False) -> dict:
    """메인 스크래핑 파이프라인"""
    # 1. 최신 게시글 조회
    post = fetch_latest_post()
    if not post:
        logger.warning("게시글을 찾을 수 없습니다.")
        return {"status": "no_posts"}

    # 2. 이미지 URL 추출
    image_path = fetch_image_url(post["seqNo"])
    if not image_path:
        logger.error("이미지 URL을 추출할 수 없습니다.")
        return {"status": "no_image"}

    # 3. 이미지 다운로드
    image_bytes = download_image(image_path)
    if not image_bytes:
        logger.error("이미지 다운로드 실패")
        return {"status": "image_download_failed"}

    # 4. VLM으로 메뉴 추출
    menu_data = extract_menu_from_image(image_bytes)
    logger.info(f"추출 결과:\n{json.dumps(menu_data, ensure_ascii=False, indent=2)}")

    if dry_run:
        logger.info("--dry-run 모드: 백엔드 저장을 건너뜁니다.")
        return {"status": "dry_run", "menu_data": menu_data}

    # 5. 백엔드에 저장
    result = save_to_backend(
        menu_data=menu_data,
        post_title=post["title"],
        post_date=post.get("createDateTime", ""),
    )
    logger.info(f"백엔드 저장 완료: {result}")
    return {"status": "success", "post_title": post["title"]}


if __name__ == "__main__":
    load_dotenv()

    parser = argparse.ArgumentParser(description="식당 메뉴 스크래퍼")
    parser.add_argument("--dry-run", action="store_true", help="스크래핑만 하고 저장하지 않음")
    args = parser.parse_args()

    result = run_scrape(dry_run=args.dry_run)
    if result["status"] not in ("success", "dry_run"):
        sys.exit(1)
