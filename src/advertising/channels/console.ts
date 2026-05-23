/**
 * Console Channel — 控制台输出渠道
 *
 * 将 NotificationPayload 格式化输出到 stdout，用于本地调试/日志。
 * 不依赖任何外部服务，始终返回 message_id（时间戳）。
 */

import type { ChannelAdapter, NotificationPayload } from '../types.js';

const COLOR_MAP: Record<string, string> = {
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  orange: '\x1b[33m',
  red:    '\x1b[31m',
  purple: '\x1b[35m',
  grey:   '\x1b[90m',
};

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

export class ConsoleChannel implements ChannelAdapter {
  readonly type = 'console' as const;

  async send(payload: NotificationPayload): Promise<string | undefined> {
    const color = COLOR_MAP[payload.color] || COLOR_MAP.blue;
    const messageId = `${payload.type.toLowerCase()}-${Date.now()}`;

    const lines = [
      '═'.repeat(60),
      `${BOLD}${color}[${payload.type}] ${payload.title}${RESET}`,
      `来源: ${payload.source}  |  优先级: ${payload.priority ?? '—'}  |  颜色: ${payload.color}`,
      '─'.repeat(60),
      payload.body,
      '═'.repeat(60),
    ];

    console.log(lines.join('\n'));

    return messageId;
  }

  async healthCheck(): Promise<boolean> {
    return true; // console channel is always healthy
  }
}
