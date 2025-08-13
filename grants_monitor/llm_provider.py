from __future__ import annotations
import os
from typing import Optional

from .config import LLM_PROVIDER, OPENAI_MODEL, OPENAI_API_KEY, AGENT_LLM_TIMEOUT

# browser_use LLM wrappers
from browser_use.llm.openai.chat import ChatOpenAI


def get_llm(model: Optional[str] = None):
    provider = LLM_PROVIDER.lower()
    if provider == "openai":
        api_key = OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for LLM provider 'openai'")
        return ChatOpenAI(model=model or OPENAI_MODEL, api_key=api_key, timeout=AGENT_LLM_TIMEOUT)

    raise NotImplementedError(f"LLM provider '{LLM_PROVIDER}' not supported yet")