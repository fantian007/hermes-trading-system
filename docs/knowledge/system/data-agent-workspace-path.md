# Longbridge Auth in Hermes Profiles — 补充：Data-agent Scratch Workspace 路径问题

> 2026-05-24 — 记录于 EXE-001 首次启动调试

## 问题

给 data-agent 创建任务时，body 中使用相对路径（如 `npx tsx src/scripts/data-service.ts`）会 crash，因为 data-agent 的 scratch workspace 是临时空目录，找不到脚本。

即使 body 中写了 `cd /Users/zys/workspace/hermes-trading-system && npx tsx ...` 仍然 crash（exit code 1），怀疑是 data-agent 自身的 shell 环境（非交互式 shell）或 env 问题。

## 规避方法

如果 data-agent 一直 crash：
1. 确保任务 body 中使用**绝对路径**或先 `cd` 到项目目录
2. 如果还不行，执行部门可以自行通过 `npx tsx src/scripts/data-service.ts` 在项目目录中直接运行来查询行情（仅限查询，不代替下单）
3. 下单操作必须通过 data-agent 进行（约定）

## 根本原因

尚未确定。可能与 data-agent 的 Hermes profile 配置中 `$PATH` 不完整、或 `npx` 在以非交互方式运行时找不到 `tsx` 有关。
