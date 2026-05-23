# 系统运维知识库

---

## Hermes Profile 下 Longbridge CLI Auth 配置

### 问题

Hermes 为每个 profile 隔离 HOME 目录，longbridge CLI 的 token 存储在 `~/.longbridge/` 下。Profile 环境找不到 token。

### 解决

将真实用户的 `~/.longbridge` symlink 到每个 profile home：

```bash
for d in /Users/zys/.hermes/profiles/*/home; do
  ln -sf /Users/zys/.longbridge "$d/.longbridge"
done
```

在 `~/.longbridge/openapi/tokens/` 下存放 OAuth token（自动刷新）。
路径: `/Users/zys/.longbridge` → 各 profile 的 `~/.longbridge`

### 创建新 profile 后

记得重新执行上述 for 循环。

### 验证

```bash
longbridge auth status
longbridge quote NVDA.US
```
