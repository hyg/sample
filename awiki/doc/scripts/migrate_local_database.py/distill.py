"""Distiller script for migrate_local_database.py

记录输入输出作为"黄金标准"�?
Usage:
    cd D:\\huangyg\\git\\sample\\awiki\\python
    python scripts/distill.py
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

# 添加 scripts 目录到路径（使用绝对路径�?PROJECT_ROOT = Path(r"D:\\huangyg\\git\\sample\\awiki")
sys.path.insert(0, str(PROJECT_ROOT / "python" / "scripts"))

from database_migration import migrate_local_database
from utils.logging_config import configure_logging

logger = logging.getLogger(__name__)


def distill() -> None:
    """执行迁移并记录输入输出�?""
    configure_logging(console_level=None, mirror_stdio=True)

    logger.info("=== Distiller: migrate_local_database 开�?===")
    
    # 记录输入（无参数�?    input_data = {"args": []}
    logger.info(f"输入：{json.dumps(input_data, ensure_ascii=False)}")
    
    # 执行迁移
    result = migrate_local_database()
    
    # 记录输出
    logger.info(f"输出：{json.dumps(result, ensure_ascii=False, indent=2)}")
    logger.info("=== Distiller: migrate_local_database 完成 ===")
    
    # 打印结果
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    distill()
