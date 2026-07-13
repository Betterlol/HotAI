# 快速开始

欢迎使用 HotAI 文档中心！这是一个基于 Markdown 的文档系统示例。

## 系统要求

在开始之前，请确保您的环境满足以下要求：

- Node.js >= 16.0.0
- Go >= 1.22
- Docker (可选)
- Redis (可选)

## 安装步骤

### 1. 克隆仓库

首先克隆项目仓库到本地：

```bash
git clone https://github.com/Betterlol/HotAI.git
cd HotAI
```

### 2. 安装依赖

使用以下命令安装项目依赖：

```bash
# 前端依赖
cd web/default
bun install

# 返回根目录
cd ../..

# Go 依赖
go mod download
```

### 3. 配置环境变量

复制环境变量模板文件并进行配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的参数：

```env
# 数据库配置
DB_TYPE=sqlite
DB_PATH=./data/hotai.db

# Redis 配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379

# 服务端口
PORT=3000
```

## 启动服务

### 开发模式

```bash
# 启动后端
go run main.go

# 启动前端（新终端）
cd web/default
bun run dev
```

### 生产模式

使用 Docker Compose 快速启动：

```bash
docker compose up -d
```

## 验证安装

访问以下地址验证服务是否正常运行：

- 前端界面: [http://localhost:3000](http://localhost:3000)
- API 文档: [http://localhost:3000/swagger](http://localhost:3000/swagger)

## 下一步

- 阅读 [项目介绍](intro.md) 了解更多架构信息
- 查看 [用户指南](user-guide.md) 学习如何使用系统
- 浏览 [管理员指南](admin-guide.md) 了解管理功能

## 常见问题

### 端口被占用

如果 3000 端口已被占用，可以在 `.env` 中修改端口号：

```env
PORT=8080
```

### 数据库连接失败

确保数据库配置正确，并且数据库服务已启动。对于 SQLite，确保数据目录有写入权限。

## 获取帮助

如果遇到问题，可以：

- 查看 [GitHub Issues](https://github.com/Betterlol/HotAI/issues)
- 加入我们的社区讨论
- 阅读详细文档

---

**提示**: 本文档是使用 Markdown 格式编写的示例文档，右侧目录是根据标题自动生成的。