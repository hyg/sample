"""蒸馏脚本：记录 test_manage_content_cli.py 的输入输出黄金标准。

执行两个测试场景并记录实际输出：
1. JsonRpcError 错误渲染
2. 通用错误渲染
"""

from __future__ import annotations

import io
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path

# 添加 scripts 目录到路径
# 从 doc/tests/test_manage_content_cli.py/distill.py 到 python/scripts
_root_dir = Path(__file__).resolve().parent.parent.parent.parent
_scripts_dir = _root_dir / "python" / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import manage_content


class CapturedOutput:
    """模拟 pytest capsys 的捕获输出。"""

    def __init__(self) -> None:
        self._stdout = io.StringIO()

    def readouterr(self) -> tuple[str, str]:
        return (self._stdout.getvalue(), "")


def test_jsonrpc_error() -> dict:
    """测试 JsonRpcError 错误渲染。

    输入：模拟 create_page 抛出 JsonRpcError
    输出：结构化 JSON 错误响应
    """
    print("\n" + "=" * 60)
    print("测试 1: JsonRpcError 错误渲染")
    print("=" * 60)

    # 记录输入
    input_data = {
        "test_name": "test_main_renders_jsonrpc_error_as_structured_json",
        "description": "模拟 create_page 抛出 JsonRpcError",
        "argv": ["manage_content.py", "--create", "--slug", "dup", "--title", "Title"],
        "mocked_function": "create_page",
        "raised_exception": {
            "type": "JsonRpcError",
            "code": -32001,
            "message": "Slug already exists",
            "data": {"slug": "dup"},
        },
    }
    print("\n【输入】:")
    print(json.dumps(input_data, indent=2, ensure_ascii=False))

    # 设置捕获输出
    captured = CapturedOutput()

    async def _fake_create_page(**kwargs) -> None:
        del kwargs
        raise manage_content.JsonRpcError(
            -32001,
            "Slug already exists",
            {"slug": "dup"},
        )

    # 保存原始值
    original_argv = sys.argv.copy()
    original_create_page = manage_content.create_page
    original_configure_logging = manage_content.configure_logging

    try:
        # 应用 monkeypatch
        manage_content.configure_logging = lambda **kwargs: None
        manage_content.create_page = _fake_create_page
        sys.argv = ["manage_content.py", "--create", "--slug", "dup", "--title", "Title"]

        # 执行并捕获输出
        exit_code = None
        with redirect_stdout(captured._stdout):
            try:
                manage_content.main()
            except SystemExit as e:
                exit_code = e.code

        # 解析输出
        output_text = captured.readouterr()[0]
        output_data = json.loads(output_text.strip())

        # 记录输出
        output_info = {
            "exit_code": exit_code,
            "stdout": output_data,
        }
        print("\n【输出】:")
        print(json.dumps(output_info, indent=2, ensure_ascii=False))

        # 验证
        expected = {
            "status": "error",
            "error_type": "jsonrpc",
            "code": -32001,
            "message": "Slug already exists",
            "data": {"slug": "dup"},
        }
        assert output_data == expected, f"输出不匹配:\n期望:{expected}\n实际:{output_data}"
        assert exit_code == 1, f"退出码应为 1, 实际:{exit_code}"

        print("\n【验证】: ✓ 通过")
        return output_info

    finally:
        # 恢复原始值
        sys.argv = original_argv
        manage_content.create_page = original_create_page
        manage_content.configure_logging = original_configure_logging


def test_generic_error() -> dict:
    """测试通用错误渲染。

    输入：模拟 list_pages 抛出 RuntimeError
    输出：结构化 JSON 错误响应
    """
    print("\n" + "=" * 60)
    print("测试 2: 通用错误渲染")
    print("=" * 60)

    # 记录输入
    input_data = {
        "test_name": "test_main_renders_generic_error_as_structured_json",
        "description": "模拟 list_pages 抛出 RuntimeError",
        "argv": ["manage_content.py", "--list"],
        "mocked_function": "list_pages",
        "raised_exception": {
            "type": "RuntimeError",
            "message": "boom",
        },
    }
    print("\n【输入】:")
    print(json.dumps(input_data, indent=2, ensure_ascii=False))

    # 设置捕获输出
    captured = CapturedOutput()

    async def _fake_list_pages(credential_name: str) -> None:
        del credential_name
        raise RuntimeError("boom")

    # 保存原始值
    original_argv = sys.argv.copy()
    original_list_pages = manage_content.list_pages
    original_configure_logging = manage_content.configure_logging

    try:
        # 应用 monkeypatch
        manage_content.configure_logging = lambda **kwargs: None
        manage_content.list_pages = _fake_list_pages
        sys.argv = ["manage_content.py", "--list"]

        # 执行并捕获输出
        exit_code = None
        with redirect_stdout(captured._stdout):
            try:
                manage_content.main()
            except SystemExit as e:
                exit_code = e.code

        # 解析输出
        output_text = captured.readouterr()[0]
        output_data = json.loads(output_text.strip())

        # 记录输出
        output_info = {
            "exit_code": exit_code,
            "stdout": output_data,
        }
        print("\n【输出】:")
        print(json.dumps(output_info, indent=2, ensure_ascii=False))

        # 验证
        expected = {
            "status": "error",
            "error_type": "RuntimeError",
            "message": "boom",
        }
        assert output_data == expected, f"输出不匹配:\n期望:{expected}\n实际:{output_data}"
        assert exit_code == 1, f"退出码应为 1, 实际:{exit_code}"

        print("\n【验证】: ✓ 通过")
        return output_info

    finally:
        # 恢复原始值
        sys.argv = original_argv
        manage_content.list_pages = original_list_pages
        manage_content.configure_logging = original_configure_logging


def main() -> None:
    """执行所有蒸馏测试。"""
    print("=" * 60)
    print("test_manage_content_cli.py 蒸馏脚本")
    print("记录输入输出作为黄金标准")
    print("=" * 60)

    results = {
        "test_jsonrpc_error": None,
        "test_generic_error": None,
    }

    # 执行测试 1
    results["test_jsonrpc_error"] = test_jsonrpc_error()

    # 执行测试 2
    results["test_generic_error"] = test_generic_error()

    # 打印总结
    print("\n" + "=" * 60)
    print("蒸馏完成 - 黄金标准总结")
    print("=" * 60)
    print(json.dumps(results, indent=2, ensure_ascii=False))
    print("\n✓ 所有测试通过")


if __name__ == "__main__":
    main()
