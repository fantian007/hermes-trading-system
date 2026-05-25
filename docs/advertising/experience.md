---

## 2026-05-24 — SMCI.US 重新投票通知
- 起因: 选举委员会重新投票结果通知 (ELEC-20260524-0135)
- 结果: SMCI.US BUY, 3票赞成 0票反对, 已提交执行部门
- 卡片颜色: 紫色 (选举)
- 发送状态: 成功 (message_id: om_x100b6e123fe0e930b30baf1266cf277)
## 2026-05-24 — 策略组股池分析分配通知 (策略部门调度通报)

**背景**: 策略组长 AGT-001 完成股池分析分配，6位分析师各领任务。
**内容**: 21只候选股全 BULLISH 主导，分析师分配明细（MACD/RSI/布林带/海龟/均线等）。
**卡片颜色**: 蓝色（状态/调度类）
**发送方案**: 用内联 Node.js 脚本直接调飞书 API 代替 npx tsx 方式更可靠（避免 tsx 冷启动超时）。
**去重**: 与上次 strategy-director pool_analysis_assignment 卡片（10:49）间隔 < 30分钟但内容不同，属于新一轮分析分配，发送。
**消息 ID**: om_x100b6e12c04cfd34b3412ab29ac0e73

## 2026-05-24 — BKT-001 第4轮CEO宣讲自检通知

**背景：** BKT-001 完成第4轮CEO宣讲自检，6项全过。含守护进程 crash-reclaim 循环但不影响实际回测。

**可行方案：** 使用紫色卡片（选举/宣讲类），构造 card JSON → `cat card.json | npx tsx src/scripts/send-card.ts` 发送。
  注意 npx tsx 启动 tsx 需要 10-30s 冷启动时间，设置 timeout >= 60s。
  消息 ID 返回在 stdout JSON 中。

## 2026-05-24 — 策略Agent批量崩溃+自动重启通知

**背景**: 12:45 左右，AGT-002(MACD)/AGT-003(RSI)/AGT-004(布林带) 三个策略分析Agent同时崩溃(exit code 1)，同时HR-001也因协议违例(rc=0)被重建。

**处理**: Dispatcher自动重试，所有Agent在~12:48重新上线运行。

**通知策略**:
- 使用蓝色卡片（状态/调度类）— Agent崩溃后自动恢复，非熔断级别
- 卡片内容包含: 哪些Agent崩溃、是否已自动恢复、当前状态概览
- 去重检查: last cache是选举紫色卡片(12:30)，不同事件类型、间隔约20分钟 → 发送
- 发送后更新cache

**经验**: 
- 周日休市期间Agent crash不是交易紧急事件，蓝色卡片够用
- 所有crash+respawn在~3秒内完成，Dispatcher自动处理
- 如果同一Agent连续崩溃>2次，应升级为橙色警告，通知CEO

## 2026-05-24 — CRM.US BUY 跨周末执行流程

**背景：** CRM.US BUY 在周末通过投票和风控，但实际执行要等下周二（5/26）开盘。

**流程链路：**
1. ELC 投票 → EXE-001 风控通过 → data-agent 创建预约任务（t_25ed93e4）
2. data-agent 在周二开盘执行买入 → 通知 EXE-001
3. EXE-001 确认交易结果 → 通过 kanban 通知 ADV-001（本任务）
4. ADV-001 发飞书卡片

**经验：**
- 交易在休市期通过风控时，data-agent 创建预约任务，实际执行在下一个交易日
- ADV-001 收到通知后无需立即发送，只需注册等待状态、保持心跳
- 后续交易卡片用 **绿色**（交易/买入）
# 如果 EXE-001 的通知在 data-agent 执行前到达，说明只是状态通告，注意判断实际交易是否已发生
# ```

## 2026-05-26 — ORCL.US BUY 失败通知（longbridge skill缺失）

**背景：** ORCL.US BUY 1 股执行失败，原因：longbridge skill 未配置。原任务 t_f9d134be 已归档（70+次崩溃后清理）。

**处理流程：**
1. 去重检查：last cache 为 pool_maintenance（01:00），不同事件 → 发送
2. 卡片类型：橙色（警告/系统失败）
3. 发送方式：build card JSON → `cat /tmp/orcl_fail_card.json | npx tsx src/scripts/send-card.ts`
4. 发送成功（message_id: om_x100b6e738a91f138c45c7341613ad67）
5. 按升级链通知 CEO（kanban_create t_a3780a2f），由CEO决策是否需用户介入

**经验：**
- longbridge skill 缺失属于系统配置问题，广告部无法自愈 → 必须升级给CEO
- 橙色卡片适合交易执行类失败（非熔断级别）
| 73|- 卡片中明确指出需要用户决定的选项（重新买入/放弃），方便CEO/用户快速决策

## 2026-05-26 — ADV-001 连续 crash 后重跑的频繁去重

**背景：** CEO每日报告任务 t_c2e06486 在 00:31–00:44 间连续 crash 4 次（pid 11151, 22439, 36190, 41800），dispatch 每次重跑都看到任务已由 run 1389 发送完成，然后去重跳过。

**症状：**
- 同一任务 4 次被 dispatch → spawn → crash → reclaim → 再次 spawn 循环
- crash 原因："pid not alive" — 可能是子进程 OOM 或 daemon.ts 资源竞争
- 每次重跑都正确进行了去重判断并跳过，不产生重复飞书消息

**经验：**
- 去重逻辑在这种 crash-reclaim 循环中至关重要 — 避免同一内容重复推送
- 如果自己连续 crash 重建，无需每次重新发飞书通知，评论记录即可
- 建议持续 crash > 5 次/小时 → 升级给 CEO 判断是否需要重建 profile