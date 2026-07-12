  Stream 输出问题的定位路径

  Stream 处理分三层，从外到内：

  第一层：通用 SSE 扫描器（所有渠道共用）

  relay/helper/stream_scanner.go — StreamScannerHandler()
  负责从上游 HTTP 响应读取 SSE 行、解析 data: 前缀、超时控制、ping、goroutine 生命周期管理。如果流根本没数据或中途断掉，问题在这里。

  第二层：OpenAI 格式的流处理（大多数渠道走这里）

  relay/channel/openai/relay-openai.go — OaiStreamHandler()
  relay/channel/openai/helper.go      — HandleStreamFormat() / handleLastResponse()
  负责逐帧处理 ChatCompletionsStreamResponse、thinking content 转换（<think> 标签）、提取最终 usage、发送 [DONE]。如果输出内容乱、usage 不对、thinking 标签异常，问题在这里。

  第三层：各渠道专属适配器

  relay/channel/<provider>/relay-<name>.go
  例如 Claude 走 relay/channel/claude/relay-claude.go，有自己的 stream handler。如果只有特定渠道有问题，先看对应的 relay-*.go。

  定位顺序建议：

  1. 开日志（设置 common.DebugEnabled = true 或环境变量），看 stream scanner data: 的原始输出，确认上游是否正常返回数据
  2. 如果原始数据正常，问题在 relay-openai.go 的 OaiStreamHandler 或 HandleStreamFormat
  3. 如果特定渠道才复现，直接看 relay/channel/<provider>/ 下的适配器
  4. 如果流挂起、超时，看 stream_scanner.go 里的 streamingTimeout 和 stopChan 逻辑