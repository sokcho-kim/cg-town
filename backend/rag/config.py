"""RAG 파이프라인 설정 관리 (settings.json 기반)"""
import os
import json

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

KNOWLEDGE_BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "knowledge_base")
FAISS_INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "faiss_index")
SETTINGS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "settings.json")

DEFAULTS = {
    "system_prompt": "당신은 CG Inside 회사의 온보딩 도우미 NPC '호비'입니다.\n신입사원의 질문에 친절하고 정확하게 답변합니다.",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "embedding_model": "text-embedding-3-small",
    "chat_model": "gpt-4o-mini",
    "chat_temperature": 0.3,
    "retrieval_k": 3,
    "show_sources": True,
}


def get_settings() -> dict:
    """settings.json에서 설정을 읽어 반환"""
    if os.path.exists(SETTINGS_PATH):
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            saved = json.load(f)
            return {**DEFAULTS, **saved}
    return DEFAULTS.copy()


def save_settings(settings: dict) -> dict:
    """설정을 settings.json에 저장"""
    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    return settings
