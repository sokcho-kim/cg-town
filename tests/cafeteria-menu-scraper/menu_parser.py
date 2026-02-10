"""GPT-4o Vision으로 메뉴 이미지에서 텍스트 추출"""
import base64
import io
import json
import logging
import re

from PIL import Image
from openai import OpenAI

from config import VLM_PROMPT, VLM_MODEL

logger = logging.getLogger(__name__)


def _crop_top_left(image_bytes: bytes) -> bytes:
    """이미지의 좌측 상단 1/4 (오늘식당 영역)만 크롭한다."""
    img = Image.open(io.BytesIO(image_bytes))
    w, h = img.size
    cropped = img.crop((0, 0, w // 2, h // 2))
    buf = io.BytesIO()
    cropped.save(buf, format="PNG")
    logger.info(f"이미지 크롭: {w}x{h} → {cropped.size[0]}x{cropped.size[1]}")
    return buf.getvalue()


def extract_menu_from_image(image_bytes: bytes) -> dict:
    """이미지를 크롭 후 GPT-4o Vision에 보내 요일별 메뉴 JSON을 추출한다."""
    client = OpenAI()
    cropped_bytes = _crop_top_left(image_bytes)
    base64_image = base64.b64encode(cropped_bytes).decode("utf-8")

    logger.info(f"{VLM_MODEL} Vision 호출 중...")
    response = client.chat.completions.create(
        model=VLM_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": VLM_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}",
                            "detail": "high",
                        },
                    },
                ],
            }
        ],
        max_tokens=2000,
        temperature=0.1,
    )

    raw_text = response.choices[0].message.content
    logger.info(f"VLM 응답 수신: {len(raw_text)} chars")
    return _parse_vlm_response(raw_text)


def _parse_vlm_response(raw_text: str) -> dict:
    """VLM 응답에서 JSON을 파싱한다."""
    # 마크다운 코드 블록 제거
    cleaned = re.sub(r"```json\s*", "", raw_text)
    cleaned = re.sub(r"```\s*", "", cleaned)
    cleaned = cleaned.strip()

    try:
        result = json.loads(cleaned)
        logger.info(f"메뉴 파싱 성공: {result.get('week_title', 'unknown')}")
        return result
    except json.JSONDecodeError as e:
        logger.warning(f"JSON 파싱 실패: {e}")
        return {
            "week_title": "파싱 실패",
            "period": "",
            "menus": {},
            "raw_text": raw_text,
        }
