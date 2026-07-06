# 飞书模型介绍页自动更新运维指南

本目录提供飞书知识库文档抓取工具，用于从指定飞书 Wiki 节点读取模型信息，并自动生成项目内的模型介绍页模板。

默认流程为：

1. 通过飞书 OAuth 获取 `user_access_token`。
2. 使用 token 读取配置的飞书 Wiki 文档或电子表格。
3. 将抓取结果转换为 Markdown。
4. 从 Markdown 中提取第一张表格。
5. 根据表格中的 `模型ID` 列生成 `docs/模型介绍页模板.md`。

## 文件说明

| 文件 | 作用 |
| ---- | ---- |
| `main.py` | 统一入口，负责加载配置、启动授权服务、抓取文档和同步模型介绍页模板 |
| `fetch_wiki_doc.py` | 调用飞书 OpenAPI，读取 Wiki 节点背后的 docx 或 sheet 内容 |
| `oauth_server.py` | 本地 OAuth 回调服务，用于获取 `user_access_token` |
| `.env.example` | 运维配置示例 |
| `.env` | 本地实际配置文件，不应提交到仓库 |
| `requirements.txt` | Python 依赖列表 |

## 前置条件

- Python 3.10+。
- 运维账号有目标飞书 Wiki 文档的访问权限。
- 已创建飞书应用，并拿到 `App ID` 和 `App Secret`。
- 飞书应用的 OAuth 重定向地址已配置为本地回调地址，例如：

```text
http://localhost:9000/
```

如果修改了 `FEISHU_REDIRECT_URI` 或启动端口，需要同步修改飞书开放平台中的重定向地址。

## 安装依赖

在仓库根目录执行：

```bash
python -m pip install -r scripts/feishu/requirements.txt
```

也可以先创建虚拟环境：

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r scripts/feishu/requirements.txt
```

## 配置 `.env`

复制示例配置：

```bash
cp scripts/feishu/.env.example scripts/feishu/.env
```

然后编辑 `scripts/feishu/.env`。

### 必填配置

```env
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_REDIRECT_URI=http://localhost:9000/
```

说明：

- `FEISHU_APP_ID`：飞书应用的 App ID。
- `FEISHU_APP_SECRET`：飞书应用的 App Secret。
- `FEISHU_REDIRECT_URI`：OAuth 回调地址，必须与飞书开放平台配置一致。

### 推荐配置

```env
FEISHU_WIKI_URL=https://pcn43kg7pnzs.feishu.cn/wiki/DG5cwq12EiuaQGk8UbtcaQKdnif
FEISHU_DOC_OUTPUT=docs/feishu_content.txt
FEISHU_SYNC_MODEL_TEMPLATE=true
FEISHU_MODEL_TEMPLATE_PATH=docs/模型介绍页模板.md
```

说明：

- `FEISHU_WIKI_URL`：要抓取的飞书 Wiki 链接，也可以填写 Wiki token。
- `FEISHU_DOC_OUTPUT`：保存原始抓取结果的路径。相对路径按仓库根目录解析。
- `FEISHU_SYNC_MODEL_TEMPLATE`：是否在抓取后同步生成模型介绍页模板，默认 `true`。
- `FEISHU_MODEL_TEMPLATE_PATH`：模型介绍页模板输出路径，默认 `docs/模型介绍页模板.md`。

### 可选配置

```env
FEISHU_OPEN_BROWSER=true
FEISHU_OAUTH_STATE=hotai-test
FEISHU_SAVE_USER_ACCESS_TOKEN=true
FEISHU_USER_ACCESS_TOKEN=u-xxx
FEISHU_FETCH_DOC_AFTER_AUTH=true
```

说明：

- `FEISHU_OPEN_BROWSER`：启动授权服务后是否自动打开浏览器，默认 `true`。
- `FEISHU_OAUTH_STATE`：OAuth state 校验值，默认 `hotai-test`。
- `FEISHU_SAVE_USER_ACCESS_TOKEN`：授权成功后是否把 token 写回 `.env`，默认 `true`。
- `FEISHU_USER_ACCESS_TOKEN`：已有用户 token。配置后可直接执行 `fetch`，无需每次重新授权。
- `FEISHU_FETCH_DOC_AFTER_AUTH`：授权成功后是否立即抓取文档，默认 `true`。

## 首次授权并自动更新

首次运行建议使用 `serve` 模式：

```bash
python scripts/feishu/main.py serve
```

脚本会启动本地服务并打开授权入口：

```text
http://localhost:9000/auth
```

授权成功后，脚本会：

1. 用 OAuth code 换取 `user_access_token`。
2. 如果 `FEISHU_SAVE_USER_ACCESS_TOKEN=true`，把 token 写入 `scripts/feishu/.env`。
3. 根据 `FEISHU_WIKI_URL` 抓取飞书文档。
4. 如果配置了 `FEISHU_DOC_OUTPUT`，保存原始抓取结果。
5. 如果 `FEISHU_SYNC_MODEL_TEMPLATE=true`，生成或覆盖模型介绍页模板。

成功时控制台会输出类似信息：

```text
文档标题: xxx
文档类型: sheet
文档 token: xxx
模型介绍页模板已更新: /path/to/HotAI/docs/模型介绍页模板.md
文档内容已写入: /path/to/HotAI/docs/feishu_content.txt
```

## 使用已有 token 手动更新

如果 `.env` 中已经有 `FEISHU_USER_ACCESS_TOKEN`，可以跳过浏览器授权，直接抓取并更新：

```bash
python scripts/feishu/main.py fetch
```

也可以临时指定 Wiki：

```bash
python scripts/feishu/main.py fetch "https://example.feishu.cn/wiki/xxxx"
```

或临时指定输出文件：

```bash
python scripts/feishu/main.py fetch --output docs/feishu_content.txt
```

注意：只要 `FEISHU_SYNC_MODEL_TEMPLATE` 未关闭，`fetch` 成功后也会同步更新模型介绍页模板。

## 定时自动更新

运维环境可用 cron 定时执行 `fetch`。示例：每天 03:10 更新一次。

```cron
10 3 * * * cd /home/bobby_2026/projects/HotAI && /usr/bin/python3 scripts/feishu/main.py fetch >> /tmp/hotai-feishu-sync.log 2>&1
```

建议：

- 先通过 `serve` 模式完成一次人工授权，让 `.env` 保存 `FEISHU_USER_ACCESS_TOKEN`。
- 确认定时任务运行用户能读取 `scripts/feishu/.env`。
- 确认定时任务运行用户有权限写入 `FEISHU_DOC_OUTPUT` 和 `FEISHU_MODEL_TEMPLATE_PATH`。
- 将日志输出到固定文件，便于排查飞书权限、token 过期或表格格式问题。

## 模型表格格式要求

脚本会从抓取结果中提取第一张 Markdown 表格，并按表头中的 `模型ID` 列识别模型。

表格必须包含 `模型ID` 列，例如：

```markdown
| 编号 | 模型ID | 模型名称 | 供应商 | 备注 |
| ---- | ---- | ---- | ---- | ---- |
| 1 | gpt-4o | GPT-4o | OpenAI | 多模态模型 |
| 2 | claude-3-5-sonnet | Claude 3.5 Sonnet | Anthropic | 文本模型 |
```

生成模型介绍页时：

- 空行会被跳过。
- `模型ID` 为空的行会被跳过。
- `编号` 和 `模型ID` 不会出现在每个模型的小表格属性中。
- 每个有效模型会生成一个 `## 模型ID` 小节。
- 页面顶部会显示有效模型总数。

生成结果示意：

```markdown
# 模型介绍

本平台提供的模型及其属性如下（共2款）：

## gpt-4o

| 属性 | 内容 |
| ---- | ---- |
| 模型名称 | GPT-4o |
| 供应商 | OpenAI |
| 备注 | 多模态模型 |
```

## 常用命令

启动授权服务：

```bash
python scripts/feishu/main.py serve
```

启动授权服务但不自动打开浏览器：

```bash
python scripts/feishu/main.py serve --no-open-browser
```

指定本地监听端口：

```bash
python scripts/feishu/main.py serve --port 9001
```

直接使用已有 token 抓取：

```bash
python scripts/feishu/main.py fetch
```

直接使用命令行 token 抓取：

```bash
python scripts/feishu/main.py fetch --user-access-token "u-xxx"
```

指定 @ 用户显示语言：

```bash
python scripts/feishu/main.py fetch --lang 1
```

`--lang 0` 表示默认名称，`--lang 1` 表示英文名称。

## 验证更新结果

执行更新后，检查以下文件：

```bash
ls -l docs/feishu_content.txt docs/模型介绍页模板.md
```

查看模型介绍页头部和前几个模型：

```bash
sed -n '1,80p' docs/模型介绍页模板.md
```

如果本次更新正确，应看到：

- 标题为 `# 模型介绍`。
- 总数显示为 `共N款`。
- 每个模型都有独立的 `## 模型ID` 小节。
- 每个小节下方都有 `属性 / 内容` 表格。

## 故障排查

### 缺少必要环境变量

报错示例：

```text
缺少必要环境变量: FEISHU_APP_ID
```

处理方式：

- 检查 `scripts/feishu/.env` 是否存在。
- 检查 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_REDIRECT_URI` 是否已配置。
- 确认命令是在仓库根目录执行，或脚本路径正确。

### OAuth 回调失败

常见原因：

- 飞书开放平台配置的重定向地址与 `FEISHU_REDIRECT_URI` 不一致。
- 本地端口已被占用。
- 浏览器访问的回调地址不是 `http://localhost:9000/`。

处理方式：

- 确认飞书开放平台回调地址和 `.env` 中完全一致。
- 如果端口冲突，改用 `--port 9001`，并同步修改 `FEISHU_REDIRECT_URI` 与飞书应用配置。

### 抓取失败或返回权限错误

常见原因：

- 运维账号没有目标 Wiki 的访问权限。
- 飞书应用未开通读取文档、读取电子表格或 Wiki 相关权限。
- `FEISHU_USER_ACCESS_TOKEN` 已过期或被撤销。

处理方式：

- 用浏览器确认运维账号可以打开 `FEISHU_WIKI_URL`。
- 检查飞书开放平台应用权限。
- 重新执行 `python scripts/feishu/main.py serve` 完成授权并刷新 token。

### 未生成模型介绍页

检查项：

- `FEISHU_SYNC_MODEL_TEMPLATE` 是否为 `false`。
- `FEISHU_MODEL_TEMPLATE_PATH` 是否可写。
- 飞书文档第一张表是否包含 `模型ID` 表头。
- 表格行是否存在非空 `模型ID`。

如果表格无法解析，脚本仍会生成模板头部，但模型总数可能为 0，并保留原始 Markdown 内容。

### 生成内容不完整

脚本只会提取抓取结果中的第一张 Markdown 表格。若飞书文档中有多个表格，请将模型清单放在第一张表，或调整飞书文档结构后重新执行更新。

## 安全注意事项

- 不要提交 `scripts/feishu/.env`。
- 不要在日志、截图或工单中泄露 `FEISHU_APP_SECRET` 和 `FEISHU_USER_ACCESS_TOKEN`。
- `FEISHU_USER_ACCESS_TOKEN` 代表授权用户身份，建议使用专门的运维账号授权。
- 定时任务日志应避免打印完整 token。如需排查 token 问题，优先重新授权。
