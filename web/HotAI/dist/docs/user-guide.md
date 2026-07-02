# 用户指南

## 注册和登录

### 注册新账户

访问 HotAI 首页，点击"注册"按钮：

1. 填写邮箱地址和密码
2. 验证邮箱（系统会发送验证链接）
3. 完成注册，自动登录

注册成功后，系统会为您分配初始配额，您可以立即开始使用 API 服务。

### 使用 OAuth 登录

HotAI 支持多种 OAuth 登录方式：

- GitHub 账号登录
- Google 账号登录
- 其他 OIDC 提供商

使用 OAuth 登录无需单独注册，首次登录时会自动创建账户。

## 创建 API Key

API Key 是调用 HotAI API 的凭证。创建步骤如下：

1. 登录后进入控制台
2. 点击"API Keys"菜单
3. 点击"创建新 Key"按钮
4. 填写 Key 名称和备注
5. （可选）设置 Key 的权限和配额
6. 点击"创建"

**重要：**Key 创建后只显示一次，请妥善保管。如果丢失，需要重新创建。

### 管理 API Key

在 API Keys 页面，您可以：

- 查看所有 Key 的状态和使用情况
- 启用或禁用 Key
- 修改 Key 的配额限制
- 删除不再使用的 Key

## 调用 API

HotAI 完全兼容 OpenAI API 格式，您可以使用 OpenAI 的 SDK 或直接调用 HTTP 接口。

### 使用 curl 调用
bash
curl https://your-hotai-domain/v1/chat/completions
-H “Authorization: Bearer YOUR_API_KEY”
-H “Content-Type: application/json”
-d ‘{
“model”: “gpt-4”,
“messages”: [
{“role”: “user”, “content”: “Hello!”}
]
}’


### 使用 Python SDK

python
from openai import OpenAI

client = OpenAI(
api_key=“YOUR_API_KEY”,
base_url=“https://your-hotai-domain/v1”
)

response = client.chat.completions.create(
model=“gpt-4”,
messages=[
{“role”: “user”, “content”: “Hello!”}
]
)
print(response.choices[0].message.content)


## 查看使用量

在控制台的"使用统计"页面，您可以查看：

- 实时的 API 调用次数
- Token 使用量统计
- 费用明细和趋势图表
- 按模型、按时间的使用分布

您还可以导出使用记录，用于内部审计或成本分析。

## 管理账户

### 个人信息

在"个人设置"页面，您可以：

- 修改用户名和头像
- 更改密码
- 绑定或解绑 OAuth 账号
- 设置双因素认证（2FA）

### 充值和账单

在"账户余额"页面，您可以：

- 查看当前余额和配额
- 在线充值（支持多种支付方式）
- 查看历史账单和交易记录
- 设置余额预警通知