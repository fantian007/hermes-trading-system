"""
CrewAI Trading System — LLM封装
使用OpenAI兼容接口调用DeepSeek API，支持 system/user/tool 消息格式。
"""

from typing import List, Dict, Optional, Any
from openai import OpenAI


class LLM:
    """DeepSeek LLM包装器，使用OpenAI兼容接口"""

    _VALID_OPENAI_KWARGS = {'api_key', 'base_url', 'organization', 'timeout', 'max_retries', 'default_headers', 'default_query'}

    def __init__(
        self,
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com/v1",
        api_key: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        api_key_env_var: str = "DEEPSEEK_API_KEY",
        **kwargs: Any,
    ):
        self.model = model
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens

        if api_key is None:
            import os
            api_key = os.environ.get(api_key_env_var, "")

        valid_kwargs = {k: v for k, v in kwargs.items() if k in self._VALID_OPENAI_KWARGS}

        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key,
            **valid_kwargs,
        )

    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature if temperature is not None else self.temperature,
            max_tokens=max_tokens if max_tokens is not None else self.max_tokens,
        )
        return response.choices[0].message.content or ""

    def __call__(self, messages: List[Dict[str, str]], **kwargs: Any) -> str:
        return self.generate(messages, **kwargs)
