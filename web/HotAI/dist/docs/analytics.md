# 分析工具设置指南

## 概述

HotAI 支持集成 Prometheus 和 Grafana 进行系统监控和数据分析。通过这些工具，您可以实时监控系统性能、API 调用情况、资源使用等关键指标，并通过可视化面板直观地展示数据趋势。

本指南将帮助您完成 Prometheus 和 Grafana 的部署配置，建立完整的监控体系。

## 配置 Prometheus

### 1. 启用 Prometheus 指标

在 HotAI 中启用 Prometheus 指标导出：
yaml
environment:

ENABLE_PPROF=true

### 2. 重启应用

应用 pprof 配置后重启服务：

bash
docker-compose restart hotai


### 3. 验证

访问 pprof 端点确认启用成功：

bash
curl http://localhost:6060/debug/pprof/


成功访问后，您可以使用 go tool pprof 进行离线分析，或通过浏览器查看实时火焰图。

## Pyroscope 设置

### 1. 准备 Pyroscope 服务

使用 Docker 部署 Pyroscope 服务器：

bash
docker run -d
-p 4040:4040
–name pyroscope
grafana/pyroscope:latest


### 2. 配置环境变量

在 HotAI 中启用 Pyroscope 集成：

yaml
environment:

ENABLE_PYROSCOPE=true
PYROSCOPE_SERVER_ADDRESS=http://pyroscope:4040
PYROSCOPE_APPLICATION_NAME=hotai

### 3. 重启应用

应用配置后重启 HotAI：

bash
docker-compose restart hotai


### 4. 验证

访问 Pyroscope Web UI 查看性能数据：

- 打开浏览器访问：http://localhost:4040
- 选择应用名称：hotai
- 查看 CPU、内存、goroutine 等性能指标的火焰图

## 故障排除

### pprof 无法访问

检查以下配置：

- 确认 ENABLE_PPROF=true 已设置
- 确认端口 6060 没有被占用
- 检查防火墙设置

### Pyroscope 连接失败

可能的原因和解决方案：

- Pyroscope 服务未启动：检查服务状态
- 网络不通：确认 HotAI 可以访问 Pyroscope 服务地址
- 配置错误：检查 PYROSCOPE_SERVER_ADDRESS 是否正确

## 环境变量参考

完整的性能分析相关环境变量：

- **ENABLE_PPROF：**是否启用 pprof（默认 false）
- **PPROF_PORT：**pprof 监听端口（默认 6060）
- **ENABLE_PYROSCOPE：**是否启用 Pyroscope（默认 false）
- **PYROSCOPE_SERVER_ADDRESS：**Pyroscope 服务器地址
- **PYROSCOPE_APPLICATION_NAME：**应用名称标识

## 相关链接

- [Go pprof 官方文档](https://pkg.go.dev/net/http/pprof)
- [Pyroscope 官方文档](https://grafana.com/oss/pyroscope/)
- [pprof 使用指南](https://go.dev/blog/pprof)