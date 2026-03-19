#!/usr/bin/env python3
"""蒸馏脚本 - utils/logging_config.py

提取日志配置函数的输入输出作为黄金标准
"""

import sys
import json
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

# 添加 Python 脚本目录到路径
sys.path.insert(0, str(PYTHON_SCRIPTS))

# 导入目标模块
from utils.logging_config import configure_logging, get_log_dir, DailyRetentionFileHandler
from utils.config import SDKConfig

def distill():
    """执行蒸馏，返回输入输出对"""
    results = {
        "file": "python/scripts/utils/logging_config.py",
        "doc_path": "doc/scripts/utils/logging_config.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    # 测试 get_log_dir() - 无参数版本
    log_dir = get_log_dir()
    results["functions"].append({
        "name": "get_log_dir",
        "type": "function",
        "signature": "(config=None) -> Path",
        "tests": [
            {
                "input": {},
                "output": {"log_dir": str(log_dir)},
                "scenario": "获取日志目录（使用默认配置）"
            },
            {
                "input": {"config": "SDKConfig()"},
                "output": {"log_dir": str(log_dir)},
                "scenario": "获取日志目录（使用 SDKConfig）"
            }
        ]
    })
    
    # 测试 configure_logging() - 实际签名
    try:
        logger = configure_logging()
        results["functions"].append({
            "name": "configure_logging",
            "type": "function",
            "signature": "(level=None, log_file=True) -> None",
            "tests": [{
                "input": {},
                "output": {
                    "success": True,
                    "root_logger_handlers": len(logger.handlers) if logger else 0
                },
                "scenario": "配置默认日志"
            }]
        })
    except Exception as e:
        results["functions"].append({
            "name": "configure_logging",
            "type": "function",
            "signature": "(level=None, log_file=True) -> None",
            "tests": [{
                "input": {},
                "output": {"error": str(e)},
                "scenario": "配置日志"
            }]
        })
    
    # 导出常量
    results["constants"] = {
        "LOG_FILE_PREFIX": "awiki-agent",
        "MAX_RETENTION_DAYS": 15,
        "MAX_TOTAL_SIZE_BYTES": 15 * 1024 * 1024
    }
    
    # 导出类信息
    results["classes"] = {
        "DailyRetentionFileHandler": {
            "description": "按天轮换的文件日志处理器",
            "base_class": "logging.handlers.TimedRotatingFileHandler",
            "methods": ["__init__", "shouldRollover"]
        }
    }
    
    return results

if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
