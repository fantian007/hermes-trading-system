/**
 * Feishu Notifications — 飞书消息通知模块
 *
 * 通过飞书开放平台 API 发送消息通知，覆盖：
 *   - 交易执行通知
 *   - Agent 状态变更通知
 *   - 熔断紧急通知
 *   - 阶段切换通知
 */

import { feishu } from '../core/config.js';
import type { TradeBroadcast, AgentStatus } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════
//  飞书 API 常量
// ═══════════════════════════════════════════════════════════════════

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

// Token 缓存
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0; // epoch ms

// ═══════════════════════════════════════════════════════════════════
//  公开 API
// ═══════════════════════════════════════════════════════════════════

/**
 * 获取 tenant_access_token
 *
 * 内部缓存 token，过期前复用。首次调用或过期后自动重新获取。
 * 失败时抛出异常，调用方自行决定是否降级。
 */
export async function getToken(): Promise<string> {
  // 缓存命中（提前 60s 刷新以防边界情况）
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  if (!feishu.appId || !feishu.appSecret) {
    throw new Error('FEISHU_APP_ID / FEISHU_APP_SECRET 未配置');
  }

  const resp = await fetch(
    `${FEISHU_BASE}/auth/v3/tenant_access_token/internal`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: feishu.appId,
        app_secret: feishu.appSecret,
      }),
    },
  );

  const body = (await resp.json()) as {
    code: number;
    msg: string;
    tenant_access_token: string;
    expire: number;
  };

  if (body.code !== 0) {
    throw new Error(`飞书获取 token 失败: [${body.code}] ${body.msg}`);
  }

  cachedToken = body.tenant_access_token;
  tokenExpiresAt = Date.now() + body.expire * 1000;

  return cachedToken;
}

/**
 * 发送纯文本消息到配置的群聊
 *
 * @param text  消息文本内容
 * @returns     飞书 API 返回的 message_id，失败返回 undefined（静默降级）
 */
export async function sendMessage(text: string): Promise<string | undefined> {
  if (!feishu.chatId) {
    console.warn('[feishu] FEISHU_CHAT_ID 未配置，跳过消息发送');
    return undefined;
  }

  try {
    const token = await getToken();

    const resp = await fetch(
      `${FEISHU_BASE}/im/v1/messages?receive_id_type=chat_id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receive_id: feishu.chatId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        }),
      },
    );

    const body = (await resp.json()) as {
      code: number;
      msg: string;
      data?: { message_id: string };
    };

    if (body.code !== 0) {
      console.error(`[feishu] 发送消息失败: [${body.code}] ${body.msg}`);
      return undefined;
    }

    return body.data?.message_id;
  } catch (err: any) {
    console.error(`[feishu] 发送消息异常: ${err.message}`);
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  业务通知封装
// ═══════════════════════════════════════════════════════════════════

/**
 * 交易执行通知
 *
 * 格式：
 *   📊 交易执行
 *   标的: NVDA.US 方向: LONG
 *   买入: $142.30  卖出: $145.80
 *   盈亏: +$350.00 (+2.46%)
 *   时间: 2026-05-22 10:30 → 2026-05-22 14:15
 *   批准轮次: ELEC-20260522-1030
 */
export async function notifyTradeExecution(trade: TradeBroadcast): Promise<void> {
  const emoji = trade.pnl >= 0 ? '🟢' : '🔴';
  const sign  = trade.pnl >= 0 ? '+' : '';

  const msg = [
    '📊 交易执行',
    `标的: ${trade.symbol}  方向: ${trade.direction ?? '—'}`,
    `买入: $${trade.buy_price.toFixed(2)}  卖出: $${trade.sell_price.toFixed(2)}`,
    `盈亏: ${sign}$${trade.pnl.toFixed(2)} (${sign}${(trade.pnl_pct * 100).toFixed(2)}%)`,
    `时间: ${fmtTime(trade.buy_time)} → ${fmtTime(trade.sell_time)}`,
    `批准轮次: ${trade.approved_by}`,
  ].join('\n');

  await sendMessage(`**${emoji} 交易执行完成**\n${msg}`);
}

/**
 * Agent 状态变更通知
 *
 * 格式：
 *   🔄 Agent 状态变更
 *   Agent: AGT-0042 海龟趋势
 *   ACTIVE → SHADOW
 *   原因: 胜率过低: 42.3% (15笔)
 */
export async function notifyAgentStatusChange(
  agentId: string,
  fromStatus: AgentStatus,
  toStatus: AgentStatus,
  reason: string,
): Promise<void> {
  const arrow = STATUS_TRANSITION_EMOJI[`${fromStatus}->${toStatus}`] ?? '🔄';

  const msg = [
    '🔄 Agent 状态变更',
    `Agent: ${agentId}`,
    `${fromStatus} → ${toStatus}`,
    `原因: ${reason}`,
  ].join('\n');

  await sendMessage(`**${arrow} Agent 状态变更**\n${msg}`);
}

/**
 * 熔断紧急通知
 *
 * 格式：
 *   🚨 熔断触发
 *   原因: 当日回撤达 8.5%，超过熔断线 8.0%
 *   时间: 2026-05-22 14:32:05
 *   系统已自动暂停所有交易
 */
export async function notifyMeltdown(reason: string): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const msg = [
    '🚨 熔断触发',
    `原因: ${reason}`,
    `时间: ${now}`,
    '系统已自动暂停所有交易',
  ].join('\n');

  await sendMessage(`**🚨🚨 熔断触发 🚨🚨**\n${msg}`);
}

/**
 * 阶段推进通知
 *
 * 格式：
 *   ⏩ 阶段推进
 *   休眠期 → 盯盘期
 *   时间: 2026-05-22 09:30:00
 */
export async function notifyPhaseAdvance(
  fromPhase: string,
  toPhase: string,
): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const msg = [
    '⏩ 阶段推进',
    `${fromPhase} → ${toPhase}`,
    `时间: ${now}`,
  ].join('\n');

  await sendMessage(`**⏩ 阶段推进**\n${msg}`);
}

// ═══════════════════════════════════════════════════════════════════
//  内部辅助
// ═══════════════════════════════════════════════════════════════════

/** 状态转换 → 通知 emoji 映射 */
const STATUS_TRANSITION_EMOJI: Record<string, string> = {
  'ACTIVE->SHADOW':     '⚠️',
  'SHADOW->ACTIVE':     '✅',
  'SHADOW->TERMINATED': '❌',
  'ACTIVE->TERMINATED': '❌',
};

/** 截取时间字符串前 19 个字符，兼容 "2026-05-22T10:30:00" 和 "2026-05-22 10:30:00" */
function fmtTime(ts: string): string {
  return ts.replace('T', ' ').slice(0, 19);
}
