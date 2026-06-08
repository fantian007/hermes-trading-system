# 广告部门经验文档

## 2026-05-26 — send-card.ts 飞书卡片JSON结构修复

**问题**: send-card.ts 传递给 sendCard() 时包含了外层的 `{msg_type, card}` 包装，但 Feishu API 的 `content` 字段需要的是纯卡片正文 JSON (`{config, header, elements}`)，不带外层包装。

**症状**: 控制台输出 `"status":"failed"`，错误码 `[230099] Failed to create card content, ext=ErrCode: 200621; ErrMsg: parse card json err`

**可行方案**:
1. send-card.ts 收到 stdin 的 JSON 后，如果包含 `msg_type + card` 包装结构，提取 `wrapper.card` 作为卡片正文传递给 sendCard()
2. 修改后代码: `const cardBody = wrapper.card ?? wrapper;`
3. 直接调用 Feishu API 时，确保 `content` 字段只包含 `{config, header, elements}` 的 JSON 字符串
4. `msg_type: 'interactive'` 在请求 body 顶层指定，不在 content 内部

**教训**: 飞书交互式卡片的 content 字段只接受卡片正文 JSON，不接受带 msg_type 的外层包装。
