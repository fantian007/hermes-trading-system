"""
Crew基类

使用Pydantic v2定义Crew的数据模型和行为，支持顺序执行任务链。
"""

from typing import List, Dict, Any
from pydantic import BaseModel, Field

from crewai_trading.core.base_agent import Agent
from crewai_trading.core.base_task import Task


class Crew(BaseModel):
    """Crew基类，管理一组Agent和Task的协作执行"""

    agents: List[Agent] = Field(..., description="Crew中的所有Agent")
    tasks: List[Task] = Field(..., description="Crew中的所有Task")
    process: str = Field(default="sequential", description="执行流程（目前仅支持sequential）")
    verbose: bool = Field(default=False, description="是否输出详细日志")

    model_config = {"arbitrary_types_allowed": True}

    def kickoff(self) -> Dict[str, Any]:
        """
        启动Crew执行：按顺序执行所有tasks，每个task的结果传递给下一个task。

        Returns:
            包含每个task执行结果的字典，格式为 {task_index: {"description": ..., "agent_role": ..., "result": ...}}
        """
        if self.process != "sequential":
            raise ValueError(f"Unsupported process type: {self.process}. Only 'sequential' is supported.")

        previous_context = ""
        results = {}

        for i, task in enumerate(self.tasks):
            if self.verbose:
                print(f"[Crew] Executing task {i + 1}/{len(self.tasks)}: {task.description[:60]}...")
                print(f"[Crew] Agent: {task.agent.role}")

            # 将前一个任务的结果作为上下文附加到当前任务的描述中
            enriched_description = task.description
            if previous_context:
                enriched_description = (
                    f"Previous task result (for context):\n{previous_context}\n\n"
                    f"Current task:\n{task.description}"
                )

            # 执行当前任务
            result = task.agent.run(enriched_description)

            # 记录结果
            results[i] = {
                "description": task.description,
                "agent_role": task.agent.role,
                "result": result,
            }

            if self.verbose:
                print(f"[Crew] Task {i + 1} completed. Result length: {len(result)} chars")

            # 将结果作为下一个任务的上下文
            previous_context = result

        return results
