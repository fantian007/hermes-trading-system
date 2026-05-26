"""
LLM封装模块

使用OpenAI兼容接口调用DeepSeek API，支持 system/user/tool 消息格式。
"""

from typing import Optional, List, Dict, Any
from openai import OpenAI


class LLM:
    """DeepSeek LLM包装器，使用OpenAI兼容接口"""

    def __init__(
        self,
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com/v1",
        api_key: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ):
        """
        初始化LLM实例。

        Args:
            model: 模型名称，默认 deepseek-chat
            base_url: API基础URL
            api_key: API密钥，默认从环境变量 DEEPSEEK_API_KEY 获取
            temperature: 生成温度
            max_tokens: 最大生成token数
            **kwargs: 传递给OpenAI客户端的其他参数
        """
        self.model = model
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens

        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key,
            **kwargs,
        )

    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        生成LLM回复。

        Args:
            messages: 消息列表，每条包含 role (system/user/tool) 和 content
            temperature: 覆写实例的temperature
            max_tokens: 覆写实例的max_tokens

        Returns:
            模型生成的文本内容
        """
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature if temperature is not None else self.temperature,
            max_tokens=max_tokens if max_tokens is not None else self.max_tokens,
        )

        return response.choices[0].message.content or ""

    def __call__(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """便捷调用方式，直接调用 generate"""
        return self.generate(messages, **kwargs)
