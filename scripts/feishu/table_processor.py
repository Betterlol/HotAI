# scripts/feishu/table_processor.py

"""
飞书表格处理工具。

负责从 Markdown 文本中提取模型清单、生成模型介绍页，并检查模型资料完整性。
"""

from dataclasses import dataclass


MODEL_ID_COLUMN = "模型ID"
MODEL_INFO_IGNORED_COLUMNS = {"编号", MODEL_ID_COLUMN}
MODEL_INFO_HEADER = "# 模型总览\n\n本平台提供的模型及其属性如下（**共 {count} 款**）："

CHECK_REQUIRED_FIELD_ALIASES = (
    ("模型ID", ("模型ID", "名称", "模型名", "模型名称")),
    ("提供商", ("提供商", "来源", "供应商")),
    ("适用场景", ("适用场景", "应用", "应用场景", "适合场景")),
    ("模型能力", ("模型能力", "能力", "能力说明")),
    ("价格", ("价格", "费用", "计费说明")),
    ("上下文长度", ("上下文长度", "上下文")),
    ("注意事项", ("注意事项", "注意", "备注")),
)
CHECK_MIN_TEXT_LENGTHS = {
    "适用场景": 10,
    "模型能力": 10,
}


@dataclass(frozen=True)
class ModelTable:
    header: list[str]
    model_id_index: int
    rows: list[list[str]]


@dataclass(frozen=True)
class ModelTableCheckResult:
    model_count: int
    errors: list[str]
    warnings: list[str]


def render_model_info(markdown_table):
    """根据模型清单 Markdown 表格生成模型介绍页内容。"""
    model_table = parse_model_table(markdown_table)
    if not model_table:
        header = MODEL_INFO_HEADER.format(count=0)
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
            if not name or name in MODEL_INFO_IGNORED_COLUMNS:
                continue
            value = row[index].strip() if index < len(row) else ""
            lines.append(f"| {name} | {value} |")

        sections.append("\n".join(lines))

    header = MODEL_INFO_HEADER.format(count=model_count)
    body = "\n\n".join(sections) if sections else markdown_table.strip()
    return f"{header}\n\n{body}\n"


def extract_first_markdown_table(content):
    """从抓取结果中提取第一段 Markdown 表格。"""
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
    """解析模型清单表格，要求表头中存在标准 `模型ID` 列。"""
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
    """拆分 Markdown 表格行，并保留单元格内已转义的竖线。"""
    text = line.strip()
    if text.startswith("|"):
        text = text[1:]
    if text.endswith("|"):
        text = text[:-1]

    cells = []
    cell = []
    backslash_count = 0
    for char in text:
        if char == "|" and backslash_count % 2 == 0:
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
    """判断一行单元格是否为 Markdown 表格分隔行。"""
    if not cells:
        return False

    for cell in cells:
        normalized = cell.replace(" ", "")
        dashes = normalized.strip(":")
        if len(dashes) < 3 or set(dashes) != {"-"}:
            return False
    return True


def find_column_index(header, aliases):
    """按字段别名查找表头位置。"""
    for alias in aliases:
        if alias in header:
            return header.index(alias), alias
    return None, None


def format_check_row_label(data_row_number, model_id):
    """生成便于定位飞书数据行的问题标签。"""
    label = f"数据第 {data_row_number} 行"
    if model_id:
        label = f"{label}（模型ID：{model_id}）"
    return label


def check_table_content(content):
    """检查抓取内容中的第一张模型清单表格。"""
    model_count = 0
    errors = []
    warnings = []

    field_indexes = {}
    matched_columns = {}
    seen_model_ids = {}

    markdown_table = extract_first_markdown_table(content)
    rows = [
        split_markdown_row(line)
        for line in markdown_table.splitlines()
        if line.startswith("|")
    ]
    if len(rows) < 2:
        # Error 1: 没有可解析的 Markdown 表格
        return ModelTableCheckResult(
            model_count=0,
            errors=["未读取到有效 Markdown 表格。"],
            warnings=[],
        )

    header = [cell.strip() for cell in rows[0]]
    body_rows = rows[1:]
    if len(rows) > 1 and is_markdown_table_separator(rows[1]):
        body_rows = rows[2:]

    for field_name, aliases in CHECK_REQUIRED_FIELD_ALIASES:
        column_index, matched_column = find_column_index(header, aliases)
        if column_index is None:
            # Error 2: 表头缺少检查所需的关键列
            errors.append(
                f"缺少关键列：{field_name}（可接受列名：{'、'.join(aliases)}）"
            )
            continue
        field_indexes[field_name] = column_index
        matched_columns[field_name] = matched_column

    model_id_index = field_indexes.get(MODEL_ID_COLUMN)

    for data_row_number, row in enumerate(body_rows, start=1):
        if not any(cell.strip() for cell in row):
            continue

        model_id = ""
        if model_id_index is not None and model_id_index < len(row):
            model_id = row[model_id_index].strip()

        row_label = format_check_row_label(data_row_number, model_id)

        # Error 3: 数据行内缺少模型ID
        if not model_id:
            errors.append(f"{row_label}：缺少模型ID。")

        # Error 4: 模型ID与前序数据行重复
        elif model_id in seen_model_ids:
            first_row = seen_model_ids[model_id]
            errors.append(
                f"{row_label}：模型ID重复，首次出现在数据第 {first_row} 行。"
            )

        else:
            seen_model_ids[model_id] = data_row_number
            model_count += 1

        for field_name, column_index in field_indexes.items():
            if field_name == MODEL_ID_COLUMN:
                continue

            value = row[column_index].strip() if column_index < len(row) else ""

            # Error 5: 数据行缺少关键字段内容
            if not value:
                column_name = matched_columns[field_name]
                errors.append(f"{row_label}：缺少{field_name}（列名：{column_name}）。")

        for field_name, min_length in CHECK_MIN_TEXT_LENGTHS.items():
            column_index = field_indexes.get(field_name)
            if column_index is None or column_index >= len(row):
                continue

            value = row[column_index].strip()

            # Warning: 重要描述性字段内容过短
            if value and len(value) < min_length:
                warnings.append(
                    f"{row_label}：{field_name}内容偏短，建议补充到至少 {min_length} 个字符。"
                )

    # Error 6: 没有任何有效模型数据行
    if model_count == 0:
        errors.append("未发现有效模型数据行。")

    return ModelTableCheckResult(
        model_count=model_count,
        errors=errors,
        warnings=warnings,
    )


def print_check_report(result):
    """输出适合命令行阅读的模型表格检查报告。"""
    print(
        f"模型表格检查结果：{result.model_count} 个有效模型，"
        f"{len(result.errors)} 个错误，{len(result.warnings)} 个警告。"
    )

    if result.errors:
        print()
        print("错误：")
        for message in result.errors:
            print(f"- {message}")

    if result.warnings:
        print()
        print("警告：")
        for message in result.warnings:
            print(f"- {message}")

    print()
    if result.errors:
        print("模型表格检查未通过，请修复错误后重新执行 check。")
    else:
        print("模型表格检查通过。")
