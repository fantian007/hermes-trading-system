# 选举委员会学习笔记

## 2026-05-24 — v4.4 架构文档学习

### 关键知识点

1. **加权公式确认**: `agent_weight = win_rate × log₂(1 + total_trades)`，初次交易权重 = 0.5
2. **经验积累机制**: 试错→记录→检索→复用。新问题先查 `docs/election/experience.md` 和 `docs/knowledge/` 跨部门知识库，查不到才自己探索
3. **跨部门知识库分类**: docs/knowledge/INDEX.md 分四大类（HR/Trading/System/Risk），有价值经验可写入对应分类

### 待深入研究

- session_search 如何联动知识库检索（6B.3 后续规划）
- 跨部门经验写入后如何通知 HR 更新 INDEX.md
