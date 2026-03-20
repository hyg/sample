#!/usr/bin/env python3
"""蒸馏脚本：执行 test_contact_sedimentation_cli.py 并记录黄金标准输出。

[INPUT]: manage_contacts / manage_relationship / send_message entrypoints
[OUTPUT]: 测试执行结果和数据库状态快照
"""

from __future__ import annotations

import json
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path


def get_db_schema() -> list[str]:
    """获取数据库表结构。"""
    return [
        """CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_did TEXT NOT NULL,
            did TEXT NOT NULL,
            handle TEXT,
            relationship TEXT,
            followed INTEGER DEFAULT 0,
            messaged INTEGER DEFAULT 0,
            source_type TEXT,
            source_name TEXT,
            source_group_id TEXT,
            recommended_reason TEXT,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_did, did)
        )""",
        """CREATE TABLE IF NOT EXISTS relationship_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_did TEXT NOT NULL,
            target_did TEXT NOT NULL,
            event_type TEXT NOT NULL,
            status TEXT NOT NULL,
            source_type TEXT,
            source_name TEXT,
            source_group_id TEXT,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_did, target_did, event_type, created_at)
        )""",
    ]


def snapshot_db(db_path: str) -> dict:
    """获取数据库快照。"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    snapshot = {}
    
    # 获取 contacts 表
    cursor.execute("SELECT * FROM contacts ORDER BY id")
    snapshot["contacts"] = [dict(row) for row in cursor.fetchall()]
    
    # 获取 relationship_events 表
    cursor.execute("SELECT * FROM relationship_events ORDER BY id")
    snapshot["relationship_events"] = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return snapshot


def run_test(test_name: str, db_path: str) -> dict:
    """运行单个测试并返回结果。"""
    # 设置环境变量
    env = dict(**dict(os.environ))
    env["AWIKI_DATA_DIR"] = db_path
    
    # 运行 pytest
    result = subprocess.run(
        [sys.executable, "-m", "pytest", 
         f"python/tests/test_contact_sedimentation_cli.py::{test_name}",
         "-v", "--tb=short"],
        capture_output=True,
        text=True,
        env=env,
        cwd=Path(__file__).resolve().parent.parent.parent.parent,
        timeout=30
    )
    
    return {
        "test_name": test_name,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def main() -> int:
    """主函数。"""
    import os
    
    print("=" * 60)
    print("蒸馏脚本：test_contact_sedimentation_cli.py")
    print(f"时间：{datetime.now().isoformat()}")
    print("=" * 60)
    
    # 创建临时目录
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "local.db"
        db_path_str = str(db_path)
        
        # 初始化数据库
        print("\n[初始化] 创建临时数据库")
        conn = sqlite3.connect(db_path_str)
        for schema in get_db_schema():
            conn.execute(schema)
        conn.commit()
        conn.close()
        
        # 设置环境变量
        os.environ["AWIKI_DATA_DIR"] = db_path_str
        
        # 测试列表
        tests = [
            "TestManageContactsCli::test_record_recommendation_writes_event",
            "TestManageContactsCli::test_save_from_group_writes_contact_snapshot",
            "TestSocialPersistence::test_follow_updates_contact_and_event",
            "TestSocialPersistence::test_send_message_marks_contact_as_messaged",
        ]
        
        results = []
        
        for test_name in tests:
            print(f"\n[执行] {test_name}")
            print("-" * 40)
            
            # 重置数据库
            conn = sqlite3.connect(db_path_str)
            conn.execute("DELETE FROM contacts")
            conn.execute("DELETE FROM relationship_events")
            conn.commit()
            conn.close()
            
            # 运行测试
            result = subprocess.run(
                [sys.executable, "-m", "pytest",
                 f"python/tests/test_contact_sedimentation_cli.py::{test_name}",
                 "-v", "--tb=short"],
                capture_output=True,
                text=True,
                env=os.environ,
                cwd=Path(__file__).resolve().parent.parent.parent.parent,
                timeout=30
            )
            
            test_result = {
                "test_name": test_name,
                "passed": result.returncode == 0,
                "returncode": result.returncode,
            }
            
            if result.returncode == 0:
                print(f"✓ 通过")
                # 获取数据库快照
                snapshot = snapshot_db(db_path_str)
                test_result["db_snapshot"] = snapshot
            else:
                print(f"✗ 失败")
                test_result["stdout"] = result.stdout
                test_result["stderr"] = result.stderr
            
            results.append(test_result)
            print()
        
        # 输出摘要
        print("=" * 60)
        print("摘要")
        print("=" * 60)
        passed = sum(1 for r in results if r["passed"])
        total = len(results)
        print(f"通过：{passed}/{total}")
        
        for r in results:
            status = "✓" if r["passed"] else "✗"
            print(f"  {status} {r['test_name']}")
        
        # 输出 JSON 格式的黄金标准
        print("\n" + "=" * 60)
        print("黄金标准输出 (JSON)")
        print("=" * 60)
        
        output = {
            "timestamp": datetime.now().isoformat(),
            "test_file": "python/tests/test_contact_sedimentation_cli.py",
            "results": results,
            "summary": {
                "passed": passed,
                "total": total,
                "pass_rate": passed / total if total > 0 else 0
            }
        }
        
        print(json.dumps(output, indent=2, ensure_ascii=False))
        
        return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
