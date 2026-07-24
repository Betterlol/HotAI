# 图灵智算用户手册

## 一、平台简介

图灵智算是一款国内 AI 模型 API 聚合平台，可一站式接入 DeepSeek、Kimi 等多种国内主流模型，并通过统一的 OpenAI 兼容接口对外提供服务。

对于普通用户，主要操作路径是：

1. 注册并登录平台。
2. 创建并复制令牌 (API Key)。
3. 选择可用模型。
4. 按 API 文档发起请求。
5. 查看用量、余额和调用记录。

## 二、快速入门

### 1. 访问平台

进入平台后，可通过顶部导航进入首页、控制台、模型广场和文档。

<img src="assets/00-homepage.png" alt="首页" class="manual-screenshot manual-screenshot-wide">

### 2. 账号注册与登录

访问图灵智算首页，点击右上角“注册”按钮，随后：

1. 填写用户名、邮箱地址和密码。
2. 如果页面显示验证码输入框，先点击“发送验证码”，再填写邮箱收到的 6 位验证码。
3. 点击“注册”后，系统会尝试自动登录并跳转；如果自动登录失败，可进入登录页。
4. 登录页支持使用用户名或邮箱，加密码登录；如忘记密码，可点击“忘记密码？”。

<img src="assets/01-register.png" alt="注册页面" class="manual-screenshot manual-screenshot-wide">

<img src="assets/02-login.png" alt="登录页面" class="manual-screenshot manual-screenshot-wide">

当前登录页以用户名 / 邮箱加密码登录为主。是否开放其他登录方式，以平台实际页面显示为准。

### 3. 控制台概览

登录后，页面左侧会显示控制台侧边栏。

<img src="assets/03-console.png" alt="控制台" class="manual-screenshot manual-screenshot-wide">

普通用户常用入口包括：

- **聊天：** 返回首页聊天界面，使用已开通模型进行对话或接口效果验证。
- **数据看板：** 查看账户余额、历史消耗、请求次数、Token 消耗、平均 RPM/TPM，以及按模型维度统计的消耗分布和趋势。
- **排行榜：** 查看模型调用排行，并按时间范围筛选调用次数、Token 消耗和费用数据。
- **令牌管理：** 查看、创建、编辑、启用、禁用或删除 API Key，并设置分组、额度限制、模型限制、IP 限制和过期时间。
- **使用日志：** 按时间、用户、模型、令牌、分组、渠道和 Request ID 筛选 API 调用记录，查看耗时、Token 消耗、费用、重试信息和日志详情。
- **绘图日志 / 任务日志：** 查看绘图任务或异步任务的提交状态、执行结果和历史记录。
- **钱包管理：** 查看账户余额、充值入口、账单历史、充值记录、邀请码返利和返利额度划转。
- **个人设置：** 通过基础安全、账户绑定、系统与通知、福利与兑换等页签，管理个人资料、密码、安全认证、通知偏好、侧边栏显示、兑换码和签到。

模型选择和价格信息可通过顶部导航进入 **模型广场** 查看；

管理员账号还会额外看到渠道管理、模型管理、用户管理、订阅管理、兑换码管理和系统设置等入口。

## 三、令牌管理

令牌 (API Key) 是调用图灵智算 API 的凭证。创建步骤：

1. 登录后进入控制台。
2. 在左侧菜单进入“令牌管理”页面。
3. 点击右上角“创建令牌”。

<img src="assets/04-token-manager.png" alt="令牌管理页面" class="manual-screenshot manual-screenshot-wide">

4. 填写令牌名称，按需设置过期时间、分组、额度限制、模型限制和 IP 限制。

<img src="assets/05-token-create-1.png" alt="创建令牌-1" class="manual-screenshot manual-screenshot-narrow">

<img src="assets/06-token-create-2.png" alt="创建令牌-2" class="manual-screenshot manual-screenshot-narrow">

5. 点击“保存”完成创建。
6. 在令牌列表中点击“查看密钥”，再复制密钥用于 API 调用。

<img src="assets/07-token-list.png" alt="令牌列表" class="manual-screenshot manual-screenshot-wide">

<img src="assets/08-token-copy.png" alt="令牌复制" class="manual-screenshot manual-screenshot-narrow">

**注意事项：**

- API Key 可在令牌列表中通过“查看密钥”打开，并通过“复制密钥”复制；仍应妥善保存，不要泄露。
- 不要把真实 API Key 写入公开文档、截图、前端代码或 Git 仓库。
- 如果 API Key 泄露，应立即在令牌管理中禁用或删除，并重新创建。
- 不同项目建议使用不同 API Key，便于统计和停用。

## 四、模型广场与模型选择

可通过顶部导航进入“模型广场”，按供应商、可用令牌分组、计费类型、标签和端点类型筛选模型，也可以直接搜索模型名称。

<img src="assets/09-model-market.png" alt="模型广场" class="manual-screenshot manual-screenshot-wide">

也可以通过 API 查询当前账号可用模型：

```bash
curl https://api.example.com/v1/models \
  -H "Authorization: Bearer sk-xxxxxxxx"
```

选择模型时建议关注：

- **模型 ID：** API 请求中的 `model` 字段。
- **供应商与标签：** 用于判断模型来源、能力类别和适用方向。
- **适用场景：** 对话、代码、长上下文、批处理等。
- **可用分组：** 当前账号或令牌所属分组是否可以使用该模型。
- **端点类型：** 模型支持的接口类型，例如对话、图像、嵌入等。
- **计费类型与价格：** 输入价格、补全价格、缓存读取价格、倍率或动态计费规则。

详细信息见：[模型总览](#docs/user/103-model-info.md)。

## 五、用量与计费

在“数据看板”“使用日志”和“钱包管理”页面，可以查看：

- **数据看板：** 账户余额、历史消耗、请求次数、Token 消耗、平均 RPM/TPM，以及模型维度的消耗分布、消耗趋势和调用排行。

<img src="assets/10-dashboard.png" alt="数据看板" class="manual-screenshot">

- **使用日志：** 按时间、模型、令牌、用户、分组、渠道和 Request ID 筛选调用记录，查看输入 / 输出 Tokens、花费、请求耗时、重试信息和日志详情。

<img src="assets/11-usage-log.png" alt="使用日志" class="manual-screenshot manual-screenshot-wide">

- **钱包管理：** 当前余额、历史消耗、请求次数、充值金额、兑换码、推广返利、账单历史和充值记录。

<img src="assets/12-wallet-manager.png" alt="钱包管理" class="manual-screenshot manual-screenshot-wide">

## 六、常见问题快速索引

- **首次接入 API：** 查看 [API 快速开始](#docs/user/102-quickstart.md)。
- **不确定模型怎么选：** 查看 [模型总览](#docs/user/103-model-info.md)。
- **API Key 无效、权限不足或触发限流：** 查看 [FAQ 与常见报错排查](#docs/user/104-faq.md)。
- **余额、账单或额度异常：** 先查看数据看板、使用日志和钱包管理，再联系平台管理员。
