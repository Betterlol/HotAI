# scripts/feishu/main.py

"""
飞书文档抓取命令行入口。

负责加载本地配置、解析子命令，并串联授权、抓取、检查和文件写入流程。
"""

import argparse
import os
import subprocess
import webbrowser
from pathlib import Path
from threading import Timer

from dotenv import load_dotenv

from fetch_wiki_doc import fetch_wiki_doc_content
from table_processor import (
    check_table_content,
    extract_first_markdown_table,
    print_check_report,
    render_model_info,
)


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_WIKI_URL = "https://pcn43kg7pnzs.feishu.cn/wiki/DG5cwq12EiuaQGk8UbtcaQKdnif"
DEFAULT_MODEL_INFO_PATH = "web/HotAI/dist/docs/user/103-model-info.md"


def load_local_env():
    """加载与脚本同目录的 .env，统一管理本工具的运行配置。"""
    load_dotenv(SCRIPT_DIR / ".env")


def env_bool(name, default=False):
    """按常见布尔字符串解析环境变量。"""
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def require_env(name):
    """读取必填环境变量，缺失时立即给出明确错误。"""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"缺少必要环境变量: {name}")
    return value


def repo_path(path):
    """把相对路径解析到仓库根目录下。"""
    resolved = Path(path)
    if not resolved.is_absolute():
        resolved = REPO_ROOT / resolved
    return resolved


def upsert_env_value(path, key, value):
    """新增或更新 .env 中的单个 key，保留其它配置行不变。"""
    lines = []
    found = False
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()

    updated_lines = []
    for line in lines:
        if line.startswith(f"{key}="):
            updated_lines.append(f"{key}={value}")
            found = True
        else:
            updated_lines.append(line)

    if not found:
        updated_lines.append(f"{key}={value}")

    path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")


def save_user_access_token(access_token):
    """把 OAuth 新获取的 user_access_token 写回 .env，便于后续 fetch 复用。"""
    upsert_env_value(SCRIPT_DIR / ".env", "FEISHU_USER_ACCESS_TOKEN", access_token)
    print("user_access_token 已写入 scripts/feishu/.env")


def running_in_wsl():
    """检测当前进程是否运行在 WSL 中，用于选择合适的浏览器打开方式。"""
    try:
        os_release = Path("/proc/sys/kernel/osrelease").read_text(encoding="utf-8")
    except OSError:
        return False
    return "microsoft" in os_release.lower() or "wsl" in os_release.lower()


def open_url_in_browser(url):
    """打开授权入口；WSL 下优先调用 Windows 默认浏览器。"""
    if running_in_wsl():
        try:
            subprocess.Popen(
                ["cmd.exe", "/c", "start", "", url],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return True
        except OSError:
            pass

    return webbrowser.open(url)


def write_fetched_content(output_path, content):
    """保存抓取结果，并按配置同步模型介绍页。"""
    path = repo_path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

    info_path = sync_model_info_from_content(content)
    if info_path:
        print(f"模型介绍页已更新: {info_path}")
    return path


def sync_model_info_from_content(content):
    """从抓取结果的第一张表格生成模型介绍页。"""
    if not env_bool("FEISHU_SYNC_MODEL_INFO", True):
        return None

    info_path = os.getenv("FEISHU_MODEL_INFO_PATH", DEFAULT_MODEL_INFO_PATH)
    markdown_table = extract_first_markdown_table(content)
    return write_model_info_file(info_path, markdown_table)


def write_model_info_file(info_path, markdown_table):
    """渲染并写入模型介绍页文件。"""
    path = repo_path(info_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_model_info(markdown_table), encoding="utf-8")
    return path


def get_user_access_token(args):
    """读取命令行或环境变量中的飞书 user_access_token。"""
    user_access_token = args.user_access_token or os.getenv("FEISHU_USER_ACCESS_TOKEN")
    if not user_access_token:
        raise RuntimeError(
            "缺少 user_access_token。请在 scripts/feishu/.env 中设置 "
            "FEISHU_USER_ACCESS_TOKEN，或通过 --user-access-token 传入。"
        )
    return user_access_token


def print_wiki_node(node):
    """输出本次读取到的飞书 Wiki 资源信息。"""
    print(f"title: {node['title']}")
    print(f"obj_type: {node['obj_type']}")
    print(f"obj_token: {node['obj_token']}")


def build_oauth_server_config(args):
    """汇总命令行参数和环境变量，生成 OAuth 回调服务配置。"""
    return {
        "app_id": require_env("FEISHU_APP_ID"),
        "app_secret": require_env("FEISHU_APP_SECRET"),
        "redirect_uri": require_env("FEISHU_REDIRECT_URI"),
        "oauth_state": os.getenv("FEISHU_OAUTH_STATE", "hotai-test"),
        "save_user_access_token": save_user_access_token if env_bool("FEISHU_SAVE_USER_ACCESS_TOKEN", True) else None,
        "wiki_url": args.wiki or os.getenv("FEISHU_WIKI_URL", DEFAULT_WIKI_URL),
        "fetch_doc_after_auth": env_bool("FEISHU_FETCH_DOC_AFTER_AUTH", True),
        "write_content": write_fetched_content,
        "doc_output": args.output or os.getenv("FEISHU_DOC_OUTPUT"),
        "sync_model_info": sync_model_info_from_content,
        "lang": args.lang,
    }


def run_server(args):
    """启动本地 OAuth 服务，并按配置自动打开授权入口。"""
    from oauth_server import build_auth_url, create_app

    config = build_oauth_server_config(args)
    app = create_app(config)

    auth_url = build_auth_url(
        config["app_id"],
        config["redirect_uri"],
        config["oauth_state"],
    )
    browser_host = "localhost" if args.host in {"0.0.0.0", "::"} else args.host
    local_auth_url = f"http://{browser_host}:{args.port}/auth"

    should_open_browser = args.open_browser
    if should_open_browser is None:
        should_open_browser = env_bool("FEISHU_OPEN_BROWSER", True)
    if should_open_browser:
        print(f"将自动打开浏览器访问: {local_auth_url}")
        print(f"若自动打开失败，可手动打开本地入口: {local_auth_url}")
        print(f"也可直接打开飞书授权链接: {auth_url}")
        Timer(1.0, open_url_in_browser, args=(local_auth_url,)).start()
    else:
        print(f"请手动打开本地入口: {local_auth_url}")
        print(f"或直接打开飞书授权链接: {auth_url}")

    app.run(host=args.host, port=args.port, debug=args.debug)


def run_fetch(args):
    """跳过 OAuth，直接使用已有 user_access_token 抓取文档内容。"""
    user_access_token = get_user_access_token(args)
    wiki_url = args.wiki or os.getenv("FEISHU_WIKI_URL", DEFAULT_WIKI_URL)
    output = args.output or os.getenv("FEISHU_DOC_OUTPUT")
    node, content = fetch_wiki_doc_content(user_access_token, wiki_url, lang=args.lang)

    print_wiki_node(node)

    if output:
        output_path = write_fetched_content(output, content)
        print(f"内容已写入: {output_path}")
    else:
        info_path = sync_model_info_from_content(content)
        if info_path:
            print(f"模型介绍页已更新: {info_path}")
        print()
        print(content)


def run_check(args):
    """检查飞书源表或本地抓取文件中的模型清单。"""
    if args.input:
        content = repo_path(args.input).read_text(encoding="utf-8")
        print(f"检查本地文件: {repo_path(args.input)}")
    else:
        user_access_token = get_user_access_token(args)
        wiki_url = args.wiki or os.getenv("FEISHU_WIKI_URL", DEFAULT_WIKI_URL)
        node, content = fetch_wiki_doc_content(user_access_token, wiki_url, lang=args.lang)
        print_wiki_node(node)

    result = check_table_content(content)
    print_check_report(result)
    if result.errors:
        raise SystemExit(1)


def add_wiki_fetch_arguments(parser, *, positional_wiki, include_output=True):
    """给需要读取 Wiki 的子命令添加共用参数。"""
    if positional_wiki:
        parser.add_argument(
            "wiki",
            nargs="?",
            help="飞书知识库 URL 或 wiki token，默认读取 FEISHU_WIKI_URL。",
        )
    else:
        parser.add_argument(
            "--wiki",
            help="飞书知识库 URL 或 wiki token，默认读取 FEISHU_WIKI_URL。",
        )

    if include_output:
        parser.add_argument(
            "--output",
            help="文档内容输出路径，默认读取 FEISHU_DOC_OUTPUT。",
        )
    parser.add_argument(
        "--lang",
        type=int,
        default=0,
        help="@用户 的显示语言：0 为默认名称，1 为英文名称。",
    )


def parse_args():
    """解析 CLI 子命令；未指定子命令时默认进入 serve 模式。"""
    parser = argparse.ArgumentParser(description="飞书 OAuth 授权与知识库文档抓取工具。")
    subparsers = parser.add_subparsers(dest="command")

    server_parser = subparsers.add_parser(
        "serve",
        help="启动本地 OAuth 授权服务，授权成功后可自动抓取文档。",
    )
    add_wiki_fetch_arguments(server_parser, positional_wiki=False)
    server_parser.add_argument("--host", default="localhost", help="本地服务监听地址。")
    server_parser.add_argument("--port", type=int, default=9000, help="本地服务端口。")
    server_parser.add_argument("--debug", action="store_true", help="启用 Flask debug 模式。")
    server_parser.add_argument(
        "--open-browser",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="启动服务后是否自动打开授权入口。",
    )
    server_parser.set_defaults(func=run_server)

    fetch_parser = subparsers.add_parser(
        "fetch",
        help="直接使用已有 user_access_token 抓取文档。",
    )
    add_wiki_fetch_arguments(fetch_parser, positional_wiki=True)
    fetch_parser.add_argument(
        "--user-access-token",
        help="飞书 user_access_token，默认读取 FEISHU_USER_ACCESS_TOKEN。",
    )
    fetch_parser.set_defaults(func=run_fetch)

    check_parser = subparsers.add_parser(
        "check",
        help="检查模型表格关键字段是否完整。",
    )
    add_wiki_fetch_arguments(check_parser, positional_wiki=True, include_output=False)
    check_parser.add_argument(
        "--user-access-token",
        help="飞书 user_access_token，默认读取 FEISHU_USER_ACCESS_TOKEN。",
    )
    check_parser.add_argument(
        "--input",
        help="检查本地已抓取内容文件；指定后不访问飞书。",
    )
    check_parser.set_defaults(func=run_check)

    args = parser.parse_args()
    if args.command is None:
        args = parser.parse_args(["serve"])
    return args


def main():
    """加载本地配置并执行对应子命令。"""
    load_local_env()
    args = parse_args()
    args.func(args)


if __name__ == "__main__":
    main()