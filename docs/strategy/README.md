# 策略部门概述 — Strategy Department

## 成员
- Strategy-01: 组长，调度
- AGT-002: MACD金叉/死叉策略分析师
- AGT-008: RSI超买超卖策略分析师（原工号AGT-003,2026-05-24入职）
- AGT-004: 布林带策略分析师
- AGT-005: 海龟策略分析师
- AGT-006: 价格异动策略分析师
- AGT-007: 均线交叉策略分析师

## 分工
- AGT-002: 全股池MACD分析，发现BUY/SELL信号→创建选举轮次→通知ELC
- AGT-003: 全股池RSI分析
- AGT-004: 全股池布林带分析
- AGT-005: 全股池海龟策略分析
- AGT-006: 全股池价格异动监控
- AGT-007: 全股池均线交叉分析

## 数据来源
- 股池: sentiment-pool.ts --list
- 行情: longbridge CLI 直接查询
- 缓存: /tmp/hermes_macd_cache.json, /tmp/hermes_rsi_cache.json 等

## 跨Agent通信
- 使用 Kanban 任务机制：kanban_create → agent自行拾取
- 广告通知：直接创建广告部门任务(assignee=advertising-agent)
- 选举投票：创建ELC任务(assignee=election-committee)
- 数据/下单请求：创建data-agent任务
- 所有操作结果通过任务评论传递，需通知广告部
