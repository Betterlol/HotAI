# 项目概览与开发规范

## 项目定位

HotAI 是一个基于 Go 的 AI API 网关/代理系统，聚合 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等 40+ 个上游 AI 提供商，向用户提供统一的 API 接口，并包含用户管理、计费、限流、日志和管理后台。

项目基于 new-api 进行二次开发。涉及 Go module、import path、许可、版权、原项目说明等信息时，必须保留 new-api 与 QuantumNous 相关引用，不得删除或替换。

## 核心能力

- 多模型接入：统一接入国内外主流模型提供商。
- OpenAI 兼容接口：降低迁移成本，减少不同供应商 API 差异。
- 多租户管理：支持用户、分组、权限、API Key 和配额管理。
- 计费系统：支持按 Token、按次、动态表达式等计费方式。
- 速率限制：支持用户、模型、渠道和系统级限流。
- 审计日志：记录 API 调用、用户操作和管理动作，便于排障和合规。
- 运维能力：支持 Redis 缓存、性能分析、日志和健康检查。

## 使用场景

个人开发者可以使用 HotAI 快速接入多个模型提供商，无需为每家供应商单独编写适配逻辑。

企业团队可以通过 HotAI 统一管理团队内的 API Key、额度、模型权限、审计日志和成本。

SaaS 平台可以把 HotAI 作为后端 AI 服务聚合层，通过账户、分组和计费能力支撑商业化。

## 架构分层

项目采用分层架构：

```text
客户端请求
  -> Router（路由层）
  -> Middleware（中间件）
  -> Controller（控制器层）
  -> Service（业务逻辑层）
  -> Model（数据层）
  -> Relay（AI 提供商适配和代理）
  -> 上游模型服务
```

主要职责：

- `router/`：HTTP 路由定义，包括 API、relay、dashboard、web。
- `middleware/`：认证、授权、限流、CORS、日志、请求分发。
- `controller/`：请求处理、参数验证和响应封装。
- `service/`：业务逻辑、计费、渠道选择、事务处理。
- `model/`：GORM 模型和数据库访问。
- `relay/`：AI API 转发/代理引擎。
- `relay/channel/`：各供应商适配器，例如 `openai/`、`claude/`、`gemini/`、`aws/`。
- `setting/`：配置管理，包括倍率、模型、操作、系统、性能配置。
- `common/`：共享工具，包括 JSON、加密、Redis、环境变量、限流等。
- `dto/`：请求和响应结构体。
- `constant/`：API 类型、渠道类型、上下文键等常量。
- `types/`：relay 格式、文件源、错误等类型。
- `i18n/`：后端国际化。
- `oauth/`：OAuth 提供商实现。
- `web/HotAI/dist/`：当前嵌入并实际服务的 HotAI 静态前端，包括 HTML、CSS、JavaScript 和 Markdown 文档。
- `web/default/`：new-api 上游 React 19 + Rsbuild + Base UI + Tailwind CSS 前端，当前不作为 HotAI 嵌入前端入口。
- `web/classic/`：new-api 上游 React 18 + Vite + Semi Design 经典前端，当前不作为 HotAI 嵌入前端入口。

## 典型请求链路

一个典型的 API 请求会经过：

1. Gin 接收 HTTP 请求。
2. Router 匹配到对应 API 或 relay 路由。
3. Middleware 执行认证、授权、限流和日志逻辑。
4. Controller 验证参数并构造上下文。
5. Service 执行业务逻辑，包括渠道选择、配额校验和计费预处理。
6. Relay 将统一请求转换为上游供应商格式。
7. 上游响应返回后，Relay 转换为统一响应格式。
8. Service 结算实际用量并写入日志。
9. Controller 将结果返回给客户端。

## 技术栈

- 后端：Go 1.22+、Gin、GORM v2。
- 数据库：SQLite、MySQL、PostgreSQL。
- 缓存：Redis + 内存缓存。
- 认证：后台用户登录使用 Gin session/cookie，API 调用使用 Bearer API Key；OAuth、Passkey、2FA 等能力以后端路由和当前前端接入状态为准。
- 当前运行前端：`web/HotAI/dist` 静态 HTML、CSS、JavaScript。
- 上游参考前端：`web/default` 和 `web/classic` 保留在仓库中，但当前二进制嵌入的不是这两套前端。
- 前端包管理器：当前静态前端不依赖包管理器；维护 `web/default` 上游 React 前端时使用 Bun。

## 开发规范

### JSON 处理

业务代码中的 JSON marshal/unmarshal 必须使用 `common/json.go` 的包装函数：

```go
common.Marshal(v any) ([]byte, error)
common.Unmarshal(data []byte, v any) error
common.UnmarshalJsonStr(data string, v any) error
common.DecodeJson(reader io.Reader, v any) error
common.GetJsonType(data json.RawMessage) string
```

不要在业务代码中直接调用 `encoding/json` 的 marshal/unmarshal 函数。`json.RawMessage`、`json.Number` 等类型仍可作为类型引用。

### 数据库兼容

所有数据库代码必须同时支持 SQLite、MySQL 5.7.8+ 和 PostgreSQL 9.6+。

- 优先使用 GORM 方法，避免 raw SQL。
- raw SQL 必须处理方言差异，包括字段引号、布尔值和保留字。
- `group`、`key` 等保留字字段使用 `commonGroupCol`、`commonKeyCol`。
- 主库/日志库分支使用 `common.UsingMainDatabase(...)`、`common.UsingLogDatabase(...)`。
- 迁移必须在三类数据库上都能运行。

### Relay 适配

新增或修改供应商适配器时：

- 请求结构体中从客户端 JSON 解析并转发给上游的可选标量字段，必须使用指针类型配合 `omitempty`。
- 显式零值必须保留。例如客户端传入 `0`、`0.0`、`false` 时不能被误删。
- 如果供应商支持 `StreamOptions`，需要加入 `streamSupportedChannels`。
- 不要为了单个渠道把错误的协议语义写入通用逻辑。

示例：

```go
type Request struct {
	Temperature *float64 `json:"temperature,omitempty"`
	MaxTokens   *uint    `json:"max_tokens,omitempty"`
	Stream      *bool    `json:"stream,omitempty"`
}
```

### 计费表达式

涉及分层定价、动态计费、Token 归一化或表达式版本时，先阅读：

```text
pkg/billingexpr/expr.md
```

计费改动必须保护额度扣减、结算、退款和审计日志等真实业务不变量。

### 国际化

后端国际化：

- 库：`nicksnyder/go-i18n/v2`。
- 语言：`en`、`zh`。

前端国际化：

- 当前 HotAI 静态前端使用 `web/HotAI/dist/js/i18n.js`。
- `web/default` 的 React i18n 体系使用 `i18next`、`react-i18next` 和 `web/default/src/i18n/locales/{lang}.json`，仅适用于维护该上游前端时参考。

### 测试

后端测试应保护真实行为、API 契约、计费/accounting 不变量、数据库兼容性或回归路径。

- 新测试使用 `github.com/stretchr/testify/require` 做 setup 和 fatal assertion。
- 使用 `github.com/stretchr/testify/assert` 做非 fatal 值检查。
- 优先确定性表驱动测试。
- 避免仅提高覆盖率、随机输入、睡眠、日志型断言或重复测试。

### 前端开发

当前 HotAI 前端在 `web/HotAI/dist/` 下维护，修改 HTML、CSS、JavaScript 或 Markdown 后，需要重建后端二进制或镜像，使 Go embed 使用最新静态资源。

仅在维护 `web/default/` 上游 React 前端时使用：

```bash
cd web/default
bun install
bun run dev
bun run build
bun run i18n:sync
```

当前 HotAI 静态前端的用户可见文本，应尽量沿用现有 `data-i18n` 和 `web/HotAI/dist/js/i18n.js` 机制。维护 `web/default` 上游 React 前端时，详细约束以 `web/default/AGENTS.md` 为准。
