# scripts/feishu/main.py

"""
飞书文档抓取工具统一入口。

默认启动本地 OAuth 授权服务；也可以使用 fetch 子命令，直接用已有
user_access_token 抓取知识库文档内容。
"""

import argparse
import os
import subprocess
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from threading import Timer

from dotenv import load_dotenv

from fetch_wiki_doc import fetch_wiki_doc_content
from oauth_server import build_auth_url, create_app


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_WIKI_URL = "https://pcn43kg7pnzs.feishu.cn/wiki/DG5cwq12EiuaQGk8UbtcaQKdnif"
DEFAULT_MODEL_TEMPLATE_PATH = "docs/模型介绍页模板.md"

MODEL_ID_COLUMN = "模型ID"
MODEL_TEMPLATE_IGNORED_COLUMNS = {"编号", MODEL_ID_COLUMN}
MODEL_TEMPLATE_HEADER = "# 模型介绍\n\n本平台提供的模型及其属性如下（共{count}款）："


@dataclass(frozen=True)
class ModelTable:
    header: list[str]
    model_id_index: int
    rows: list[list[str]]


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
    """写入抓取结果，并按配置同步模型介绍页模板。"""
    path = repo_path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

    template_path = sync_model_template_from_content(content)
    if template_path:
        print(f"模型介绍页模板已更新: {template_path}")
    return path


def sync_model_template_from_content(content):
    """按配置把本次抓取结果同步写入模型介绍页模板。"""
    if not env_bool("FEISHU_SYNC_MODEL_TEMPLATE", True):
        return None

    template_path = os.getenv("FEISHU_MODEL_TEMPLATE_PATH", DEFAULT_MODEL_TEMPLATE_PATH)
    markdown_table = extract_first_markdown_table(content)
    return write_model_template_file(template_path, markdown_table)


def write_model_template_file(template_path, markdown_table):
    """把 Markdown 表格渲染为模型介绍模板文件。"""
    path = repo_path(template_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_model_template(markdown_table), encoding="utf-8")
    return path


def render_model_template(markdown_table):
    """渲染完整模型介绍页，包括模型总数和分模型小表格。"""
    model_table = parse_model_table(markdown_table)
    if not model_table:
        header = MODEL_TEMPLATE_HEADER.format(count=0)
        return f"{header}\n\n{markdown_table.strip()}\n"

    sections = []
    model_count = 0
    for row in model_table.rows:
        if not any(cell.strip() for cell in row):
            continue
        if model_table.model_id_index >= len(row):
            continue

        model_id = row[model_table.model_id_index].strip()
        if not model_id:
            continue

        model_count += 1
        lines = [
            f"## {model_id}",
            "",
            "| 属性 | 内容 |",
            "| ---- | ---- |",
        ]
        for index, name in enumerate(model_table.header):
            name = name.strip()
            if not name or name in MODEL_TEMPLATE_IGNORED_COLUMNS:
                continue
            value = row[index].strip() if index < len(row) else ""
            lines.append(f"| {name} | {value} |")

        sections.append("\n".join(lines))

    header = MODEL_TEMPLATE_HEADER.format(count=model_count)
    body = "\n\n".join(sections) if sections else markdown_table.strip()
    return f"{header}\n\n{body}\n"


def extract_first_markdown_table(content):
    """从抓取结果中提取第一段 Markdown 表格，忽略工作表标题等说明文本。"""
    table_lines = []
    in_table = False
    for line in content.splitlines():
        if line.startswith("|"):
            table_lines.append(line)
            in_table = True
        elif in_table:
            break

    return "\n".join(table_lines) if table_lines else content


def parse_model_table(markdown_table):
    """解析模型 Markdown 表格，返回表头、`模型ID` 列位置和数据行。"""
    rows = [
        split_markdown_row(line)
        for line in markdown_table.splitlines()
        if line.startswith("|")
    ]
    if len(rows) < 2:
        return None

    header = rows[0]
    try:
        model_id_index = header.index(MODEL_ID_COLUMN)
    except ValueError:
        return None

    body_rows = rows[1:]
    if len(rows) > 1 and is_markdown_table_separator(rows[1]):
        body_rows = rows[2:]
    return ModelTable(header=header, model_id_index=model_id_index, rows=body_rows)


def split_markdown_row(line):
    """按 Markdown 表格分隔符拆分一行，保留单元格内已转义的竖线。"""
    text = line.strip()
    if text.startswith("|"):
        text = text[1:]
    if text.endswith("|"):
        text = text[:-1]

    cells = []
    cell = []
    backslash_count = 0  # 当前字符前连续反斜杠数量，用于判断竖线是否被转义。
    for char in text:
        if char == "|" and backslash_count % 2 == 0:  # 偶数个反斜杠表示当前竖线未被转义。
            cells.append("".join(cell).strip())
            cell = []
            backslash_count = 0
            continue

        cell.append(char)
        if char == "\\":
            backslash_count += 1
        else:
            backslash_count = 0

    cells.append("".join(cell).strip())
    return cells


def is_markdown_table_separator(cells):
    """判断是否为 Markdown 表格中的分隔行。"""
    if not cells:
        return False

    for cell in cells:
        normalized = cell.replace(" ", "")
        dashes = normalized.strip(":")
        if len(dashes) < 3 or set(dashes) != {"-"}:
            return False
    return True


def build_oauth_server_config(args):
    """汇总命令行参数和环境变量，生成传给 OAuth 服务的配置对象。"""
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
        "sync_model_template": sync_model_template_from_content,
        "lang": args.lang,
    }


def run_server(args):
    """启动本地 OAuth 服务，并按配置自动打开授权入口。"""
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
    user_access_token = args.user_access_token or os.getenv("FEISHU_USER_ACCESS_TOKEN")
    if not user_access_token:
        raise RuntimeError(
            "缺少 user_access_token。请在 scripts/feishu/.env 中设置 "
            "FEISHU_USER_ACCESS_TOKEN，或通过 --user-access-token 传入。"
        )

    wiki_url = args.wiki or os.getenv("FEISHU_WIKI_URL", DEFAULT_WIKI_URL)
    output = args.output or os.getenv("FEISHU_DOC_OUTPUT")
    node, content = fetch_wiki_doc_content(user_access_token, wiki_url, lang=args.lang)

    print(f"title: {node['title']}")
    print(f"obj_type: {node['obj_type']}")
    print(f"obj_token: {node['obj_token']}")

    if output:
        output_path = write_fetched_content(output, content)
        print(f"内容已写入: {output_path}")
    else:
        template_path = sync_model_template_from_content(content)
        if template_path:
            print(f"模型介绍页模板已更新: {template_path}")
        print()
        print(content)


def add_wiki_fetch_arguments(parser, *, positional_wiki):
    """给 serve/fetch 子命令添加共用抓取参数。"""
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

    args = parser.parse_args()
    if args.command is None:
        args = parser.parse_args(["serve"])
    return args


def main():
    """程序入口：先加载配置，再分发到 serve 或 fetch。"""
    load_local_env()
    args = parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
