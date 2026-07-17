# scripts/feishu/oauth_server.py

"""
飞书 OAuth 本地回调服务。

负责生成授权链接、处理授权回调、换取 user_access_token，并执行授权成功后的处理逻辑。
"""

from urllib.parse import urlencode

from flask import Flask, redirect, request
import requests

from fetch_wiki_doc import fetch_wiki_doc_content


TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/access_token"
AUTH_URL = "https://accounts.feishu.cn/open-apis/authen/v1/index"


def build_auth_url(app_id, redirect_uri, state):
    """构造飞书 OAuth 授权页 URL。"""
    query = urlencode({
        "app_id": app_id,
        "redirect_uri": redirect_uri,
        "state": state,
    })
    return f"{AUTH_URL}?{query}"


def exchange_code_for_user_access_token(app_id, app_secret, code):
    """用 OAuth 回调中的 code 换取 user_access_token。"""
    payload = {
        "app_id": app_id,
        "app_secret": app_secret,
        "code": code,
        "grant_type": "authorization_code",
    }

    response = requests.post(TOKEN_URL, json=payload, timeout=20)
    try:
        result = response.json()
    except ValueError as exc:
        response.raise_for_status()
        raise RuntimeError(f"飞书 Token 接口返回非 JSON 响应: {response.text}") from exc

    if not response.ok:
        raise RuntimeError(f"飞书 Token 接口请求失败: HTTP {response.status_code}, response={result}")
    if result.get("code") != 0:
        raise RuntimeError(f"获取 Token 失败: {result}")
    return result["data"]


def fetch_doc_after_auth(access_token, config):
    """授权成功后立即使用新 token 抓取配置中的 Wiki 资源。"""
    node, content = fetch_wiki_doc_content(
        access_token,
        config["wiki_url"],
        lang=config["lang"],
    )

    print(f"文档标题: {node['title']}")
    print(f"文档类型: {node['obj_type']}")
    print(f"文档 token: {node['obj_token']}")

    if config["doc_output"]:
        output_path = config["write_content"](config["doc_output"], content)
        print(f"文档内容已写入: {output_path}")
    else:
        template_path = config["sync_model_template"](content)
        if template_path:
            print(f"模型介绍页模板已更新: {template_path}")
        print("文档内容:")
        print(content)

    return node, content


def create_app(config):
    """创建 Flask 应用；所有运行配置都由 main.py 注入。"""
    app = Flask(__name__)

    @app.route("/auth")
    def auth():
        return redirect(
            build_auth_url(
                config["app_id"],
                config["redirect_uri"],
                config["oauth_state"],
            )
        )

    @app.route("/")
    def callback():
        # 飞书 OAuth 回调会携带 code 和 state，state 用于防止串改请求。
        code = request.args.get("code")
        state = request.args.get("state")

        if not code:
            return "授权失败，未获取到授权码", 400
        if state != config["oauth_state"]:
            return "授权失败，state 不匹配", 400

        print(f"成功获取授权码: {code}")

        # code 只能使用一次，拿到后立即换取 user_access_token。
        try:
            token_data = exchange_code_for_user_access_token(
                config["app_id"],
                config["app_secret"],
                code,
            )
        except Exception as exc:
            print(f"❌ 获取 Token 失败: {exc}")
            return f"授权失败: {exc}", 400

        access_token = token_data["access_token"]
        print(f"✅ 获取 Token 成功: {access_token}")
        if config["save_user_access_token"]:
            # 保存 token 只是为了后续 fetch 复用；本次抓取会直接使用内存中的新 token。
            config["save_user_access_token"](access_token)

        if not config["fetch_doc_after_auth"]:
            return "授权成功！user_access_token 已打印到控制台，已跳过文档抓取。"

        try:
            node, content = fetch_doc_after_auth(access_token, config)
        except Exception as exc:
            print(f"❌ 文档抓取失败: {exc}")
            return f"授权成功，但文档抓取失败: {exc}", 500

        output_msg = (
            f"文档内容已写入 {config['doc_output']}"
            if config["doc_output"]
            else "文档内容已打印到控制台"
        )
        return (
            f"授权成功，并已完成文档抓取！<br>"
            f"标题：{node['title']}<br>"
            f"内容长度：{len(content)} 字符<br>"
            f"{output_msg}"
        )

    return app


if __name__ == "__main__":
    from main import main
    import sys

    if len(sys.argv) == 1:
        sys.argv.append("serve")
    main()
