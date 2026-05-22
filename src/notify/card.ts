/**
 * Feishu Interactive Card Builder — 飞书卡片消息构建器
 *
 * 支持飞书卡片消息格式：标题、Markdown、表格、分割线、按钮等。
 * 参考: https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/card-components
 */

export interface CardHeader {
  title: string;
  subtitle?: string;
  template?: string;
}

export interface CardField {
  label: string;
  value: string;
  inline?: boolean;
}

export interface CardAction {
  text: string;
  url?: string;
  type?: 'primary' | 'default' | 'danger';
}

export interface CardSection {
  title?: string;
  text?: string;
  fields?: CardField[];
  actions?: CardAction[];
}

export interface CardConfig {
  header?: CardHeader;
  sections: CardSection[];
}

/**
 * 将 CardConfig 转换为飞书 interactive 消息的 content JSON 字符串
 */
export function buildCardContent(cfg: CardConfig): string {
  const elements: any[] = [];

  for (const sec of cfg.sections) {
    const el: any = { tag: 'div' };

    // Section title
    if (sec.title) {
      const titleEl: any = {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**${sec.title}**`,
        },
      };
      elements.push(titleEl);

      // Divider after title
      elements.push({ tag: 'hr' });
    }

    // Markdown text
    if (sec.text) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: sec.text,
        },
      });
    }

    // Fields (key-value table)
    if (sec.fields && sec.fields.length > 0) {
      const fieldElements = sec.fields.map((f) => ({
        tag: 'div',
        fields: [
          {
            is_short: f.inline !== false,
            text: { tag: 'lark_md', content: `**${f.label}**` },
          },
          {
            is_short: f.inline !== false,
            text: { tag: 'lark_md', content: f.value },
          },
        ],
      }));
      elements.push(...fieldElements);
    }

    // Actions (buttons)
    if (sec.actions && sec.actions.length > 0) {
      const btnElements = sec.actions.map((a) => {
        const typeMap: Record<string, string> = {
          primary: 'primary',
          danger: 'danger',
          default: 'default',
        };
        return {
          tag: 'button',
          text: { tag: 'lark_md', content: a.text },
          url: a.url,
          type: typeMap[a.type || 'default'] || 'default',
          value: {},
        };
      });
      elements.push({
        tag: 'action',
        actions: btnElements,
      });
    }

    // Divider between sections
    elements.push({ tag: 'hr' });
  }

  // Remove trailing divider
  if (elements.length > 0 && elements[elements.length - 1].tag === 'hr') {
    elements.pop();
  }

  const card: any = {
    elements,
  };

  if (cfg.header) {
    const templateColors: Record<string, string> = {
      blue: 'blue',
      red: 'red',
      green: 'green',
      orange: 'orange',
      purple: 'purple',
      grey: 'grey',
    };
    card.header = {
      title: { tag: 'plain_text', content: cfg.header.title },
      template: templateColors[cfg.header.template || 'blue'] || 'blue',
    };
    if (cfg.header.subtitle) {
      card.header.subtitle = {
        tag: 'plain_text',
        content: cfg.header.subtitle,
      };
    }
  }

  return JSON.stringify(card);
}

/**
 * 发送卡片消息到飞书
 */
export async function sendCard(card: CardConfig): Promise<string | undefined> {
  const { feishu } = await import('../core/config.js');

  if (!feishu.chatId) {
    console.warn('[feishu] FEISHU_CHAT_ID 未配置');
    return undefined;
  }

  const { getToken } = await import('./feishu.js');
  const token = await getToken();

  const content = buildCardContent(card);

  const resp = await fetch(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: feishu.chatId,
        msg_type: 'interactive',
        content,
      }),
    },
  );

  const body = (await resp.json()) as {
    code: number;
    msg: string;
    data?: { message_id: string };
  };

  if (body.code !== 0) {
    console.error(`[feishu] 卡片发送失败: [${body.code}] ${body.msg}`);
    return undefined;
  }

  return body.data?.message_id;
}
