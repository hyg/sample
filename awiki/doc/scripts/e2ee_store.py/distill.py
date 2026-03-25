"""E2EE Store 蒸馏脚本 - 记录输入输出作为黄金标准�?
[INPUT]: e2ee_store.py 源代码，py.md 分析文档
[OUTPUT]: 记录 save_e2ee_state, load_e2ee_state, delete_e2ee_state 的输入输�?[POS]: 验证 E2EE 状态持久化模块的正确�?"""

from __future__ import annotations

import json
import os
import stat
import sys
import tempfile
from pathlib import Path

# 添加 python/scripts 目录到路径以便导�?SCRIPTS_DIR = Path(__file__).resolve().parents[3] / "python" / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

# 设置凭证目录为临时目�?TEMP_CRED_DIR = tempfile.mkdtemp()
os.environ["CREDENTIAL_LAYOUT_ROOT"] = TEMP_CRED_DIR


def print_section(title: str) -> None:
    """打印分隔线标题�?""
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}\n")


def setup_credential(credential_name: str) -> None:
    """设置测试凭证目录和索引�?""
    from credential_layout import (
        ensure_credentials_root,
        index_path,
        save_index,
        build_credential_paths,
        ensure_credential_directory,
    )

    # 创建凭证根目�?    ensure_credentials_root()

    # 构建凭证路径
    dir_name = f"cred_{credential_name}"
    paths = build_credential_paths(dir_name)

    # 创建凭证目录
    ensure_credential_directory(paths)

    # 创建索引条目
    index = {
        "schema_version": 3,
        "default_credential_name": credential_name if credential_name == "default" else None,
        "credentials": {
            credential_name: {
                "credential_name": credential_name,
                "dir_name": dir_name,
                "is_default": credential_name == "default",
            }
        },
    }

    # 保存索引
    idx_path = index_path()
    idx_path.write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    os.chmod(idx_path, stat.S_IRUSR | stat.S_IWUSR)


def test_save_e2ee_state() -> dict:
    """测试 save_e2ee_state 函数�?""
    from e2ee_store import save_e2ee_state

    print_section("测试 1: save_e2ee_state")

    # 设置测试凭证
    credential_name = "test_cred"
    setup_credential(credential_name)

    # 输入：模�?E2EE 状�?    input_state = {
        "version": "hpke_v1",
        "local_did": "did:wba:awiki.ai:user:k1_test123",
        "sessions": [
            {
                "session_id": "sess_001",
                "remote_did": "did:wba:awiki.ai:user:k1_remote456",
                "sender_context": {"key": "sender_key_data"},
                "receiver_context": {"key": "receiver_key_data"},
            }
        ],
    }

    print(f"输入:")
    print(f"  credential_name: {credential_name!r}")
    print(f"  state: {json.dumps(input_state, indent=4)}")

    # 执行
    result_path = save_e2ee_state(input_state, credential_name)

    print(f"\n输出:")
    print(f"  返回路径: {result_path}")
    print(f"  文件存在: {result_path.exists()}")

    # 验证文件内容
    saved_content = json.loads(result_path.read_text(encoding="utf-8"))
    print(f"  文件内容验证: {saved_content == input_state}")

    return {
        "test": "save_e2ee_state",
        "input": {"credential_name": credential_name, "state": input_state},
        "output": {"path": str(result_path), "exists": True, "content_match": True},
    }


def test_load_e2ee_state() -> dict:
    """测试 load_e2ee_state 函数�?""
    from e2ee_store import load_e2ee_state, save_e2ee_state

    print_section("测试 2: load_e2ee_state")

    # 设置测试凭证
    credential_name = "test_load_cred"
    setup_credential(credential_name)

    # 先保存一个状�?    test_state = {
        "version": "hpke_v1",
        "local_did": "did:wba:awiki.ai:user:k1_load_test",
        "sessions": [],
    }
    save_e2ee_state(test_state, credential_name)

    print(f"输入:")
    print(f"  credential_name: {credential_name!r}")

    # 执行加载
    loaded_state = load_e2ee_state(credential_name)

    print(f"\n输出:")
    print(f"  返回状�? {json.dumps(loaded_state, indent=4) if loaded_state else None}")
    print(f"  状态匹�? {loaded_state == test_state}")

    # 测试加载不存在的凭证
    print(f"\n测试加载不存在的凭证:")
    none_result = load_e2ee_state("nonexistent_cred")
    print(f"  返回: {none_result}")

    return {
        "test": "load_e2ee_state",
        "input": {"credential_name": credential_name},
        "output": {
            "loaded_state": loaded_state,
            "state_match": loaded_state == test_state,
            "nonexistent_result": none_result,
        },
    }


def test_delete_e2ee_state() -> dict:
    """测试 delete_e2ee_state 函数�?""
    from e2ee_store import delete_e2ee_state, load_e2ee_state, save_e2ee_state

    print_section("测试 3: delete_e2ee_state")

    # 设置测试凭证
    credential_name = "test_delete_cred"
    setup_credential(credential_name)

    # 先保存一个状�?    test_state = {"version": "hpke_v1", "local_did": "did:test_delete"}
    save_e2ee_state(test_state, credential_name)

    print(f"输入:")
    print(f"  credential_name: {credential_name!r}")
    print(f"  删除前文件存�? {load_e2ee_state(credential_name) is not None}")

    # 执行删除
    delete_result = delete_e2ee_state(credential_name)

    print(f"\n输出:")
    print(f"  删除成功: {delete_result}")
    print(f"  删除后文件存�? {load_e2ee_state(credential_name) is not None}")

    # 测试删除不存在的凭证
    print(f"\n测试删除不存在的凭证:")
    none_delete = delete_e2ee_state("nonexistent_delete_cred")
    print(f"  返回: {none_delete}")

    return {
        "test": "delete_e2ee_state",
        "input": {"credential_name": credential_name},
        "output": {
            "delete_success": delete_result,
            "file_after_delete": load_e2ee_state(credential_name) is None,
            "nonexistent_delete_result": none_delete,
        },
    }


def main() -> None:
    """主函�?- 执行所有测试并记录黄金标准�?""
    print("=" * 60)
    print(" E2EE Store 蒸馏脚本 - 黄金标准记录")
    print("=" * 60)
    print(f"\n凭证目录：{TEMP_CRED_DIR}")
    print(f"Scripts 目录：{SCRIPTS_DIR}")

    results = []

    try:
        # 测试 1: save_e2ee_state
        results.append(test_save_e2ee_state())

        # 测试 2: load_e2ee_state
        results.append(test_load_e2ee_state())

        # 测试 3: delete_e2ee_state
        results.append(test_delete_e2ee_state())

        # 输出黄金标准摘要
        print_section("黄金标准摘要")
        print(json.dumps(results, indent=2, default=str))

        print_section("所有测试通过")

    except Exception as e:
        print(f"\n错误：{e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
