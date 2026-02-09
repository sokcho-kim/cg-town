"""OpenAI 임베딩 모델 초기화"""
from langchain_openai import OpenAIEmbeddings
from rag.config import OPENAI_API_KEY, get_settings

_cached_embeddings: OpenAIEmbeddings | None = None
_cached_model: str | None = None


def get_embeddings() -> OpenAIEmbeddings:
    """임베딩 모델 인스턴스 반환 (모델 변경 시 자동 갱신)"""
    global _cached_embeddings, _cached_model
    settings = get_settings()
    model = settings["embedding_model"]
    if _cached_embeddings is None or _cached_model != model:
        _cached_embeddings = OpenAIEmbeddings(
            model=model,
            openai_api_key=OPENAI_API_KEY,
        )
        _cached_model = model
    return _cached_embeddings
