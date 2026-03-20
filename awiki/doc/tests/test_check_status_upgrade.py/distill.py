#!/usr/bin/env python
"""蒸馏脚本：执行 test_check_status_upgrade.py 并记录黄金标准输入输出。

用途：
    执行测试函数，记录输入（模拟数据）和输出（实际结果）作为黄金标准。

运行：
    python distill.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# 添加 python/scripts 目录到路径
# distill.py 位于：doc/tests/test_check_status_upgrade.py/distill.py
# check_status.py 位于：python/scripts/check_status.py
_project_root = Path(__file__).resolve().parent.parent.parent.parent
_scripts_dir = _project_root / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

import check_status


def test_ensure_local_upgrade_ready_reports_performed_migrations() -> dict:
    """蒸馏：测试升级助手应该总结凭证/数据库迁移工作。
    
    输入：
        - monkeypatch 模拟 ensure_credential_storage_ready 返回 migrated 状态
        - monkeypatch 模拟 ensure_local_database_ready 返回 migrated 状态
    
    输出：
        - result["status"] == "ready"
        - result["credential_ready"] is True
        - result["database_ready"] is True
        - result["performed"] == ["credential_layout", "local_database"]
    """
    # 记录输入：模拟数据
    input_credential_name = "alice"
    input_credential_storage_result = {
        "status": "migrated",
        "layout": "new",
        "credential_ready": True,
        "migration": {
            "status": "migrated",
            "migrated": [{"credential_name": input_credential_name}],
        },
    }
    input_database_result = {
        "status": "migrated",
        "db_path": "/tmp/awiki.db",
        "before_version": 8,
        "after_version": 9,
        "backup_path": "/tmp/awiki-backup.db",
    }
    
    # 应用模拟（替代 monkeypatch）
    original_credential = check_status.ensure_credential_storage_ready
    original_database = check_status.ensure_local_database_ready
    
    check_status.ensure_credential_storage_ready = lambda credential_name: input_credential_storage_result
    check_status.ensure_local_database_ready = lambda: input_database_result
    
    try:
        # 执行测试
        result = check_status.ensure_local_upgrade_ready(input_credential_name)
        
        # 验证输出
        assert result["status"] == "ready", f"Expected status='ready', got '{result['status']}'"
        assert result["credential_ready"] is True, f"Expected credential_ready=True, got {result['credential_ready']}"
        assert result["database_ready"] is True, f"Expected database_ready=True, got {result['database_ready']}"
        assert result["performed"] == ["credential_layout", "local_database"], \
            f"Expected performed=['credential_layout', 'local_database'], got {result['performed']}"
        
        # 返回黄金标准记录
        return {
            "test_name": "test_ensure_local_upgrade_ready_reports_performed_migrations",
            "status": "PASS",
            "input": {
                "credential_name": input_credential_name,
                "mock_credential_storage_result": input_credential_storage_result,
                "mock_database_result": input_database_result,
            },
            "output": result,
        }
    finally:
        # 恢复原始函数
        check_status.ensure_credential_storage_ready = original_credential
        check_status.ensure_local_database_ready = original_database


def test_check_status_stops_when_upgrade_cannot_prepare_credentials() -> dict:
    """蒸馏：测试当本地升级使凭证不可用时，统一状态应该提前返回。
    
    输入：
        - monkeypatch 模拟 ensure_local_upgrade_ready 返回 error 状态
    
    输出：
        - report["local_upgrade"]["status"] == "error"
        - report["identity"]["status"] == "storage_migration_required"
        - report["inbox"]["status"] == "skipped"
        - report["group_watch"]["status"] == "skipped"
    """
    # 记录输入：模拟数据
    input_credential_name = "alice"
    input_upgrade_result = {
        "status": "error",
        "credential_ready": False,
        "database_ready": True,
        "performed": [],
        "credential_layout": {
            "status": "partial",
            "layout": "legacy_remaining",
            "credential_ready": False,
            "migration": {"status": "error"},
        },
        "local_database": {"status": "ready"},
    }
    
    # 应用模拟（替代 monkeypatch）
    original_upgrade = check_status.ensure_local_upgrade_ready
    
    check_status.ensure_local_upgrade_ready = lambda credential_name: input_upgrade_result
    
    try:
        # 执行测试
        report = asyncio.run(check_status.check_status(input_credential_name))
        
        # 验证输出
        assert report["local_upgrade"]["status"] == "error", \
            f"Expected local_upgrade.status='error', got '{report['local_upgrade']['status']}'"
        assert report["identity"]["status"] == "storage_migration_required", \
            f"Expected identity.status='storage_migration_required', got '{report['identity']['status']}'"
        assert report["inbox"]["status"] == "skipped", \
            f"Expected inbox.status='skipped', got '{report['inbox']['status']}'"
        assert report["group_watch"]["status"] == "skipped", \
            f"Expected group_watch.status='skipped', got '{report['group_watch']['status']}'"
        
        # 返回黄金标准记录
        return {
            "test_name": "test_check_status_stops_when_upgrade_cannot_prepare_credentials",
            "status": "PASS",
            "input": {
                "credential_name": input_credential_name,
                "mock_upgrade_result": input_upgrade_result,
            },
            "output": report,
        }
    finally:
        # 恢复原始函数
        check_status.ensure_local_upgrade_ready = original_upgrade


def main():
    """执行所有蒸馏测试并输出黄金标准记录。"""
    print("=" * 70)
    print("蒸馏脚本：test_check_status_upgrade.py")
    print("=" * 70)
    
    results = []
    
    # 测试 1
    print("\n[测试 1] test_ensure_local_upgrade_ready_reports_performed_migrations")
    print("-" * 70)
    try:
        result1 = test_ensure_local_upgrade_ready_reports_performed_migrations()
        results.append(result1)
        print(f"状态：{result1['status']}")
        print(f"输出摘要：status={result1['output']['status']}, performed={result1['output']['performed']}")
    except AssertionError as e:
        results.append({
            "test_name": "test_ensure_local_upgrade_ready_reports_performed_migrations",
            "status": "FAIL",
            "error": str(e),
        })
        print(f"状态：FAIL")
        print(f"错误：{e}")
    
    # 测试 2
    print("\n[测试 2] test_check_status_stops_when_upgrade_cannot_prepare_credentials")
    print("-" * 70)
    try:
        result2 = test_check_status_stops_when_upgrade_cannot_prepare_credentials()
        results.append(result2)
        print(f"状态：{result2['status']}")
        print(f"输出摘要：local_upgrade.status={result2['output']['local_upgrade']['status']}, "
              f"identity.status={result2['output']['identity']['status']}")
    except AssertionError as e:
        results.append({
            "test_name": "test_check_status_stops_when_upgrade_cannot_prepare_credentials",
            "status": "FAIL",
            "error": str(e),
        })
        print(f"状态：FAIL")
        print(f"错误：{e}")
    
    # 汇总
    print("\n" + "=" * 70)
    print("黄金标准记录汇总")
    print("=" * 70)
    passed = sum(1 for r in results if r.get("status") == "PASS")
    total = len(results)
    print(f"通过：{passed}/{total}")
    
    for r in results:
        print(f"\n- {r['test_name']}: {r['status']}")
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
