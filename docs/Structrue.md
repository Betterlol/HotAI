这是一个基于 Go 的 AI API 网关/代理系统，聚合了 40+ 个上游 AI 提供商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等），提供统一的 API 接口，并包含用户管理、计费、限流和管理后台。

  核心架构

  分层架构模式

  采用经典的分层架构：Router → Controller → Service → Model

  客户端请求
      ↓
  Router（路由层）- 定义 HTTP 端点
      ↓
  Controller（控制器层）- 处理请求/响应
      ↓
  Service（业务逻辑层）- 核心业务逻辑
      ↓
  Model（数据层）- GORM 模型和数据库访问

  目录结构与职责

  核心业务模块：
  - router/ - HTTP 路由定义（API、relay、dashboard、web）
  - controller/ - 请求处理器，参数验证，响应封装
  - service/ - 业务逻辑实现，事务处理
  - model/ - GORM 数据模型，数据库操作

  AI 代理核心：
  - relay/ - AI API 转发/代理引擎
  - relay/channel/ - 各提供商适配器（openai/, claude/, gemini/, aws/ 等）
    - 每个提供商有独立的请求/响应适配逻辑

  基础设施：
  - middleware/ - 认证、限流、CORS、日志、请求分发
  - setting/ - 配置管理（比率、模型、操作、系统、性能）
  - common/ - 共享工具（JSON、加密、Redis、环境变量、限流等）
  - pkg/ - 内部包（cachex 缓存、ionet 网络）

  数据定义：
  - dto/ - 数据传输对象（请求/响应结构体）
  - constant/ - 常量定义（API 类型、渠道类型、上下文键）
  - types/ - 类型定义（relay 格式、文件源、错误）

  国际化与认证：
  - i18n/ - 后端国际化（go-i18n，英文/中文）
  - oauth/ - OAuth 提供商实现

  前端：
  - web/default/ - React 19 + Rsbuild + Base UI + Tailwind CSS
  - web/classic/ - React 18 + Vite + Semi Design（经典版）

  关键技术模式

  1. 统一 JSON 处理

  所有 JSON 操作必须使用 common/json.go 的包装函数：
  common.Marshal(v any) ([]byte, error)
  common.Unmarshal(data []byte, v any) error
  common.UnmarshalJsonStr(data string, v any) error
  common.DecodeJson(reader io.Reader, v any) error
  禁止直接使用 encoding/json，确保全局一致性。

  2. 多数据库兼容

  必须同时支持 SQLite、MySQL (≥5.7.8)、PostgreSQL (≥9.6)：
  - 优先使用 GORM 方法而非原始 SQL
  - 处理数据库方言差异（引号、布尔值、保留字）
  - 使用 common.UsingMainDatabase(...) / common.UsingLogDatabase(...) 进行分支
  - 迁移必须在三个数据库上都能工作

  3. Relay 提供商适配模式

  每个 AI 提供商在 relay/channel/ 下有独立适配器：
  - 请求结构体：可选标量字段必须使用指针类型 + omitempty
  type Request struct {
      Temperature *float64 `json:"temperature,omitempty"` // 正确
      MaxTokens   int      `json:"max_tokens"`            // 错误（如果是可选）
  }
  - 保留显式零值：客户端明确传 0 应发送上游，nil 应省略
  - 支持 StreamOptions 的渠道需加入 streamSupportedChannels

  4. 计费表达式系统

  动态计费基于表达式系统，开发前必读 pkg/billingexpr/expr.md：
  - 分层定价、令牌归一化、配额转换
  - 表达式语言、版本管理
  - 所有计费改动必须遵循该文档

  5. 国际化 (i18n)

  后端：
  - 库：nicksnyder/go-i18n/v2
  - 语言：en, zh

  前端：
  - 库：i18next + react-i18next + i18next-browser-languagedetector
  - 语言：en（基础）、zh（fallback）、fr、ru、ja、vi
  - 文件：web/default/src/i18n/locales/{lang}.json（扁平 JSON，键为英文源字符串）
  - 用法：useTranslation() hook，调用 t('English key')

  开发模式与规范

  代码质量原则

  - 直接可读：优先使用早返回、清晰分支、命名良好的局部变量
  - 避免过度嵌套：函数定义仅在回调 API 或闭包明显更简单时使用
  - 最小化辅助函数：单次调用的辅助函数应内联，除非代表可复用业务概念

  测试质量

  - 保护真实行为、API 契约、计费不变性、数据兼容性或回归路径
  - 新测试必须使用 github.com/stretchr/testify/require（致命断言）和 assert（非致命检查）
  - 避免仅提升覆盖率数字的测试、随机输入的假模糊测试、重复测试
  - 优先确定性表驱动测试，显式输入和精确预期输出

  前端开发

  - 包管理器：bun（优先于 npm/yarn/pnpm）
  bun install
  bun run dev
  bun run build
  bun run i18n:sync
  - 所有用户界面文本必须通过 t('English key') 支持 i18n
  - 详细规范见 web/default/AGENTS.md

  Git 与 PR

  - PR 必须使用 .github/PULL_REQUEST_TEMPLATE.md 模板
  - 如当前 git 用户非历史核心开发者，需在 PR 中说明代码为 AI 生成或辅助
  - 保护项目信息（new-api、QuantumNous）不可修改或删除

  技术栈总结
    后端语言: Go 1.22+
    Web 框架: Gin
    ORM: GORM v2
    数据库: SQLite + MySQL + PostgreSQL（多选一运行时）
    缓存: Redis (go-redis) + 内存缓存
    认证: JWT + WebAuthn/Passkeys + OAuth
    前端框架: React 19 + TypeScript
    前端构建: Rsbuild
    I 库: Base UI + Tailwind CSS
    包管理: Bun
  这是一个生产级的多租户 AI 网关系统，强调数据库兼容性、类型安全、国际化支持和严格的编码规范。
