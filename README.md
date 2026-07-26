# HotAI

基于 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 二次开发的 AI 模型 API 聚合平台。

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the project
git clone https://github.com/Betterlol/HotAI.git
cd HotAI

# Start service
docker compose up -d
# Access the service at http://localhost:2000
```

## 实现的功能

- **HotAI 品牌 UI** — 定制化运营页面，替换上游开源品牌，提供统一的管理面板体验
- **智能路由** — 在静态 Priority/Weight 基础上叠加熔断器、延迟感知、成功率和成本加权评分，动态择优分发请求
- **成本优化** — 扩展渠道定价字段，支持自动同步系统倍率，评分路由优先选择低成本渠道
- **运维监控** — Prometheus 指标端点（请求量、延迟、Token、成本、渠道状态、上游错误等）及自动化告警规则（成功率下降、余额不足、模型不可用）

---

## 项目说明

HotAI 基于 New API 开源项目进行二次开发。

原项目文档：

- <a href="./new-api-docs/README.md">New API README</a>

许可证：

- <a href="./LICENSE">New API LICENSE</a>

三方许可：

- <a href="./new-api-docs/THIRD-PARTY-LICENSES.md">New API THIRD-PARTY-LICENSES</a>

原项目：

- https://github.com/QuantumNous/new-api