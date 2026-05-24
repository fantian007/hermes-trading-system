# 系统异常处理手册 v1.0

> 维护: CEO-001 / HR-001 | 更新: 2026-05-23
> 全员宣讲时按本文档逐项核对

---

## 一、Agent 崩溃

| 症状 | 诊断 | 处理 |
|------|------|------|
| kanban show 显示 `crashed` | 进程意外退出 | archive → 创建新任务 |
| kanban show 显示 `gave_up` | 连续 crash >2次 | 查 gateway.error.log 根因 → 修复后重建 |
| 同一 Agent 崩溃 >5次 | 配置/代码有 bug | 检查 profile 语法 → 简化 prompt → 重建 |
| 崩溃后无法自愈 | 网络/API/资源问题 | CEO 红色飞书通知用户 |

---

## 二、Agent 卡死

| 症状 | 诊断 | 处理 |
|------|------|------|
| running >2小时未完成 | 死循环 | kill 进程 → archive → 重建 |
| running 但无日志输出 | 阻塞在工具调用 | 检查 gateway.error.log → 超时则 kill |
| running 但重复同一操作 >10次 | 逻辑循环 | kill → 简化任务 body → 重建 |
| 多个 Agent 同时卡死 | 资源耗尽 | 降低并发 → 分批重建 |

---

## 三、心跳异常

| 症状 | 诊断 | 处理 |
|------|------|------|
| 某 Agent >3分钟无 heartbeat | Agent 假死 | 判定死亡 → archive → 重建 |
| 所有 Agent 无 heartbeat | Gateway 派遣器故障 | 重启 gateway |
| heartbeat 日志为空 | kanban_heartbeat 未启用 | 检查 profile 是否有心跳指令 |

---

## 四、审批阻塞

| 症状 | 诊断 | 处理 |
|------|------|------|
| gateway.error.log 含 `pending_approval` | 命令等待人工审批 | `hermes config set approvals.mode smart` |
| 频繁出现 approval | 审批模式过严 | 切换为 smart / 对 cron 用 deny |
| 单个命令反复被拒 | 危险命令误判 | 加入 command_allowlist |

---

## 五、飞书断连

| 症状 | 诊断 | 处理 |
|------|------|------|
| SSL/EOF 错误 | 网络波动 | 重试 3 次；仍失败重启 gateway |
| 消息发送返回非 0 code | API 异常 | 检查 token 是否过期 → 刷新 |
| 用户收不到消息 | 去重规则误杀 | 检查 /tmp/hermes_ad_last.json |
| Websocket 断开 | 飞书侧重连 | gateway 自动重连；连续失败 >3次重启 |

---

## 六、选举与交易异常

| 症状 | 诊断 | 处理 |
|------|------|------|
| ELC 一直 running 不出结果 | 投票卡死 | kill → archive → 重建 ELC 任务 |
| 投票通过但不执行 | execution-agent 未响应 | 检查 execution 任务 → 重建 |
| 交易下单失败 | 长桥 API 异常 | 查 error 码 → 重试 → 飞书通知用户 |
| 同一标的反复投票 | 冷却机制失效 | 检查 trigger-vote.ts 冷却检查 |

---

## 七、数据异常

| 症状 | 诊断 | 处理 |
|------|------|------|
| data-agent 无响应 | 任务 blocked/crashed | 解封/重建 |
| 行情数据返回空 | 长桥 CLI 未登录 | `longbridge check` → 通知用户重新 auth |
| 数据库操作失败 | SQLite 文件损坏 | 通知用户手动修复 |
| 缓存数据过期 | 市场已变化 | Agent 自行判断刷新 |

---

## 八、配置漂移

| 症状 | 诊断 | 处理 |
|------|------|------|
| Agent 行为异常但无 crash | prompt 过期 | 对比 profiles/*.yaml → 重新注入 |
| hermes config 与 YAML 不一致 | 手动修改未同步 | 以 YAML 为准 → 重新 hermes config set |
| 新规则未生效 | Gateway 未重启 | 注入后重启 gateway |

---

## 九、文档异常

| 症状 | 诊断 | 处理 |
|------|------|------|
| 部门文档缺失 | Agent 未创建 | CEO 通知该部门补写 |
| 文档内容过时 | 超过 1 周未更新 | 组长在周一时更新 |
| policy.md 与实际不一致 | 规则变更未同步 | HR 更新 policy.md → 全员学习 |

---

---

## 十、审核异常

| 症状 | 诊断 | 处理 |
|------|------|------|
| 审核数据获取失败 | data-agent 超时无返回 | 检查 data-agent 任务状态 → 重建 data-agent 任务 → 审核官重试 |
| 审核框架不适配 | 如海龟框架用于非突破型交易，产生无效信号 | 审核官自行判断跳过不适配框架，在 review_reports 中注明 `N/A` |
| 审核报告写入数据库失败 | review_reports 表写入返回错误 | 检查数据库连接 → 重试写入 → 如连续失败阻塞任务并通知 review-01 |
| 审核超时 | review_reports 未在规定时间内提交 | review-01 检查审核官任务 → 确认是否卡死 → kill + 重建 |

---

## 十一、升级流程

```
Agent 自检异常
  → 自己修
    → 修不了 → 报告组长 strategy-01
      → 组长修不了 → 报告 CEO
        → CEO 按本手册处理
          → CEO 修不了 → 飞书红色卡片通知用户
```

## 十二、恢复验证

每次修复后必须验证：
1. Agent 重建后 1 分钟内开始 running
2. 心跳恢复正常（gateway.log 出现 heartbeat）
3. 飞书通知用户（如涉及交易/状态变更）
4. CEO 下轮巡检确认无复发
