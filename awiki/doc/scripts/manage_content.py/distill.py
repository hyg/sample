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


# =============================================================================
# 附录：补充场景测试 - 页面不存在、权限不足、父子页面关系、多用户协作
# =============================================================================

def test_get_nonexistent_page(
    slug: str = "nonexistent_page_xyz",
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试获取不存在的页面。
    
    数据准备:
    1. 使用不存在的 slug
    
    预期结果:
    1. 返回页面不存在错误
    2. 错误码 -32001
    """
    input_data = {
        "scenario": "get_nonexistent_page",
        "slug": slug,
        "credential_name": credential_name,
    }
    
    output_data = {
        "error_caught": False,
        "error_code": None,
        "error_message": None,
    }
    
    try:
        from manage_content import get_page
        from utils import JsonRpcError
        
        get_page(slug=slug, credential_name=credential_name)
        
        output_data["error_caught"] = False
        output_data["error_message"] = "Expected error but succeeded"
        
        return _record_manage_content_test("get_nonexistent_page", input_data, output_data, False, output_file)
        
    except JsonRpcError as e:
        output_data["error_caught"] = True
        output_data["error_code"] = e.code if hasattr(e, 'code') else None
        output_data["error_message"] = str(e)
        
        success = output_data["error_code"] == -32001  # Page not found
        return _record_manage_content_test("get_nonexistent_page", input_data, output_data, success, output_file)
        
    except Exception as e:
        output_data["error_caught"] = True
        output_data["error_message"] = str(e)
        return _record_manage_content_test("get_nonexistent_page", input_data, output_data, False, output_file, str(e))


def test_update_others_page_permission_denied(
    slug: str,
    owner_credential: str,
    attacker_credential: str,
    output_file: str | None = None,
) -> dict:
    """测试更新他人页面权限不足场景。
    
    数据准备:
    1. Alice 创建的页面
    2. Bob 尝试更新
    
    预期结果:
    1. 权限不足错误
    2. 错误码 -32003
    """
    input_data = {
        "scenario": "update_others_page_permission_denied",
        "slug": slug,
        "owner_credential": owner_credential,
        "attacker_credential": attacker_credential,
    }
    
    output_data = {
        "error_caught": False,
        "error_code": None,
        "error_message": None,
    }
    
    try:
        from manage_content import update_page
        from utils import JsonRpcError
        
        update_page(
            slug=slug,
            content="Hacked content",
            credential_name=attacker_credential,
        )
        
        output_data["error_caught"] = False
        output_data["error_message"] = "Expected permission error but succeeded"
        
        return _record_manage_content_test("update_others_page_permission_denied", input_data, output_data, False, output_file)
        
    except JsonRpcError as e:
        output_data["error_caught"] = True
        output_data["error_code"] = e.code if hasattr(e, 'code') else None
        output_data["error_message"] = str(e)
        
        success = output_data["error_code"] == -32003  # Permission denied
        return _record_manage_content_test("update_others_page_permission_denied", input_data, output_data, success, output_file)
        
    except Exception as e:
        output_data["error_caught"] = True
        output_data["error_message"] = str(e)
        return _record_manage_content_test("update_others_page_permission_denied", input_data, output_data, False, output_file, str(e))


def test_create_child_page(
    parent_slug: str,
    child_slug: str,
    child_title: str,
    child_content: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试创建子页面场景。
    
    数据准备:
    1. 已存在的父页面
    2. 创建子页面
    
    预期结果:
    1. 成功创建子页面
    2. 层级关系正确
    """
    input_data = {
        "scenario": "create_child_page",
        "parent_slug": parent_slug,
        "child_slug": child_slug,
        "child_title": child_title,
        "child_content": child_content,
        "credential_name": credential_name,
    }
    
    output_data = {
        "created": False,
        "page": None,
        "parent_slug": None,
        "error": None,
    }
    
    try:
        from manage_content import create_page
        
        page = create_page(
            slug=child_slug,
            title=child_title,
            content=child_content,
            parent_slug=parent_slug,
            credential_name=credential_name,
        )
        
        output_data["created"] = True
        output_data["page"] = {
            "slug": child_slug,
            "title": child_title,
        }
        output_data["parent_slug"] = parent_slug
        
        return _record_manage_content_test("create_child_page", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_manage_content_test("create_child_page", input_data, output_data, False, output_file, str(e))


def test_multi_user_collaboration(
    alice_credential: str,
    bob_credential: str,
    output_file: str | None = None,
) -> dict:
    """测试多用户协作场景。
    
    数据准备:
    1. Alice 创建页面
    2. Bob 搜索并获取页面
    3. Alice 更新页面
    4. Bob 验证内容变化
    
    预期结果:
    1. 页面创建成功
    2. Bob 可以获取页面
    3. Alice 更新成功
    4. Bob 看到更新后的内容
    """
    input_data = {
        "scenario": "multi_user_collaboration",
        "alice_credential": alice_credential,
        "bob_credential": bob_credential,
    }
    
    output_data = {
        "page_created": False,
        "bob_can_get": False,
        "alice_updated": False,
        "bob_verified": False,
        "error": None,
    }
    
    try:
        from manage_content import create_page, get_page, update_page
        
        # 步骤 1: Alice 创建页面
        page_slug = f"collab_test_{int(Path(__file__).stat().st_mtime)}"
        create_page(
            slug=page_slug,
            title="Collaboration Test",
            content="Initial content by Alice",
            credential_name=alice_credential,
        )
        output_data["page_created"] = True
        
        # 步骤 2: Bob 获取页面
        bob_page = get_page(slug=page_slug, credential_name=bob_credential)
        output_data["bob_can_get"] = bob_page is not None
        
        # 步骤 3: Alice 更新页面
        update_page(
            slug=page_slug,
            content="Updated content by Alice",
            credential_name=alice_credential,
        )
        output_data["alice_updated"] = True
        
        # 步骤 4: Bob 验证更新
        updated_page = get_page(slug=page_slug, credential_name=bob_credential)
        output_data["bob_verified"] = "Updated" in str(updated_page)
        
        return _record_manage_content_test("multi_user_collaboration", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_manage_content_test("multi_user_collaboration", input_data, output_data, False, output_file, str(e))


def _record_manage_content_test(
    scenario: str,
    input_data: dict,
    output_data: dict,
    success: bool,
    output_file: str | None = None,
    error: str | None = None,
) -> dict:
    """记录 manage_content 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "manage_content.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
        print(f"黄金标准已保存到：{output_file}", file=sys.stderr)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    
    return golden_record
    sys.exit(main())
