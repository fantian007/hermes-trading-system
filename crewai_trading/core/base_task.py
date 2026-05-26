"""
Task基类

使用Pydantic v2定义Task的数据模型和行为。
"""

from typing import Optional
from pydantic import BaseModel, Field

from crewai_trading.core.base_agent import Agent


class Task(BaseModel):
    """Task基类，代表一个需要由Agent执行的具体任务"""

    description: str = Field(..., description="任务描述")
    agent: Agent = Field(..., description="负责执行此任务的Agent")
    expected_output: str = Field(default="", description="期望的输出描述")

    def execute(self) -> str:
        """
        执行任务：调用绑定的agent来执行任务描述。

        Returns:
            Agent执行任务的返回结果
        """
        result = self.agent.run(self.description)
        return result
