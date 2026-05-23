## CEO-001 经验总结

> 每次解决问题后记录，重复问题先查本文档。

---

### 2026-05-24 — Longbridge CLI Auth 在 Hermes Profile 下失效

**症状**: backtest-agent 阻塞，`longbridge auth status` 返回 "not found"，即使在真实用户 HOME 下已经登录成功。

**根因**: Hermes Agent 为每个 profile 隔离 HOME 目录 (`~/.hermes/profiles/<profile>/home/`)，longbridge CLI 将 token 存储在 `~/.longbridge/openapi/tokens/` 和 `~/.longbridge/openapi/cli-auth`。Profile 的 HOME 下没有 `.longbridge` 目录或缺少有效 token 文件。

**可行方案**: 将真实用户的 `~/.longbridge` 目录 symlink 到每个 profile 的 home 下：

```bash
for d in /Users/zys/.hermes/profiles/*/home; do
  ln -sf /Users/zys/.longbridge "$d/.longbridge"
done
```

**验证**: `longbridge auth status` 显示 "valid"，`longbridge quote NVDA.US` 返回报价数据。

**注意**: 创建新 profile 后需要重新执行此操作。
