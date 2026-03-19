"""credential_migration.py 蒸馏脚本 - 执行并记录黄金标准输入输出"""

import json
import os
import sys
from pathlib import Path

# 切换到 python/scripts 目录以正确导入模块
project_root = Path(__file__).resolve().parent.parent.parent.parent
scripts_dir = project_root / "python" / "scripts"
os.chdir(scripts_dir)
sys.path.insert(0, str(scripts_dir))

from credential_migration import (
    detect_legacy_layout,
    ensure_credential_storage_ready,
    migrate_legacy_credentials,
)


def main():
    """执行 credential_migration 模块的主要函数并记录结果"""
    results = {}

    # 1. detect_legacy_layout - 检测遗留布局
    print("=" * 60)
    print("执行：detect_legacy_layout()")
    print("=" * 60)
    result = detect_legacy_layout()
    results["detect_legacy_layout"] = result
    print(f"输入：无参数")
    print(f"输出：{json.dumps(result, indent=2, default=str)}")
    print()

    # 2. migrate_legacy_credentials - 迁移遗留凭证
    print("=" * 60)
    print("执行：migrate_legacy_credentials()")
    print("=" * 60)
    result = migrate_legacy_credentials()
    results["migrate_legacy_credentials"] = result
    print(f"输入：credential_name=None")
    print(f"输出：{json.dumps(result, indent=2, default=str)}")
    print()

    # 3. ensure_credential_storage_ready - 确保存储就绪
    print("=" * 60)
    print("执行：ensure_credential_storage_ready()")
    print("=" * 60)
    result = ensure_credential_storage_ready()
    results["ensure_credential_storage_ready"] = result
    print(f"输入：credential_name=None")
    print(f"输出：{json.dumps(result, indent=2, default=str)}")
    print()

    # 汇总
    print("=" * 60)
    print("蒸馏完成 - 所有函数执行成功")
    print("=" * 60)

    return results


if __name__ == "__main__":
    main()
