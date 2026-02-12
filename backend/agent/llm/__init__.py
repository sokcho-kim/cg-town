"""LLM 프로바이더 팩토리."""

from agent.llm.base import BaseLLM


def get_llm(provider: str, **kwargs) -> BaseLLM:
    """프로바이더 이름으로 LLM 인스턴스를 생성한다.

    Args:
        provider: "openai" | "gemini" | "claude"
        **kwargs: 프로바이더별 설정 (model, temperature, api_key 등)
    """
    if provider == "openai":
        from agent.llm.openai_llm import OpenAILLM
        return OpenAILLM(**kwargs)
    elif provider == "gemini":
        from agent.llm.gemini_llm import GeminiLLM
        return GeminiLLM(**kwargs)
    elif provider == "claude":
        from agent.llm.claude_llm import ClaudeLLM
        return ClaudeLLM(**kwargs)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


__all__ = ["BaseLLM", "get_llm"]
