/**
 * Feishu Card Channel — 飞书卡片消息渠道
 *
 * 将 NotificationPayload 转换为飞书 interactive card 并发送。
 * 复用现有的 sendCard() 基础设施。
 */

import type { ChannelAdapter, NotificationPayload } from '../types.js';

export class FeishuCardChannel implements ChannelAdapter {
  readonly type = 'feishu_card' as const;

  async send(payload: NotificationPayload): Promise<string | undefined> {
    const { sendCard } = await import('../../notify/card.js');

    const card = {
      header: {
        title: payload.title,
        subtitle: payload.source || '',
        template: payload.color,
      },
      sections: [{ text: payload.body }],
    };

    return sendCard(card);
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
