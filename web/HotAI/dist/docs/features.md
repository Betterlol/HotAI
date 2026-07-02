# 特性说明

## 多模型支持

HotAI 支持 40+ 主流 AI 模型提供商，包括但不限于：

- OpenAI (GPT-4, GPT-3.5, DALL-E, Whisper)
- Anthropic Claude (Claude 3 系列)
- Google Gemini (Gemini Pro, Gemini Ultra)
- Azure OpenAI Service
- AWS Bedrock (Claude, Llama, Titan)
- 阿里云通义千问、百度文心一言、讯飞星火等国内模型

所有模型通过统一的 API 接口访问，无需针对每个提供商编写不同的代码。支持文本生成、对话、图像生成、语音识别等多种 AI 能力。

## 统一 API 接口

HotAI 完全兼容 OpenAI API 规范，这意味着：

- 只需修改 API 端点和 Key，即可从 OpenAI 无缝迁移
- 支持流式响应（Server-Sent Events）
- 支持 Function Calling 和 Tools
- 支持自定义参数（temperature、top_p、max_tokens 等）
- bash
  curl https://your-hotai-domain/v1/chat/completions
  -H “Authorization: Bearer YOUR_API_KEY”
  -H “Content-Type: application/json”
  -d ‘{
  “model”: “gpt-4”,
  “messages”: [{“role”: “user”, “content”: “Hello!”}]
  }’


## 用户管理

完善的多租户用户管理系统：

- **用户注册与认证：**支持邮箱注册、OAuth 登录（GitHub、Google 等）
- **组织管理：**支持创建多个组织，每个组织独立管理用户和资源
- **角色权限：**管理员、普通用户、只读用户等多级权限
- **API Key 管理：**用户可创建多个 API Key，设置不同的权限和配额

## 计费系统

灵活的计费和配额管理：

- 支持按次数、按 Token、按时长等多种计费模式
- 支持预付费和后付费
- 实时扣费，精确到每次 API 调用
- 支持充值、赠送、退款等操作
- 配额预警和自动限流
- 详细的账单和消费记录

## 速率限制

多维度的速率限制和流量控制：

- **全局限流：**限制整个系统的 QPS
- **用户限流：**为每个用户设置不同的速率限制
- **模型限流：**针对不同模型设置不同的调用频率
- **IP 限流：**防止恶意攻击和滥用
- **令牌桶算法：**支持突发流量，提供更好的用户体验

## 审计日志

完整的操作审计和日志记录：

- 记录所有 API 调用的详细信息（请求参数、响应结果、耗时等）
- 记录用户的操作行为（登录、创建 Key、修改配置等）
- 支持日志搜索和过滤
- 支持日志导出和归档
- 可配置日志保留策略

审计日志可用于问题排查、成本分析、合规审计等多种场景。