/**
 * Feishu Text Channel — 飞书纯文本消息渠道
 *
 * 将 NotificationPayload 的 body Markdown 直接作为文本发送。
 * 回退方案：当卡片发送失败时降级为文本。
 */

import type { ChannelAdapter, NotificationPayload } from '../types.js';

export class FeishuTextChannel implements ChannelAdapter {
  readonly type = 'feishu_text' as const;

  async send(payload: NotificationPayload): Promise<string | undefined> {
    const { sendMessage } = await import('../../notify/feishu.js');

    // 文本消息：标题 + 换行 + 正文
    const text = `**${payload.title}**\n${payload.source}\n\n${payload.body}`;

    return sendMessage(text);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { feishu } = await import('../../core/config.js');
      return !!(feishu.appId && feishu.appSecret && feishu.chatId);
    } catch {
      return false;
    }
  }
}
