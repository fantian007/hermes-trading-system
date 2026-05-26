"""
简单内存记忆模块

提供基于内存的短期记忆存储，支持存入、检索和清除记忆。
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class MemoryEntry(BaseModel):
    """单条记忆条目"""
    role: str = Field(default="user", description="消息角色：user/assistant/system")
    content: str = Field(..., description="消息内容")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="附加元数据")


class Memory(BaseModel):
    """简单内存记忆，存储对话历史或任务执行记录"""

    storage: List[MemoryEntry] = Field(default_factory=list, description="记忆存储列表")
    max_entries: Optional[int] = Field(default=None, description="最大存储条目数，None表示无限制")

    def add(self, content: str, role: str = "user", metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        添加一条记忆。

        Args:
            content: 记忆内容
            role: 消息角色
            metadata: 附加元数据
        """
        entry = MemoryEntry(
            role=role,
            content=content,
            metadata=metadata or {},
        )
        self.storage.append(entry)

        # 如果设置了最大条目数且超出，移除最旧的条目
        if self.max_entries is not None and len(self.storage) > self.max_entries:
            self.storage.pop(0)

    def get_all(self) -> List[MemoryEntry]:
        """获取所有记忆条目"""
        return self.storage.copy()

    def get_recent(self, n: int = 5) -> List[MemoryEntry]:
        """
        获取最近的n条记忆。

        Args:
            n: 要获取的条目数

        Returns:
            最近的n条记忆条目列表
        """
        return self.storage[-n:].copy()

    def clear(self) -> None:
        """清空所有记忆"""
        self.storage.clear()

    def to_messages(self) -> List[Dict[str, str]]:
        """
        将记忆转换为OpenAI格式的消息列表。

        Returns:
            消息列表，每条包含 role 和 content
        """
        return [
            {"role": entry.role, "content": entry.content}
            for entry in self.storage
        ]

    def __len__(self) -> int:
        return len(self.storage)

    def __bool__(self) -> bool:
        return len(self.storage) > 0
