/**
 * Advertising Notification Generator — 广告通知生成器
 *
 * ADV-001 的主模块。所有 Agent 的通知经由此模块排版后发送。
 *
 * 架构：
 *   分析结果 → 模板渲染 → 渠道发送（带重试）→ 飞书
 *
 * 用法：
 *   import { advertising } from './advertising/index.js';
 *   await advertising.notifyAnalysis(result);
 *   await advertising.notifyBatch(results);
 *   await advertising.send(payload);
 */

import type {
  TurtleAnalysisResult,
  NotificationPayload,
  SendResult,
  ChannelType,
  ChannelAdapter,
  AdvertisingConfig,
  RetryConfig,
  QuoteSnapshot,
} from './types.js';
import { DEFAULT_AD_CONFIG, DEFAULT_RETRY } from './types.js';
import {
  renderTurtleSignal,
  renderTurtleDetail,
  renderPortfolioSummary,
  renderBatchScan,
  renderQuoteAlert,
  renderSystemStatus,
  renderGeneric,
  type PortfolioSummary,
  type BatchScanItem,
  type SystemStatusEvent,
} from './templates.js';

// ═══════════════════════════════════════════════════════════════════
//  Channel Registry — 渠道注册表
// ═══════════════════════════════════════════════════════════════════

class ChannelRegistry {
  private channels = new Map<ChannelType, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.channels.set(adapter.type, adapter);
  }

  get(type: ChannelType): ChannelAdapter | undefined {
    return this.channels.get(type);
  }

  list(): ChannelType[] {
    return Array.from(this.channels.keys());
  }

  async init(config: AdvertisingConfig): Promise<void> {
    for (const ct of config.channels) {
      if (this.channels.has(ct)) continue; // 已注册

      if (ct === 'feishu_card') {
        const { FeishuCardChannel } = await import('./channels/feishu-card.js');
        this.register(new FeishuCardChannel());
      } else if (ct === 'feishu_text') {
        const { FeishuTextChannel } = await import('./channels/feishu-text.js');
        this.register(new FeishuTextChannel());
      } else if (ct === 'console') {
        const { ConsoleChannel } = await import('./channels/console.js');
        this.register(new ConsoleChannel());
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Retry Engine — 带指数退避重试
// ═══════════════════════════════════════════════════════════════════

async function sendWithRetry(
  payload: NotificationPayload,
  channel: ChannelAdapter,
  retry: RetryConfig = DEFAULT_RETRY,
): Promise<SendResult> {
  const start = Date.now();
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    try {
      const messageId = await channel.send(payload);

      if (messageId) {
        return {
          success: true,
          channel: channel.type,
          messageId,
          attempts: attempt,
          durationMs: Date.now() - start,
        };
      }

      // send 返回 undefined（非异常失败，如飞书 API 返回错误码）
      lastError = `channel ${channel.type} returned no message_id`;
    } catch (err: any) {
      lastError = err.message ?? String(err);
    }

    if (attempt < retry.maxAttempts) {
      // 指数退避：1s → 2s → 4s ... 上限 maxDelayMs
      const delay = Math.min(
        retry.baseDelayMs * Math.pow(2, attempt - 1),
        retry.maxDelayMs,
      );
      console.warn(
        `[advertising] 发送失败 (${attempt}/${retry.maxAttempts}): ${lastError}, ${delay}ms 后重试`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return {
    success: false,
    channel: channel.type,
    error: lastError ?? 'unknown error',
    attempts: retry.maxAttempts,
    durationMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  Advertising Engine
// ═══════════════════════════════════════════════════════════════════

export class AdvertisingEngine {
  private registry = new ChannelRegistry();
  private config: AdvertisingConfig;

  constructor(config: Partial<AdvertisingConfig> = {}) {
    this.config = { ...DEFAULT_AD_CONFIG, ...config };
  }

  async start(): Promise<void> {
    await this.registry.init(this.config);
  }

  // ── 发送单个通知到所有启用的渠道 ──

  async send(payload: NotificationPayload): Promise<SendResult[]> {
    if (this.registry.list().length === 0) {
      console.warn('[advertising] 无可用渠道，通知未发送');
      return [];
    }

    const results: SendResult[] = [];
    const sorted = [...this.config.channels];

    // 高优先级：只发 feishu_card（卡片更醒目）
    const isHighPriority = (payload.priority ?? 0) >= 7;

    for (const ct of sorted) {
      const channel = this.registry.get(ct);
      if (!channel) continue;

      const result = await sendWithRetry(payload, channel, this.config.retry);
      results.push(result);

      if (!result.success && isHighPriority) {
        // 高优先级消息：卡片失败降级为文本
        console.warn(`[advertising] 高优先级消息卡片发送失败，尝试文本降级`);
        const textChannel = this.registry.get('feishu_text');
        if (textChannel && ct !== 'feishu_text') {
          const fallback = await sendWithRetry(payload, textChannel, {
            maxAttempts: 1,
            baseDelayMs: 0,
            maxDelayMs: 0,
          });
          results.push({ ...fallback, channel: 'feishu_text' });
        }
      }
    }

    return results;
  }

  // ── 高层 API：从分析结果到发送 ──

  /**
   * 发送海龟交易信号通知（自动选择模板）
   */
  async notifyAnalysis(result: TurtleAnalysisResult): Promise<SendResult[]> {
    const payload = renderTurtleSignal(result);
    return this.send(payload);
  }

  /**
   * 发送详细海龟分析卡
   */
  async notifyDetail(result: TurtleAnalysisResult): Promise<SendResult[]> {
    const payload = renderTurtleDetail(result);
    return this.send(payload);
  }

  /**
   * 批量分析结果 → 批量扫描通知
   */
  async notifyBatch(
    items: BatchScanItem[],
    totalScanned: number,
  ): Promise<SendResult[]> {
    const payload = renderBatchScan(items, totalScanned);
    return this.send(payload);
  }

  /**
   * 持仓汇总
   */
  async notifyPortfolio(summary: PortfolioSummary): Promise<SendResult[]> {
    const payload = renderPortfolioSummary(summary);
    return this.send(payload);
  }

  /**
   * 价格异动
   */
  async notifyQuoteAlert(quote: QuoteSnapshot, threshold?: number): Promise<SendResult[]> {
    const payload = renderQuoteAlert(quote, threshold);
    return this.send(payload);
  }

  /**
   * 系统状态
   */
  async notifySystemStatus(events: SystemStatusEvent[]): Promise<SendResult[]> {
    const payload = renderSystemStatus(events);
    return this.send(payload);
  }

  /**
   * 通用通知（自由格式）
   */
  async notify(
    title: string,
    body: string,
    color?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'grey',
    priority?: number,
  ): Promise<SendResult[]> {
    const payload = renderGeneric(title, body, color, priority);
    return this.send(payload);
  }

  // ── 信息 ──

  getChannels(): ChannelType[] {
    return this.registry.list();
  }

  getConfig(): AdvertisingConfig {
    return { ...this.config };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  全局单例
// ═══════════════════════════════════════════════════════════════════

let _instance: AdvertisingEngine | null = null;

/** 获取广告引擎单例（懒初始化） */
export async function getAdvertising(config?: Partial<AdvertisingConfig>): Promise<AdvertisingEngine> {
  if (!_instance) {
    _instance = new AdvertisingEngine(config);
    await _instance.start();
  }
  return _instance;
}

/** 便捷：直接发一条海龟分析通知 */
export async function notifyAnalysis(result: TurtleAnalysisResult): Promise<SendResult[]> {
  const engine = await getAdvertising();
  return engine.notifyAnalysis(result);
}

/** 便捷：批量通知 */
export async function notifyBatch(
  items: BatchScanItem[],
  totalScanned: number,
): Promise<SendResult[]> {
  const engine = await getAdvertising();
  return engine.notifyBatch(items, totalScanned);
}

/** 便捷：通用通知 */
export async function notify(
  title: string,
  body: string,
  color?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'grey',
  priority?: number,
): Promise<SendResult[]> {
  const engine = await getAdvertising();
  return engine.notify(title, body, color, priority);
}

// ═══════════════════════════════════════════════════════════════════
//  导出模板函数（供外部按需使用）
// ═══════════════════════════════════════════════════════════════════

export {
  renderTurtleSignal,
  renderTurtleDetail,
  renderPortfolioSummary,
  renderBatchScan,
  renderQuoteAlert,
  renderSystemStatus,
  renderGeneric,
};

export type {
  TurtleAnalysisResult,
  NotificationPayload,
  SendResult,
  ChannelType,
  ChannelAdapter,
  AdvertisingConfig,
  PortfolioSummary,
  BatchScanItem,
  QuoteSnapshot,
  SystemStatusEvent,
};
