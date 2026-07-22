# API 快速开始文档

若您是第一次接入 HotAI API，可以先阅读前四小节，了解从准备 API Key 到完成首次调用的基本流程，用时约 3 分钟。
后面小节的语言示例、流式输出和错误码说明，可在实际开发时按需参考。

## 一、操作步骤速览

| 步骤 | 你要做什么 | 怎么做 |
| ---- | ---- | ---- |
| 1 | 准备调用信息 | 拿到 `Base URL`、`API Key`、`模型 ID` |
| 2 | 验证 API Key 是否可用 | 请求 `GET /v1/models` |
| 3 | 发起对话请求 | 请求 `POST /v1/chat/completions` |
| 4 | 设置鉴权头 | `Authorization: Bearer sk-xxxxxxxx` |
| 5 | 读取模型回复 | 看 `choices[0].message.content` |
| 6 | 查看 Token 消耗 | 看 `usage.total_tokens` |

最小调用示例：

```bash
curl https://api.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-xxxxxxxx" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {
        "role": "user",
        "content": "请用一句话介绍一下 HotAI。"
      }
    ]
  }'
```

把示例中的三项内容替换成你的真实信息即可：

- `https://api.example.com`：平台或管理员提供的 API 地址。
- `sk-xxxxxxxx`：你在控制台创建或复制的 API Key。
- `deepseek-v4-flash`：你要调用的模型 ID。

## 二、准备调用信息

开始调用前，请先准备以下信息：

| 项目 | 说明 | 示例 |
| ---- | ---- | ---- |
| Base URL | HotAI API 服务地址，由平台或管理员提供 | `https://api.example.com` |
| API Key | 在控制台的 Token Management / API token management 中创建或复制 | `sk-xxxxxxxx` |
| 模型 ID | 需要调用的模型名称，可先用 `/v1/models` 查询 | `deepseek-v4-flash` |

- API Key 只在请求头中使用，不要写入公开文档、截图、前端代码或 Git 仓库。
- 更多模型信息可参考：[模型总览](#docs/user/103-model-info.md)。

## 三、验证 API Key 和模型列表

在正式发起对话请求前，建议先查询可用模型列表，确认 Base URL 和 API Key 可用。

```bash
curl https://api.example.com/v1/models \
  -H "Authorization: Bearer sk-xxxxxxxx"
```

如果请求成功，响应中会返回当前账号可用的模型列表。请选择其中一个模型 ID 用于后续调用，例如：

```text
deepseek-v4-flash
```

## 四、看懂响应结果

非流式请求成功时，通常会返回类似结构：

```json
{
  "model": "deepseek-v4-flash",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "HotAI 是一个聚合多种 AI 模型的 API 调用平台。"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 20,
    "total_tokens": 38
  }
}
```

常用字段：

| 字段 | 说明 |
| ---- | ---- |
| `choices[0].message.content` | 模型生成的文本内容 |
| `finish_reason` | 生成结束原因，常见值包括 `stop`、`length`、`tool_calls` |
| `usage.prompt_tokens` | 输入消耗的 Token 数 |
| `usage.completion_tokens` | 输出消耗的 Token 数 |
| `usage.total_tokens` | 本次请求总 Token 数 |

## 五、完整请求示例

### (1) cURL

```bash
curl https://api.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-xxxxxxxx" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {
        "role": "user",
        "content": "请用一句话介绍 HotAI。"
      }
    ],
    "stream": false,
    "max_tokens": 256
  }'
```

### (2) Python

```python
import requests

base_url = "https://api.example.com"
api_key = "sk-xxxxxxxx"

response = requests.post(
    f"{base_url}/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    json={
        "model": "deepseek-v4-flash",
        "messages": [
            {
                "role": "user",
                "content": "请用一句话介绍 HotAI。",
            }
        ],
        "stream": False,
        "max_tokens": 256,
    },
    timeout=60,
)

response.raise_for_status()
data = response.json()
print(data["choices"][0]["message"]["content"])
```

如果本地没有安装 `requests`，可先执行：

```bash
python -m pip install requests
```

### (3) JavaScript

以下示例适用于 Node.js 18 及以上版本。

```javascript
const baseUrl = 'https://api.example.com'
const apiKey = 'sk-xxxxxxxx'

async function main() {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        {
          role: 'user',
          content: '请用一句话介绍 HotAI。',
        },
      ],
      stream: false,
      max_tokens: 256,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log(data.choices[0].message.content)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

## 六、流式输出示例

如需边生成边返回结果，将 `stream` 设置为 `true`。

```bash
curl https://api.example.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-xxxxxxxx" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {
        "role": "user",
        "content": "请列出 3 个 API 接入注意事项。"
      }
    ],
    "stream": true,
    "max_tokens": 256
  }'
```

流式响应会以 Server-Sent Events 形式逐段返回，客户端需要按行读取 `data:` 内容，直到收到 `[DONE]`。

## 七、错误码速查

| HTTP 状态码 | 常见原因 | 处理建议 |
| ---- | ---- | ---- |
| `400` | 请求体格式错误、缺少 `model` 或 `messages`、参数类型不正确 | 检查 JSON 是否合法，确认必填字段和字段类型 |
| `401` | API Key 缺失、格式错误、已删除或无效 | 检查 `Authorization: Bearer sk-xxxxxxxx`，重新复制或创建 API Key |
| `403` | 当前账号、分组或 Token 无权访问该模型 | 换用有权限的模型，或联系管理员开通权限 |
| `404` | Base URL 或接口路径错误，或模型不存在 | 确认 Base URL、接口路径和模型 ID |
| `429` | 触发请求频率限制或并发限制 | 降低请求频率，稍后重试，或联系管理员调整限额 |
| `500` | 服务端或上游模型服务异常 | 稍后重试；如持续出现，记录请求时间、模型 ID 和错误信息后反馈 |

更多排查方法详见：[FAQ 与常见报错排查](#docs/user/104-faq.md)。

## 八、接入检查清单

上线或交付前，建议逐项确认：

- 已使用 `/v1/models` 验证 API Key 和模型列表。
- 示例请求中的 Base URL、API Key、模型 ID 均已替换。
- 代码中没有硬编码真实 API Key。
- 已设置合理的请求超时时间。
- 对 `400`、`401`、`429`、`500` 等错误码做了基础处理。
- 已在控制台查看用量日志，确认请求成功记录和 Token 消耗符合预期。
