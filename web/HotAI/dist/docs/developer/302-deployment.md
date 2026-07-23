# 部署与运维指南

## 本地运行方式

### 路线 A：SQLite 快速体验

适合快速启动，不依赖 Docker。

1. 安装 Go。

Go 建议使用项目当前支持的版本。安装后确认：

```bash
go version
```

当前 HotAI 运行前端位于 `web/HotAI/dist`，由 Go embed 嵌入后端二进制。仅修改这套静态前端时，不需要单独启动 React/Rsbuild 前端。

2. 编译并运行后端。

```bash
cd ~/projects/HotAI
go build -o new-api .
./new-api
```

默认监听：

```text
http://localhost:3000
```

首次启动会自动创建 SQLite 数据库文件。初始 root 密码会打印在终端日志里。

### 路线 B：开发模式

适合日常开发。后端、PostgreSQL、Redis 使用 Docker Compose，当前 HotAI 静态前端由后端直接服务。

启动后端、数据库和 Redis：

```bash
cd ~/projects/HotAI
docker compose -f docker-compose.dev.yml up -d --build
```

查看后端日志：

```bash
docker compose -f docker-compose.dev.yml logs -f new-api
```

访问地址：

```text
HotAI：http://localhost:3000
```

如果专门维护 `web/default` 上游 React 前端，可单独使用 Bun 和 Rsbuild dev server；这不是当前 HotAI 嵌入前端的默认开发方式。

后续开发常用命令：

```bash
# Go 代码或嵌入静态资源变更后，重建后端镜像
docker compose -f docker-compose.dev.yml up -d --build new-api

# 静态资源缓存异常时，强制无缓存重建
docker compose -f docker-compose.dev.yml build --no-cache new-api
docker compose -f docker-compose.dev.yml up -d new-api

# 停止服务
docker compose -f docker-compose.dev.yml down

# 清空数据卷后重来
docker compose -f docker-compose.dev.yml down -v
```

### 路线 C：完整 Docker Compose

适合完整测试或接近生产的本地验证。

```bash
cd ~/projects/HotAI
cp .env.example .env
docker compose up -d
```

访问：

```text
http://localhost:2000
```

## 远程部署流程

### 1. 本地验证

本地开发和测试通过后再构建远程镜像。

后端 Go 代码或 `web/HotAI/dist` 嵌入静态资源改动需要重建后端：

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

### 2. 构建镜像

建议使用 git tag 或 commit hash 管理镜像 tag。

```bash
export APP_IMAGE=ghcr.io/betterlol/hotai:版本号
docker compose -f docker-compose.build.yml build
```

也可以使用当前 commit：

```bash
export APP_IMAGE=ghcr.io/betterlol/hotai:$(git rev-parse --short HEAD)
docker compose -f docker-compose.build.yml build
```

### 3. 推送镜像

```bash
export APP_IMAGE=ghcr.io/betterlol/hotai:版本号
docker login ghcr.io
docker compose -f docker-compose.build.yml push
```

### 4. 远程拉取并启动

登录远程服务器后，进入部署目录，修改 `.env` 中的 `APP_IMAGE`，然后执行：

```bash
docker compose pull
docker compose up -d
```

## 常见构建问题

### 拉取 Docker 基础镜像失败

典型错误：

```text
ERROR [internal] load metadata for docker.io/library/debian:bookworm-slim
```

处理方式：

- 检查网络和代理。
- 必要时配置 Docker registry mirrors。
- 在受限网络下，通常需要可访问 Docker Hub 的网络环境。

示例 Docker Engine registry mirror 配置：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
```

### 卡在 `go mod download`

可配置 Go 代理：

```bash
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=sum.golang.google.cn
```

Docker 构建时也可以通过 compose build args 使用 `GOPROXY`。

## 性能分析

HotAI 支持 pprof 和 Pyroscope 两类性能分析能力：

- pprof：适合临时诊断与离线分析。
- Pyroscope：适合线上持续分析与火焰图可视化。

### pprof

配置环境变量：

```yaml
environment:
  ENABLE_PPROF: "true"
```

重启服务：

```bash
docker compose restart new-api
```

验证：

```bash
curl http://localhost:8005/debug/pprof/
```

pprof 监听端口当前在代码中固定为 `8005`。容器部署时需要映射该端口。

### Pyroscope

启动 Pyroscope：

```bash
docker run -d \
  -p 4040:4040 \
  --name pyroscope \
  grafana/pyroscope:latest
```

配置 HotAI：

```yaml
environment:
  PYROSCOPE_URL: "http://pyroscope:4040"
  PYROSCOPE_APP_NAME: "hotai"
```

重启后访问：

```text
http://localhost:4040
```

## 性能分析故障排查

pprof 无法访问时：

- 确认 `ENABLE_PPROF=true`。
- 确认 `8005` 端口已映射且未被占用。
- 检查容器端口映射、防火墙和反向代理配置。

Pyroscope 连接失败时：

- 确认 Pyroscope 服务已启动。
- 确认 HotAI 容器能访问 `PYROSCOPE_URL`。
- 检查应用名称和网络配置。
