# 翻译术语表

## 使用原则

- 翻译应保持项目术语一致，优先使用本表标准译法。
- 原文存在技术术语时，可以保留行业通用英文。
- 原文包含 emoji 时，翻译可保留 emoji。
- UI、文档、错误信息和配置项翻译应避免同一概念多种译法混用。

## 核心概念

| 中文 | English | Français | Русский | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| 倍率 | Ratio | Ratio | Коэффициент | 用于计算价格的乘数因子；计费 UI 中优先使用该译法 |
| 令牌 | Token | Jeton | Токен | API 访问凭证，也指模型处理的文本单元 |
| 渠道 | Channel | Canal | Канал | API 服务提供商的接入通道 |
| 分组 | Group | Groupe | Группа | 用户或令牌的分类，影响价格倍率 |
| 额度 | Quota | Quota | Квота | 用户可用的服务额度 |

## 模型相关

| 中文 | English | Français | Русский | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| 提示 | Prompt | Invite | Промпт/Ввод | 模型输入内容；不同语言可按交互或技术语境选择 |
| 补全 | Completion | Complétion | Вывод | 模型输出内容 |
| 输入 | Input/Prompt | Entrée | Ввод | 发送给模型的内容 |
| 输出 | Output/Completion | Sortie | Вывод | 模型返回的内容 |
| 模型倍率 | Model Ratio | Ratio du modèle | Коэффициент модели | 不同模型的计费倍率 |
| 补全倍率 | Completion Ratio | Ratio de complétion | Коэффициент вывода | 输出内容的额外计费倍率 |
| 固定价格 | Price per call | Prix fixe | Цена за запрос | 每次调用固定价格 |
| 按量计费 | Pay-as-you-go | Paiement à l'utilisation | Оплата по объему | 根据使用量计费 |
| 按次计费 | Pay-per-view | Paiement par appel | Оплата за запрос | 按调用次数计费 |

## 用户与账户

| 中文 | English | Français | Русский | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| 超级管理员 | Root User | Super-administrateur | Суперадминистратор | 最高权限管理员 |
| 管理员 | Admin User | Administrateur | Администратор | 系统管理员 |
| 普通用户 | Normal User | Utilisateur normal | Обычный пользователь | 普通权限用户 |
| 充值 | Top Up | Recharge | Пополнение | 为账户增加额度 |
| 兑换码 | Redemption Code | Code d'échange | Код купона | 可兑换额度的代码 |

## 渠道管理

| 中文 | English | Français | Русский | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| 渠道 | Channel | Canal | Канал | API 服务提供通道 |
| 密钥 | Key | Clé | Ключ | API 访问密钥的通用说法 |
| API 密钥 | API Key | Clé API | API ключ | API 访问密钥 |
| 优先级 | Priority | Priorité | Приоритет | 渠道选择优先级 |
| 权重 | Weight | Poids | Вес | 负载均衡权重 |
| 代理 | Proxy | Proxy | Прокси | 代理服务器地址 |
| 模型重定向 | Model Mapping | Redirection de modèle | Перенаправление модели | 请求体中模型名称替换 |
| 供应商 | Provider/Vendor | Fournisseur | Поставщик | 提供 API 或模型服务的组织或服务 |

## 安全与计费

| 中文 | English | Français | Русский | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| 两步验证 | Two-Factor Authentication | Authentification à deux facteurs | Двухфакторная аутентификация | 为账户提供额外安全保护的验证方式 |
| 2FA | Two-Factor Authentication | 2FA | 2FA | 两步验证缩写 |
| 倍率 | Multiplier | Multiplicateur | Множитель | `Ratio` 的同义词；计费 UI 中优先使用核心概念中的译法 |

## 翻译注意

### 英语

- `Prompt` 指模型输入内容。
- `Completion` 指模型输出内容。
- `Ratio` 用于计费倍率语境；`Multiplier` 可作为解释性同义词，但 UI 中优先使用 `Ratio`。
- `Token` 需要结合上下文区分 API Token、文本 Token 和系统 Access Token。

### 法语

- 用户体验和 LLM 交互语境使用 `Invite`。
- 技术流程或计费语境使用 `Entrée`。
- `Completion` 统一译为 `Complétion`，不要使用 `Achèvement` 或 `Finalisation`。
- API 访问密钥使用 `Clé API`，不要译为 `Jeton API`。
- 注意复数形式、语法一致性和技术术语性别。

### 俄语

- LLM 交互语境使用 `Промпт`。
- 技术流程或计费语境使用 `Ввод`。
- `Completion` 统一译为 `Вывод`，不要使用容易和完成动作混淆的译法。
- API 访问密钥使用 `API ключ`，不要译为 `API токен`。
- 注意复数形式、格变化和技术术语性别。

## 术语选择说明

- `Prompt` 在用户交互中可译为“提示”，在计费或技术数据流中可译为“输入”。
- `Completion` 统一指模型输出。
- `Ratio` 在计费语境中优先译为“倍率”。
- `Quota` 指用户可用额度，也可能在部分上下文中表达为 credit。
- `Token` 需要结合上下文区分 API Token、文本 Token 和系统 Access Token。
