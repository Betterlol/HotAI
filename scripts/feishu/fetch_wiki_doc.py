# scripts/feishu/fetch_wiki_doc.py

"""
获取飞书知识库资源的文本内容。

输入 URL 中 /wiki/ 后面的 token 是知识库节点 token。本脚本会先将它解析
为实际云文档 token，再根据资源类型读取新版文档（docx）或电子表格（sheet）。
"""

from urllib.parse import urlparse

import requests


FEISHU_API_BASE = "https://open.feishu.cn/open-apis"
SUPPORTED_OBJ_TYPES = {"docx", "sheet"}


class FeishuApiError(RuntimeError):
    pass


def build_feishu_error(response, payload=None):
    """保留飞书返回体和 log_id，方便根据错误码定位权限或参数问题。"""
    log_id = response.headers.get("x-tt-logid")
    if payload is None:
        try:
            payload = response.json()
        except ValueError:
            payload = response.text

    detail = f"飞书 API 请求失败: HTTP {response.status_code}, response={payload}"
    if log_id:
        detail = f"{detail}, x-tt-logid={log_id}"
    return FeishuApiError(detail)


def extract_wiki_token(value):
    """从 Wiki URL 中提取节点 token；如果传入本身就是 token，则原样返回。"""
    if value.startswith("http://") or value.startswith("https://"):
        path_parts = [part for part in urlparse(value).path.split("/") if part]
        if len(path_parts) >= 2 and path_parts[0] == "wiki":
            return path_parts[1]
        raise ValueError(f"URL 不是有效的飞书知识库链接: {value}")
    return value


def request_json(method, url, *, user_access_token, **kwargs):
    """统一封装飞书 OpenAPI 请求、鉴权头、JSON 解析和错误处理。"""
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {user_access_token}"

    response = requests.request(method, url, headers=headers, timeout=20, **kwargs)
    if not response.ok:
        raise build_feishu_error(response)

    try:
        payload = response.json()
    except ValueError as exc:
        raise FeishuApiError(f"飞书 API 返回非 JSON 响应: {response.text}") from exc

    if payload.get("code") != 0:
        raise build_feishu_error(response, payload)
    return payload


def get_wiki_node(user_access_token, wiki_token):
    """查询 Wiki 节点，拿到背后的真实资源类型和 obj_token。"""
    payload = request_json(
        "GET",
        f"{FEISHU_API_BASE}/wiki/v2/spaces/get_node",
        user_access_token=user_access_token,
        params={"token": wiki_token},
    )
    return payload["data"]["node"]


def get_docx_raw_content(user_access_token, document_id, *, lang=0):
    """读取新版飞书文档 docx 的纯文本内容。"""
    payload = request_json(
        "GET",
        f"{FEISHU_API_BASE}/docx/v1/documents/{document_id}/raw_content",
        user_access_token=user_access_token,
        params={"lang": lang},
    )
    return payload["data"]["content"]


def get_spreadsheet_sheets(user_access_token, spreadsheet_token):
    """读取电子表格中的工作表列表。"""
    payload = request_json(
        "GET",
        f"{FEISHU_API_BASE}/sheets/v3/spreadsheets/{spreadsheet_token}/sheets/query",
        user_access_token=user_access_token,
    )
    return payload["data"].get("sheets", [])


def get_sheet_values(user_access_token, spreadsheet_token, sheet_id):
    """读取单个工作表的全部单元格值。"""
    payload = request_json(
        "GET",
        f"{FEISHU_API_BASE}/sheets/v2/spreadsheets/{spreadsheet_token}/values/{sheet_id}",
        user_access_token=user_access_token,
        params={
            "valueRenderOption": "ToString",
            "dateTimeRenderOption": "FormattedString",
        },
    )
    return payload["data"].get("valueRange", {}).get("values", [])


def stringify_cell(value):
    """将飞书单元格返回值规整成适合文本输出的字符串。"""
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(stringify_cell(item) for item in value if item is not None)
    if isinstance(value, dict):
        text = value.get("text") or value.get("name") or value.get("value")
        if text is not None:
            return stringify_cell(text)
    return str(value)


def normalize_table(values):
    """补齐不等长行，保证后续可以稳定转换为 Markdown 表格。"""
    if not values:
        return []

    width = max(len(row) for row in values)
    return [
        [stringify_cell(row[index]) if index < len(row) else "" for index in range(width)]
        for row in values
    ]


def escape_markdown_table_cell(value):
    """转义 Markdown 表格单元格中的特殊字符。"""
    return value.replace("\\", "\\\\").replace("|", "\\|").replace("\n", "<br>")


def values_to_markdown_table(values):
    """把二维单元格数组转换为 Markdown 表格文本。"""
    rows = normalize_table(values)
    if not rows:
        return "_空工作表_"

    header = [escape_markdown_table_cell(cell) for cell in rows[0]]
    body = [
        [escape_markdown_table_cell(cell) for cell in row]
        for row in rows[1:]
    ]
    separator = ["---"] * len(header)

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(separator) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in body)
    return "\n".join(lines)


def get_sheet_content(user_access_token, spreadsheet_token):
    """读取电子表格中所有可见的普通工作表，并合并为 Markdown 文本。"""
    sheets = get_spreadsheet_sheets(user_access_token, spreadsheet_token)
    if not sheets:
        return "未读取到任何工作表。"

    sections = []
    for sheet in sheets:
        if sheet.get("hidden"):
            continue
        if sheet.get("resource_type") != "sheet":
            continue

        title = sheet.get("title") or sheet["sheet_id"]
        values = get_sheet_values(user_access_token, spreadsheet_token, sheet["sheet_id"])
        sections.append(f"## {title}\n\n{values_to_markdown_table(values)}")

    if not sections:
        return "未读取到可导出的普通工作表。"
    return "\n\n".join(sections)


def fetch_wiki_doc_content(user_access_token, wiki_url_or_token, *, lang=0):
    """根据 Wiki 节点背后的资源类型，分发到 docx 或 sheet 的读取逻辑。"""
    wiki_token = extract_wiki_token(wiki_url_or_token)
    node = get_wiki_node(user_access_token, wiki_token)

    obj_type = node["obj_type"]
    obj_token = node["obj_token"]
    if obj_type == "docx":
        return node, get_docx_raw_content(user_access_token, obj_token, lang=lang)
    if obj_type == "sheet":
        return node, get_sheet_content(user_access_token, obj_token)

    if obj_type not in SUPPORTED_OBJ_TYPES:
        raise NotImplementedError(
            f"暂不支持的知识库对象类型: {obj_type!r}。"
            f"当前脚本支持的类型: {', '.join(sorted(SUPPORTED_OBJ_TYPES))}。"
        )


if __name__ == "__main__":
    from main import main
    import sys

    if len(sys.argv) == 1 or sys.argv[1] not in {"serve", "fetch"}:
        sys.argv.insert(1, "fetch")
    main()
