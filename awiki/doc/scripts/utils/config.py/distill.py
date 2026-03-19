#!/usr/bin/env python3
"""蒸馏脚本 - utils/config.py

提取 SDKConfig 类的输入输出作为黄金标准
"""

import sys
import json
import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

# 添加 Python 脚本目录到路径
sys.path.insert(0, str(PYTHON_SCRIPTS))

# 导入目标模块
from utils.config import SDKConfig

def distill():
    """执行蒸馏，返回输入输出对"""
    results = {
        "file": "python/scripts/utils/config.py",
        "doc_path": "doc/scripts/utils/config.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    # 测试 SDKConfig.load() - 默认配置
    config = SDKConfig.load()
    results["functions"].append({
        "name": "SDKConfig.load",
        "type": "classmethod",
        "signature": "() -> SDKConfig",
        "tests": [{
            "input": {},
            "output": {
                "user_service_url": config.user_service_url,
                "molt_message_url": config.molt_message_url,
                "molt_message_ws_url": config.molt_message_ws_url,
                "did_domain": config.did_domain,
                "credentials_dir": str(config.credentials_dir),
                "data_dir": str(config.data_dir)
            },
            "scenario": "加载默认配置（环境变量或默认值）"
        }]
    })
    
    # 导出类信息
    results["classes"] = {
        "SDKConfig": {
            "description": "awiki 系统服务配置",
            "properties": [
                "user_service_url",
                "molt_message_url", 
                "molt_message_ws_url",
                "did_domain",
                "credentials_dir",
                "data_dir"
            ],
            "methods": ["load"],
            "decorators": ["@dataclass(frozen=True, slots=True)"]
        }
    }
    
    # 环境变量配置
    results["environment"] = {
        "variables": [
            {"name": "E2E_USER_SERVICE_URL", "default": "https://awiki.ai", "purpose": "用户服务 URL"},
            {"name": "E2E_MOLT_MESSAGE_URL", "default": "https://awiki.ai", "purpose": "消息服务 URL"},
            {"name": "E2E_MOLT_MESSAGE_WS_URL", "default": None, "purpose": "WebSocket 服务 URL"},
            {"name": "E2E_DID_DOMAIN", "default": "awiki.ai", "purpose": "DID 域名"},
            {"name": "AWIKI_DATA_DIR", "default": None, "purpose": "数据目录覆盖"},
            {"name": "AWIKI_WORKSPACE", "default": None, "purpose": "工作空间目录"}
        ]
    }
    
    return results

if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
