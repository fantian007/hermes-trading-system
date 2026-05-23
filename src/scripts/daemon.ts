/**
 * 24H 调度守护进程 (兼容别名)
 *
 * 已迁移至 src/scripts/scheduler.ts。保留此文件作为向后兼容入口。
 *
 * 用法：
 *   node --import tsx src/scripts/daemon.ts     → 等同 scheduler.ts
 *   node --import tsx src/scripts/daemon.ts --once
 */
import './scheduler.js';
