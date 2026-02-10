"""게시판 스크래핑: 최신 글 조회 → 이미지 다운로드"""
from __future__ import annotations

import logging
import time

import requests
from bs4 import BeautifulSoup

from config import BASE_URL, BOARD_LIST_URL, BOARD_LIST_PARAMS

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


def _get_with_retry(url: str, **kwargs) -> requests.Response:
    """GET 요청 + 재시도"""
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, timeout=30, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY * (2 ** attempt)
                logger.warning(f"요청 실패 (시도 {attempt + 1}/{MAX_RETRIES}): {e}, {delay}초 후 재시도")
                time.sleep(delay)
            else:
                raise


def fetch_latest_post() -> dict | None:
    """게시판에서 최신 글 메타데이터를 가져온다."""
    resp = _get_with_retry(BOARD_LIST_URL, params=BOARD_LIST_PARAMS)
    data = resp.json()

    contents = data.get("data", {}).get("contents", [])
    if not contents:
        logger.warning("게시글이 없습니다.")
        return None

    post = contents[0]
    logger.info(f"최신 글: {post['title']} (seqNo={post['seqNo']}, date={post.get('createDateTime', '')})")
    return post


def fetch_image_url(seq_no: int) -> str | None:
    """게시글 상세에서 이미지 URL을 추출한다."""
    url = f"{BASE_URL}/api/cportal/board/{seq_no}"
    resp = _get_with_retry(url)
    data = resp.json()

    html_content = data.get("data", {}).get("contents", {}).get("contents", "")
    if not html_content:
        logger.warning("게시글 본문이 비어 있습니다.")
        return None

    soup = BeautifulSoup(html_content, "html.parser")
    img = soup.find("img", src=True)
    if not img:
        logger.warning("이미지를 찾을 수 없습니다.")
        return None

    return img["src"]


def download_image(image_path: str) -> bytes | None:
    """이미지를 다운로드한다."""
    url = BASE_URL + image_path if image_path.startswith("/") else image_path
    logger.info(f"이미지 다운로드: {url}")

    resp = _get_with_retry(url)
    if not resp.content:
        logger.warning("이미지 데이터가 비어 있습니다.")
        return None

    logger.info(f"다운로드 완료: {len(resp.content):,} bytes")
    return resp.content
