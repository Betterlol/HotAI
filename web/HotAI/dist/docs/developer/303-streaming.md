# 流式输出排查与修复

## Stream 处理链路

流式输出处理分三层，从外到内排查。

### 第一层：通用 SSE 扫描器

**位置：**

```text
relay/helper/stream_scanner.go
```

**核心入口：**

```text
StreamScannerHandler()
```

**职责：**

- 从上游 HTTP 响应读取 SSE 行。
- 解析 `data:` 前缀。
- 处理超时、ping、goroutine 生命周期。
- 控制流式读取是否继续。

如果流根本没有数据、中途断掉或一直挂起，优先检查这一层。

### 第二层：OpenAI 格式流处理

**位置：**

```text
relay/channel/openai/relay-openai.go
relay/channel/openai/helper.go
```

**核心入口：**

```text
OaiStreamHandler()
HandleStreamFormat()
handleLastResponse()
```

**职责：**

- 逐帧处理 `ChatCompletionsStreamResponse`。
- 处理 reasoning/thinking content 和 `<think>` 标签转换。
- 提取最终 usage。
- 发送 `[DONE]`。

如果输出内容乱码、usage 不对、thinking 标签异常或 OpenAI 兼容渠道普遍异常，重点看这一层。

### 第三层：渠道专属适配器

**位置：**

```text
relay/channel/<provider>/relay-<name>.go
```

**例如 Claude 走：**

```text
relay/channel/claude/relay-claude.go
```

如果只有某个供应商复现，先看对应渠道的 relay 文件和 stream handler。

## 排查顺序

1. 打开 debug 日志，查看 stream scanner 收到的原始 `data:` 内容，确认上游是否正常返回。
2. 如果原始数据正常，检查 `OaiStreamHandler()`、`HandleStreamFormat()` 和 `handleLastResponse()`。
3. 如果只有特定渠道异常，直接检查 `relay/channel/<provider>/` 下的适配器。
4. 如果流挂起或超时，检查 `stream_scanner.go` 中 timeout、stop channel 和 goroutine 生命周期。

## UTF-8 流式乱码问题

### 现象

OpenAI 兼容流式请求可能失败并出现：

```text
stream_non_json_chunk
```

**客户端收到类似被截断的 JSON 前缀：**

```text
{"choices":[{"delta":{"reasoning_content":"...
```

网关日志可能随后记录 `client_gone`，因为客户端无法解码 SSE data block 后停止读取。

### 根因

relay 输出 `Content-Type: text/event-stream` 时没有声明 charset。

**一些客户端使用：**

```python
requests.iter_lines(decode_unicode=True)
```

如果响应头没有声明 UTF-8，客户端可能使用单字节编码。中文 UTF-8 字节被错误解释后，单个 JSON SSE 事件会被拆成多行，最终导致客户端认为收到非 JSON 数据块。

`helper.SetEventStreamHeaders` 设置过预期 header，但第一次 `common.CustomEvent` render 会写出不带 charset 的值。因此两个路径都必须声明 UTF-8。

### 修复要求

**所有 SSE 响应统一使用：**

```http
Content-Type: text/event-stream; charset=utf-8
```

**需要覆盖两个可能写 SSE header 的位置：**

- **`relay/helper/common.go`：** `SetEventStreamHeaders`
- **`common/custom-event.go`：** `CustomEvent.WriteContentType`

共享 stream scanner 还需要在遇到格式异常的上游 continuation data 时，避免把物理拆分的 JSON data line 继续错误转发给客户端。

## 验证

**重建并启动本地后端：**

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

**检查流式响应 header：**

```text
Content-Type: text/event-stream; charset=utf-8
```

**确认每个 `data:` payload 都是合法 JSON，直到收到：**

```text
[DONE]
```

**运行 relay 单元测试：**

```bash
go test ./relay/...
```

**如果需要跑外部 B 样例回归测试，确认生成结果中：**

```json
{
  "success_count": 5,
  "failed_count": 0,
  "success_rate_percent": 100
}
```
