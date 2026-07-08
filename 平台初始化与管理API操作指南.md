# 平台初始化与管理 API 操作指南

> 本文档描述如何**不通过前端页面**，完全使用 HTTP API 完成平台的初始化和日常管理配置。

---

## 一、认证体系

所有管理 API 调用前，必须先完成登录并获取 `access_token`。每次请求都需要附带以下两项认证信息：

```
Authorization: Bearer <access_token>   # 管理令牌
New-Api-User: <user_id>                # 当前操作用户 ID（强制）
```

> `New-Api-User` 请求头是**必填项**，值为登录返回的用户 ID（Root User 通常是 `1`）。漏传会直接返回 401。

---

## 二、初始化流程

### 2.1 创建 Root User（首次启动）

服务首次启动后，调用初始化端点创建超级管理员账号：

```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "root",
    "password": "your-strong-password",
    "confirmPassword": "your-strong-password",
    "SelfUseModeEnabled": false,
    "DemoSiteEnabled": false
  }'
```

成功返回 `{"success": true}`。Root User 自动拥有最高权限（`RoleRootUser = 100`），初始额度 `100000000`。

### 2.2 登录并获取 Access Token

```bash
# 第一步：登录建立 session
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "root", "password": "your-strong-password"}'

# 返回示例（记下 id 字段）：
# {"success":true,"data":{"id":1,"username":"root","role":100,...}}

# 第二步：用 session 换取 access token
TOKEN_RESP=$(curl -s http://localhost:3000/api/user/token \
  -b cookies.txt \
  -H "New-Api-User: 1")
ACCESS_TOKEN=$(echo $TOKEN_RESP | jq -r '.data')
echo $ACCESS_TOKEN  # 类似：a1b2c3d4e5f6...
```

### 2.3 后续复用

之后的 API 调用使用以下固定参数：

```bash
AUTH="Authorization: Bearer <ACCESS_TOKEN>"
USER_H="New-Api-User: 1"
JSON_H="Content-Type: application/json"
BASE="http://localhost:3000"

# 验证连通性（查看所有系统选项）
curl -s "$BASE/api/option/" -H "$AUTH" -H "$USER_H"
```

---

## 三、渠道管理

### 3.1 渠道类型对照

| ID | 供应商 | 默认 Base URL | 说明 |
|----|--------|--------------|------|
| 1 | OpenAI | `https://api.openai.com` | 兼容接口的国内模型也走此类型 |
| 14 | Anthropic | `https://api.anthropic.com` | Claude |
| 17 | 阿里通义(DashScope) | `https://dashscope.aliyuncs.com` | Qwen 系列 |
| 24 | Gemini | `https://generativelanguage.googleapis.com` | Google |
| 43 | DeepSeek | `https://api.deepseek.com` | DeepSeek |
| 58 | Advanced Custom | 需手动设置 | 自定义供应商 |

完整列表见 `constant/channel.go`。

### 3.2 创建单 Key 渠道

```bash
curl -X POST "$BASE/api/channel/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "mode": "single",
    "channel": {
      "type": 1,
      "name": "OpenAI-Prod",
      "key": "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "models": "gpt-4o,gpt-4o-mini,gpt-4-turbo",
      "group": "default",
      "priority": 100,
      "weight": 1,
      "status": 1,
      "auto_ban": 1,
      "base_url": "https://api.openai.com"
    }
  }'
```

### 3.3 创建多 Key 渠道（同供应商多条 Key）

多条 Key 可放在一个渠道内，随机或轮询使用：

```bash
curl -X POST "$BASE/api/channel/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "mode": "multi_to_single",
    "multi_key_mode": "random",
    "channel": {
      "type": 1,
      "name": "OpenAI-MultiKey",
      "key": "sk-key1\nsk-key2\nsk-key3",
      "models": "gpt-4o",
      "group": "default",
      "priority": 90,
      "weight": 1
    }
  }'
```

`multi_key_mode` 支持 `"random"`（随机）和 `"polling"`（轮询）。

### 3.4 创建渠道（多 Key → 多渠道）

```bash
curl -X POST "$BASE/api/channel/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "mode": "batch",
    "channel": {
      "type": 1,
      "key": "sk-key1\nsk-key2",
      "models": "gpt-4o",
      "group": "default"
    }
  }'
```

### 3.5 创建 DeepSeek 渠道

```bash
curl -X POST "$BASE/api/channel/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "mode": "single",
    "channel": {
      "type": 43,
      "name": "DeepSeek",
      "key": "sk-xxxxxxxxxxxxxxxx",
      "models": "deepseek-chat,deepseek-coder",
      "group": "default",
      "priority": 80
    }
  }'
```

### 3.6 查看渠道列表

```bash
# 全量分页
curl -s "$BASE/api/channel/?p=1&page_size=20" -H "$AUTH" -H "$USER_H"

# 搜索
curl -s "$BASE/api/channel/search?keyword=OpenAI" -H "$AUTH" -H "$USER_H"
```

### 3.7 更新渠道

```bash
curl -X PUT "$BASE/api/channel/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "id": 1,
    "name": "Updated Name",
    "models": "gpt-4o,gpt-4o-mini",
    "group": "vip",
    "priority": 20,
    "weight": 2
  }'
```

### 3.8 启用/禁用渠道

```bash
# 禁用（status=2）
curl -X POST "$BASE/api/channel/1/status" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"status": 2}'

# 启用（status=1）
curl -X POST "$BASE/api/channel/1/status" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"status": 1}'
```

### 3.9 删除渠道

```bash
# 单条
curl -X DELETE "$BASE/api/channel/1" -H "$AUTH" -H "$USER_H"

# 批量
curl -X POST "$BASE/api/channel/batch" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"ids": [1, 2, 3]}'
```

### 3.10 测试渠道

```bash
# 测试所有渠道
curl -s "$BASE/api/channel/test" -H "$AUTH" -H "$USER_H"

# 测试指定渠道
curl -s "$BASE/api/channel/test/1" -H "$AUTH" -H "$USER_H"

# 测试时指定模型
curl -s "$BASE/api/channel/test/1?model=gpt-4o" -H "$AUTH" -H "$USER_H"
```

---

## 四、API Token 管理

Token 是终端用户调用 AI API 时使用的凭据（`sk-xxx` 格式）。

### 4.1 创建 Token

```bash
curl -X POST "$BASE/api/token/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "name": "Production App Token",
    "remain_quota": 100000000,
    "expired_time": -1,
    "unlimited_quota": true,
    "group": "default",
    "model_limits_enabled": false,
    "model_limits": "",
    "cross_group_retry": true
  }'
```

关键字段说明：

| 字段 | 说明 |
|------|------|
| `name` | 令牌名称，最长 50 字符 |
| `remain_quota` | 剩余配额 |
| `expired_time` | 过期时间戳，`-1` 表示永不过期 |
| `unlimited_quota` | 无限配额 |
| `group` | 所属分组（影响路由和倍率） |
| `model_limits_enabled` | 是否限制可用模型 |
| `model_limits` | 限制的模型列表（逗号分隔） |
| `cross_group_retry` | 跨组重试开关 |

### 4.2 获取 Token 完整 Key

```bash
curl -s -X POST "$BASE/api/token/1/key" \
  -H "$AUTH" -H "$USER_H"
```

### 4.3 查看 Token 列表

```bash
curl -s "$BASE/api/token/" -H "$AUTH" -H "$USER_H"
```

### 4.4 更新 Token

```bash
curl -X PUT "$BASE/api/token/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"id": 1, "name": "Updated", "status": 1}'

# 仅更新状态
curl -X PUT "$BASE/api/token/?status_only=true" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"id": 1, "status": 2}'
```

### 4.5 删除 Token

```bash
curl -X DELETE "$BASE/api/token/1" -H "$AUTH" -H "$USER_H"
```

---

## 五、系统选项配置

所有系统选项通过 `PUT /api/option/` 接口配置，无需改代码。

### 5.1 路由与容错

```bash
# 重试次数（覆盖代码默认值）
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "RetryTimes", "value": "3"}'

# 渠道自动禁用开关
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "AutomaticDisableChannelEnabled", "value": "true"}'

# 渠道自动启用开关
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "AutomaticEnableChannelEnabled", "value": "true"}'

# 渠道禁用响应时间阈值（秒）
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "ChannelDisableThreshold", "value": "5.0"}'

# 自动禁用状态码（逗号/范围格式）
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "AutomaticDisableStatusCodes", "value": "401,403,429"}'

# 自动禁用关键词（每行一条）
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "AutomaticDisableKeywords", "value": "Your credit balance is too low\nRate limit exceeded\nInsufficient quota"}'
```

### 5.2 定价与倍率

```bash
# 模型倍率（JSON 字符串）
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "ModelRatio", "value": "{\"gpt-4o\": 1, \"gpt-4o-mini\": 0.5, \"deepseek-chat\": 0.5}"}'

# 分组倍率
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "GroupRatio", "value": "{\"default\": 1, \"vip\": 0.8}"}'

# 统一单价
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "Price", "value": "0.002"}'
```

### 5.3 平台信息

```bash
# 平台名称
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "SystemName", "value": "HotAI"}'

# 管理员通知邮箱
curl -X PUT "$BASE/api/option/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{"key": "Notice", "value": "系统维护通知：每周日凌晨 3-5 点"}'
```

### 5.4 查看所有选项

```bash
curl -s "$BASE/api/option/" -H "$AUTH" -H "$USER_H" | jq
```

---

## 六、用户管理

### 6.1 创建用户

```bash
curl -X POST "$BASE/api/user/" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "username": "alice",
    "password": "password123",
    "display_name": "Alice",
    "role": 1
  }'
```

角色：`1`=普通用户，`10`=管理员，`100`=超级管理员。

### 6.2 管理用户（禁用/额度）

```bash
curl -X POST "$BASE/api/user/manage" \
  -H "$AUTH" -H "$USER_H" -H "$JSON_H" \
  -d '{
    "id": 2,
    "action": "add_quota",
    "mode": "add",
    "quota": 10000
  }'
```

`action` 支持：`disable`、`enable`、`delete`、`promote`、`demote`、`add_quota`。
`mode`（仅 `add_quota`）：`add`（增加）、`subtract`（减少）、`override`（覆盖）。

### 6.3 搜索用户

```bash
curl -s "$BASE/api/user/search?keyword=alice" -H "$AUTH" -H "$USER_H"
```

---

## 七、完整初始化脚本

以下脚本串联了从空服务到可用的完整流程，适合首次部署时使用：

```bash
#!/bin/bash
# setup_hotai.sh — 全 API 初始化脚本
set -e

BASE="${BASE:-http://localhost:3000}"
ROOT_PASS="${ROOT_PASS:-admin123}"

echo "=== 1. 创建 Root User ==="
curl -s "$BASE/api/setup" -X POST -H "Content-Type: application/json" \
  -d "{\"username\":\"root\",\"password\":\"$ROOT_PASS\",\"confirmPassword\":\"$ROOT_PASS\"}" | jq .

echo "=== 2. 登录并获取 Access Token ==="
curl -s "$BASE/api/user/login" -X POST -c /tmp/hotai_cookies.txt \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"root\",\"password\":\"$ROOT_PASS\"}" > /dev/null

ACCESS_TOKEN=$(curl -s "$BASE/api/user/token" -b /tmp/hotai_cookies.txt \
  -H "New-Api-User: 1" | jq -r '.data.access_token')

AUTH="Authorization: Bearer $ACCESS_TOKEN"
H=(-H "$AUTH" -H "New-Api-User: 1" -H "Content-Type: application/json")

echo "=== 3. 配置系统选项 ==="
curl -s -X PUT "$BASE/api/option/" "${H[@]}" \
  -d '{"key":"RetryTimes","value":"2"}' > /dev/null
curl -s -X PUT "$BASE/api/option/" "${H[@]}" \
  -d '{"key":"AutomaticDisableStatusCodes","value":"401,403,429"}' > /dev/null

echo "=== 4. 创建 OpenAI 渠道 ==="
curl -s -X POST "$BASE/api/channel/" "${H[@]}" \
  -d '{
    "mode": "single",
    "channel": {
      "type": 1,
      "name": "OpenAI-Primary",
      "key": "sk-xxxx",
      "models": "gpt-4o,gpt-4o-mini",
      "group": "default",
      "priority": 100,
      "weight": 1,
      "auto_ban": 1
    }
  }' | jq .

echo "=== 5. 创建 DeepSeek 渠道 ==="
curl -s -X POST "$BASE/api/channel/" "${H[@]}" \
  -d '{
    "mode": "single",
    "channel": {
      "type": 43,
      "name": "DeepSeek-Primary",
      "key": "sk-xxxx",
      "models": "deepseek-chat,deepseek-coder",
      "group": "default",
      "priority": 80,
      "weight": 1,
      "auto_ban": 1
    }
  }' | jq .

echo "=== 6. 创建默认 API Token ==="
TOKEN_ID=$(curl -s -X POST "$BASE/api/token/" "${H[@]}" \
  -d '{
    "name": "Default Token",
    "remain_quota": 100000000,
    "expired_time": -1,
    "unlimited_quota": true,
    "group": "default"
  }' | jq '.data.id')

TOKEN_KEY=$(curl -s -X POST "$BASE/api/token/$TOKEN_ID/key" \
  -H "$AUTH" -H "New-Api-User: 1" | jq -r '.data.key')

echo "=== 完成 ==="
echo "Access Token: $ACCESS_TOKEN"
echo "API Key: $TOKEN_KEY"

# 清理
rm -f /tmp/hotai_cookies.txt
```

---

## 八、常用操作速查

| 目标 | 方法 | 端点 |
|------|------|------|
| 创建 Root User | POST | `/api/setup` |
| 登录 | POST | `/api/user/login` |
| 获取 Access Token | GET | `/api/user/token` |
| 查看所有选项 | GET | `/api/option/` |
| 更新选项 | PUT | `/api/option/` |
| 创建渠道 | POST | `/api/channel/` |
| 查看渠道列表 | GET | `/api/channel/` |
| 启用/禁用渠道 | POST | `/api/channel/:id/status` |
| 删除渠道 | DELETE | `/api/channel/:id` |
| 测试渠道 | GET | `/api/channel/test` |
| 创建 Token | POST | `/api/token/` |
| 获取 Token Key | POST | `/api/token/:id/key` |
| 创建用户 | POST | `/api/user/` |
| 管理用户 | POST | `/api/user/manage` |
