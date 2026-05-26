"""
Agent基类

使用Pydantic v2定义Agent的数据模型和行为。
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from crewai_trading.core.llm import LLM


class Agent(BaseModel):
    """Agent基类，代表一个具有特定角色和目标的AI智能体"""

    role: str = Field(..., description="Agent的角色身份")
    goal: str = Field(..., description="Agent的核心目标")
    backstory: str = Field(default="", description="Agent的背景故事")
    llm_config: Dict[str, Any] = Field(default_factory=dict, description="LLM配置参数")
    tools: List[Any] = Field(default_factory=list, description="Agent可用的工具列表")

    model_config = {"arbitrary_types_allowed": True}

    def _get_llm(self) -> LLM:
        """根据配置获取LLM实例"""
        return LLM(**self.llm_config)

    def run(self, task_description: str) -> str:
        """
        执行任务：将backstory+goal组装为system消息，task_description作为user消息，调用LLM。

        Args:
            task_description: 任务描述文本

        Returns:
            LLM生成的回复文本
        """
        llm = self._get_llm()

        # 构建system提示词
        system_parts = []
        if self.backstory:
            system_parts.append(self.backstory)
        system_parts.append(f"Your goal: {self.goal}")
        system_prompt = "\n\n".join(system_parts)

        # 如果有工具，在system提示词中说明
        if self.tools:
            tool_names = []
            for t in self.tools:
                if hasattr(t, "name"):
                    tool_names.append(t.name)
                elif hasattr(t, "__name__"):
                    tool_names.append(t.__name__)
                else:
                    tool_names.append(str(t))
            system_prompt += f"\n\nYou have access to the following tools: {', '.join(tool_names)}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task_description},
        ]

        return llm.generate(messages)
