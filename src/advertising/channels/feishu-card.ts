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

    // Build valid Feishu interactive card format
    // Ref: https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-components
    const card: Record<string, any> = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: payload.title },
        template: payload.color,
      },
      elements: [
        { tag: 'markdown', content: payload.body },
      ],
    };

    // Add subtitle as a note line if provided
    if (payload.source) {
      card.header.subtitle = { tag: 'plain_text', content: payload.source };
    }

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
