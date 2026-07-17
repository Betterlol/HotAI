# scripts/feishu/test_table_processor.py

"""
飞书表格检查逻辑测试，包含 15 条测试样例。

这些样例只验证本地 Markdown 内容的解析与检查结果，不访问飞书 API，
也不依赖 OAuth token 或外部文件。
"""

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

from table_processor import check_table_content


TABLE_HEADER = """\
| 编号 | 模型ID | 提供商 | 适用场景 | 模型能力 | 价格 | 上下文长度 | 注意事项 |
| --- | --- | --- | --- | --- | --- | --- | --- |
"""

VALID_ROW = (
    "| 1 | qwen-test | 官方渠道 | API 接入联调和内部试用 | "
    "适合通用文本与工具调用测试 | 1元/百万tokens | 128K | 内部测试 |\n"
)


class CheckModelTableContentTest(unittest.TestCase):
    # 用例 1：完整表格包含多条模型数据时，应统计全部有效模型且不产生错误或警告。
    def test_01_valid_models(self):
        content = TABLE_HEADER + VALID_ROW + (
            "| 2 | deepseek-test | 官方渠道 | 长文档问答和批量文本处理 | "
            "支持长上下文对话和工具调用 | 2元/百万tokens | 256K | 内部灰度 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(2, result.model_count)
        self.assertEqual([], result.errors)
        self.assertEqual([], result.warnings)

    # 用例 2：飞书导出内容在表格前有说明文字时，应从第一张 Markdown 表格开始检查。
    def test_02_extract_table(self):
        content = (
            "# 飞书导出内容\n\n"
            "下面是模型清单：\n"
            + TABLE_HEADER
            + VALID_ROW
            + "\n这段文字之后的表格不应该参与检查。\n"
            "| 模型ID | 提供商 |\n"
            "| --- | --- |\n"
            "| broken-later |  |\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertEqual([], result.errors)
        self.assertEqual([], result.warnings)

    # 用例 3：表头使用支持的别名列时，应按必填字段正常识别。
    def test_03_alias_columns(self):
        content = """\
| 编号 | 模型名称 | 供应商 | 适合场景 | 能力说明 | 计费说明 | 上下文 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | kimi-alias | 官方渠道 | 代码生成和复杂 Agent 联调 | 支持视觉理解和代码任务处理 | 3元/百万tokens | 256K | 注意并发限制 |
"""

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertEqual([], result.errors)
        self.assertEqual([], result.warnings)

    # 用例 4：Markdown 表格分隔行带对齐标记时，应仍然识别为表格分隔行。
    def test_04_alignment_separator(self):
        content = """\
| 编号 | 模型ID | 提供商 | 适用场景 | 模型能力 | 价格 | 上下文长度 | 注意事项 |
| :--- | :---: | ---: | --- | --- | --- | --- | --- |
| 1 | aligned-model | 官方渠道 | API 接入联调和内部试用 | 适合通用文本与工具调用测试 | 1元/百万tokens | 128K | 内部测试 |
"""

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertEqual([], result.errors)
        self.assertEqual([], result.warnings)

    # 用例 5：单元格内包含已转义竖线时，不应被误拆为额外列。
    def test_05_escaped_pipe(self):
        content = TABLE_HEADER + (
            "| 1 | qwen-test | 官方渠道 | API 接入联调和内部试用 | "
            "支持 JSON 输出 \\| 工具调用 | 输入 1 元 \\| 输出 2 元 | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertEqual([], result.errors)
        self.assertEqual([], result.warnings)

    # 用例 6：内容中没有有效 Markdown 表格时，应返回无有效表格错误。
    def test_06_no_table(self):
        result = check_table_content("这里只是一段普通文本，没有 Markdown 表格。")

        self.assertEqual(0, result.model_count)
        self.assertEqual(["未读取到有效 Markdown 表格。"], result.errors)
        self.assertEqual([], result.warnings)

    # 用例 7：表头缺少必填字段对应列时，应报告缺少关键列。
    def test_07_missing_column(self):
        content = """\
| 编号 | 模型ID | 提供商 | 适用场景 | 模型能力 | 价格 | 上下文长度 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | qwen-test | 官方渠道 | API 接入联调和内部试用 | 适合通用文本与工具调用测试 | 1元/百万tokens | 128K |
"""

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertIn(
            "缺少关键列：注意事项（可接受列名：注意事项、注意、备注）",
            result.errors,
        )

    # 用例 8：模型ID为空时，应报告模型ID缺失，并且没有有效模型数据行。
    def test_08_missing_id(self):
        content = TABLE_HEADER + (
            "| 1 |  | 官方渠道 | API 接入联调和内部试用 | 适合通用文本与工具调用测试 | "
            "1元/百万tokens | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(0, result.model_count)
        self.assertIn("数据第 1 行：缺少模型ID。", result.errors)
        self.assertIn("未发现有效模型数据行。", result.errors)

    # 用例 9：模型ID重复时，应报告重复行和首次出现的数据行。
    def test_09_duplicate_id(self):
        content = TABLE_HEADER + VALID_ROW + (
            "| 2 | qwen-test | 官方渠道 | API 接入联调和内部试用 | "
            "适合通用文本与工具调用测试 | 1元/百万tokens | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertIn(
            "数据第 2 行（模型ID：qwen-test）：模型ID重复，首次出现在数据第 1 行。",
            result.errors,
        )

    # 用例 10：必填字段单元格为空时，应报告具体缺失字段和对应列名。
    def test_10_missing_field(self):
        content = TABLE_HEADER + (
            "| 1 | qwen-test | 官方渠道 | API 接入联调和内部试用 | 适合通用文本与工具调用测试 | "
            " | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertIn(
            "数据第 1 行（模型ID：qwen-test）：缺少价格（列名：价格）。",
            result.errors,
        )

    # 用例 11：数据行列数少于表头时，缺失的尾部字段应按空值处理。
    def test_11_short_row(self):
        content = (
            TABLE_HEADER
            + "| 1 | qwen-test | 官方渠道 | API 接入联调和内部试用 | "
            "适合通用文本与工具调用测试 | 1元/百万tokens | 128K\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertIn(
            "数据第 1 行（模型ID：qwen-test）：缺少注意事项（列名：注意事项）。",
            result.errors,
        )

    # 用例 12：全空数据行应跳过，但后续数据行的问题仍保留原始数据行号。
    def test_12_empty_rows(self):
        content = (
            TABLE_HEADER
            + "|  |  |  |  |  |  |  |  |\n"
            + "| 2 | qwen-test | 官方渠道 | API 接入联调和内部试用 | "
            "适合通用文本与工具调用测试 |  | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertIn(
            "数据第 2 行（模型ID：qwen-test）：缺少价格（列名：价格）。",
            result.errors,
        )

    # 用例 13：适用场景和模型能力内容过短时，应分别生成 Warning。
    def test_13_short_text(self):
        content = TABLE_HEADER + (
            "| 1 | qwen-test | 官方渠道 | 短场景 | 短能力 | "
            "1元/百万tokens | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual([], result.errors)
        self.assertEqual(
            [
                "数据第 1 行（模型ID：qwen-test）：适用场景内容偏短，建议补充到至少 10 个字符。",
                "数据第 1 行（模型ID：qwen-test）：模型能力内容偏短，建议补充到至少 10 个字符。",
            ],
            result.warnings,
        )

    # 用例 14：适用场景和模型能力刚好达到最小长度时，不应生成 Warning。
    def test_14_min_length(self):
        content = TABLE_HEADER + (
            "| 1 | qwen-test | 官方渠道 | 适用场景刚好有十个字 | 模型能力刚好有十个字 | "
            "1元/百万tokens | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertEqual([], result.errors)
        self.assertEqual([], result.warnings)

    # 用例 15：多行同时出现错误和警告时，应聚合所有问题而不是提前返回。
    def test_15_aggregate_issues(self):
        content = TABLE_HEADER + (
            "| 1 | qwen-test | 官方渠道 | 短场景 | 适合通用文本与工具调用测试 | "
            "1元/百万tokens | 128K | 内部测试 |\n"
            "| 2 | qwen-test |  | API 接入联调和内部试用 | 短能力 | "
            " | 128K |  |\n"
            "| 3 |  | 官方渠道 | API 接入联调和内部试用 | 适合通用文本与工具调用测试 | "
            "1元/百万tokens | 128K | 内部测试 |\n"
        )

        result = check_table_content(content)

        self.assertEqual(1, result.model_count)
        self.assertIn(
            "数据第 2 行（模型ID：qwen-test）：模型ID重复，首次出现在数据第 1 行。",
            result.errors,
        )
        self.assertIn(
            "数据第 2 行（模型ID：qwen-test）：缺少提供商（列名：提供商）。",
            result.errors,
        )
        self.assertIn(
            "数据第 2 行（模型ID：qwen-test）：缺少价格（列名：价格）。",
            result.errors,
        )
        self.assertIn(
            "数据第 2 行（模型ID：qwen-test）：缺少注意事项（列名：注意事项）。",
            result.errors,
        )
        self.assertIn("数据第 3 行：缺少模型ID。", result.errors)
        self.assertEqual(
            [
                "数据第 1 行（模型ID：qwen-test）：适用场景内容偏短，建议补充到至少 10 个字符。",
                "数据第 2 行（模型ID：qwen-test）：模型能力内容偏短，建议补充到至少 10 个字符。",
            ],
            result.warnings,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
