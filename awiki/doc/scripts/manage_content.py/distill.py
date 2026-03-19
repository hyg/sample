#!/usr/bin/env python3
"""Distill script for manage_content.py.

记录 manage_content.py 的输入输出作为"黄金标准"。
由于实际执行需要凭证和网络调用，此脚本模拟操作并记录预期行为。
"""

import json
import sys
from datetime import datetime


def record_test_case(name: str, input_args: dict, expected_output: dict) -> None:
    """记录测试用例的输入输出。"""
    print(f"\n{'='*60}")
    print(f"测试用例：{name}")
    print(f"时间：{datetime.now().isoformat()}")
    print(f"{'='*60}")
    print("\n[INPUT]:")
    print(json.dumps(input_args, indent=2, ensure_ascii=False))
    print("\n[EXPECTED OUTPUT]:")
    print(json.dumps(expected_output, indent=2, ensure_ascii=False))


def main() -> None:
    """执行蒸馏测试，记录所有 CLI 操作的输入输出。"""
    print("manage_content.py 蒸馏脚本 - 黄金标准记录")
    print(f"开始时间：{datetime.now().isoformat()}")
    
    # 测试用例 1: 创建内容页面
    record_test_case(
        name="创建内容页面 (create)",
        input_args={
            "action": "--create",
            "credential": "default",
            "slug": "jd",
            "title": "Job Description",
            "body": "# We are hiring\n\nJoin our team!",
            "visibility": "public",
        },
        expected_output={
            "status": "ok",
            "action": "created",
            "page": {
                "slug": "jd",
                "title": "Job Description",
                "visibility": "public",
                "created_at": "<timestamp>",
                "updated_at": "<timestamp>",
            },
        },
    )
    
    # 测试用例 2: 创建草稿页面
    record_test_case(
        name="创建草稿页面 (create draft)",
        input_args={
            "action": "--create",
            "credential": "default",
            "slug": "draft-post",
            "title": "Draft",
            "body": "WIP",
            "visibility": "draft",
        },
        expected_output={
            "status": "ok",
            "action": "created",
            "page": {
                "slug": "draft-post",
                "title": "Draft",
                "visibility": "draft",
                "created_at": "<timestamp>",
                "updated_at": "<timestamp>",
            },
        },
    )
    
    # 测试用例 3: 列出所有内容页面
    record_test_case(
        name="列出内容页面 (list)",
        input_args={
            "action": "--list",
            "credential": "default",
        },
        expected_output={
            "status": "ok",
            "action": "list",
            "pages": [
                {"slug": "jd", "title": "Job Description", "visibility": "public"},
                {"slug": "draft-post", "title": "Draft", "visibility": "draft"},
            ],
            "count": 2,
        },
    )
    
    # 测试用例 4: 获取特定内容页面
    record_test_case(
        name="获取内容页面 (get)",
        input_args={
            "action": "--get",
            "credential": "default",
            "slug": "jd",
        },
        expected_output={
            "status": "ok",
            "action": "get",
            "page": {
                "slug": "jd",
                "title": "Job Description",
                "body": "# We are hiring\n\nJoin our team!",
                "visibility": "public",
                "created_at": "<timestamp>",
                "updated_at": "<timestamp>",
            },
        },
    )
    
    # 测试用例 5: 更新内容页面
    record_test_case(
        name="更新内容页面 (update)",
        input_args={
            "action": "--update",
            "credential": "default",
            "slug": "jd",
            "title": "Updated Title",
            "body": "New content",
            "visibility": None,
        },
        expected_output={
            "status": "ok",
            "action": "updated",
            "page": {
                "slug": "jd",
                "title": "Updated Title",
                "body": "New content",
                "visibility": "public",
                "updated_at": "<timestamp>",
            },
        },
    )
    
    # 测试用例 6: 更改可见性
    record_test_case(
        name="更改可见性 (update visibility)",
        input_args={
            "action": "--update",
            "credential": "default",
            "slug": "jd",
            "title": None,
            "body": None,
            "visibility": "unlisted",
        },
        expected_output={
            "status": "ok",
            "action": "updated",
            "page": {
                "slug": "jd",
                "visibility": "unlisted",
                "updated_at": "<timestamp>",
            },
        },
    )
    
    # 测试用例 7: 重命名 slug
    record_test_case(
        name="重命名 slug (rename)",
        input_args={
            "action": "--rename",
            "credential": "default",
            "slug": "jd",
            "new_slug": "hiring",
        },
        expected_output={
            "status": "ok",
            "action": "renamed",
            "page": {
                "old_slug": "jd",
                "new_slug": "hiring",
                "updated_at": "<timestamp>",
            },
        },
    )
    
    # 测试用例 8: 删除内容页面
    record_test_case(
        name="删除内容页面 (delete)",
        input_args={
            "action": "--delete",
            "credential": "default",
            "slug": "hiring",
        },
        expected_output={
            "status": "ok",
            "action": "deleted",
            "result": {"success": True},
        },
    )
    
    # 测试用例 9: 从文件读取正文
    record_test_case(
        name="从文件读取正文 (create with body-file)",
        input_args={
            "action": "--create",
            "credential": "default",
            "slug": "event",
            "title": "Event",
            "body_file": "./event.md",
            "visibility": "public",
        },
        expected_output={
            "status": "ok",
            "action": "created",
            "page": {
                "slug": "event",
                "title": "Event",
                "visibility": "public",
                "created_at": "<timestamp>",
                "updated_at": "<timestamp>",
            },
        },
    )
    
    # 错误场景 1: 凭证不可用
    record_test_case(
        name="错误场景 - 凭证不可用",
        input_args={
            "action": "--list",
            "credential": "nonexistent",
        },
        expected_output={
            "status": "error",
            "error": "Credential 'nonexistent' unavailable",
            "hint": "Create an identity first with setup_identity.py or register_handle.py",
        },
    )
    
    # 错误场景 2: 更新时无字段
    record_test_case(
        name="错误场景 - 更新时无字段",
        input_args={
            "action": "--update",
            "credential": "default",
            "slug": "jd",
            "title": None,
            "body": None,
            "visibility": None,
            "body_file": None,
        },
        expected_output={
            "status": "error",
            "error": "No fields to update",
            "hint": "Specify --title, --body, --visibility, or --body-file",
        },
    )
    
    # 错误场景 3: 文件未找到
    record_test_case(
        name="错误场景 - 文件未找到",
        input_args={
            "action": "--create",
            "credential": "default",
            "slug": "test",
            "title": "Test",
            "body_file": "./nonexistent.md",
        },
        expected_output={
            "status": "error",
            "error": "File not found: ./nonexistent.md",
            "hint": "Check the file path",
        },
    )
    
    # 错误场景 4: JSON-RPC 错误
    record_test_case(
        name="错误场景 - JSON-RPC 错误",
        input_args={
            "action": "--create",
            "credential": "default",
            "slug": "duplicate",
            "title": "Duplicate",
            "body": "Content",
        },
        expected_output={
            "status": "error",
            "error_type": "jsonrpc",
            "code": -32000,
            "message": "Slug already exists",
            "data": None,
        },
    )
    
    print(f"\n{'='*60}")
    print("蒸馏完成")
    print(f"结束时间：{datetime.now().isoformat()}")
    print(f"{'='*60}")
    print("\n黄金标准记录完毕。")
    print("实际执行时需要：")
    print("  1. 配置凭证 (credential_store)")
    print("  2. 网络连接 (awiki.ai 服务)")
    print("  3. 有效的身份认证")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
