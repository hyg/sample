"""数据库迁移模块蒸馏脚本 - 记录输入输出作为黄金标准。

此脚本执行 database_migration.py 中的函数，记录输入输出作为参考。

使用方法:
    cd D:\\huangyg\\git\\sample\\awiki\\python\\scripts
    python D:\\huangyg\\git\\sample\\awiki\\doc\\scripts\\database_migration.py\\distill.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# 添加 scripts 目录到路径
SCRIPTS_DIR = Path(r"D:\huangyg\git\sample\awiki\python\scripts")
sys.path.insert(0, str(SCRIPTS_DIR))

from database_migration import (
    detect_local_database_layout,
    ensure_local_database_ready,
    migrate_local_database,
)


def record_result(func_name: str, result: dict) -> None:
    """记录函数执行结果。"""
    print(f"\n{'='*60}")
    print(f"函数：{func_name}")
    print(f"{'='*60}")
    print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> None:
    """执行蒸馏测试。"""
    print("数据库迁移模块蒸馏测试")
    print("="*60)

    # 测试 1: detect_local_database_layout
    print("\n[测试 1] 检测数据库布局...")
    result1 = detect_local_database_layout()
    record_result("detect_local_database_layout", result1)

    # 测试 2: ensure_local_database_ready
    print("\n[测试 2] 确保数据库就绪...")
    result2 = ensure_local_database_ready()
    record_result("ensure_local_database_ready", result2)

    # 测试 3: migrate_local_database
    print("\n[测试 3] 迁移数据库...")
    result3 = migrate_local_database()
    record_result("migrate_local_database", result3)

    print("\n" + "="*60)
    print("蒸馏测试完成")
    print("="*60)


if __name__ == "__main__":
    main()
