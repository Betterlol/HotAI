# 项目记录与第三方接口

## 历史占位更新记录

原前端文档中曾包含一组占位式版本更新记录。这些内容仅能作为历史来源参考，不代表当前图灵智算已实现功能。当前功能说明应以实际代码、真实 git tag、GitHub Releases、PR 记录和管理台页面为准。

以下条目不要作为当前版本能力声明：

- **React 19 前端界面：** 当前实际嵌入并服务的是图灵智算静态前端。
- **WebAuthn/Passkeys 登录：** 后端保留相关路由，但当前图灵智算登录页未接入完整登录流程。
- **Prometheus 和 Grafana 集成：** Prometheus 指标接口可按后端实际路由确认，Grafana 集成不作为当前文档承诺。
- **API Key 自动轮换：** 当前文档不声明已实现。
- **优雅关闭机制：** 当前文档不声明已实现。
- **JWT 用户登录态：** 当前后台用户登录态使用 Gin session/cookie，不以 JWT 作为主登录态。

如需发布版本说明，请基于真实变更重新整理，不要直接沿用占位更新记录。

## io.net 接口调试记录

**原始记录：**

```text
Request URL
https://api.io.solutions/v1/io-cloud/clusters/654fc0a9-0d4a-4db4-9b95-3f56189348a2/update-name
Request Method
PUT

{"status":"succeeded","message":"Cluster name updated successfully"}
```

该记录仅用于追踪一次外部接口调试结果，不属于用户前端文档。
