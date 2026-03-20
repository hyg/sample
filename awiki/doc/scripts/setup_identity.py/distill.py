"""蒸馏脚本：记录 setup_identity.py 的输入输出作为黄金标准。

此脚本执行 setup_identity.py 的各种操作，并记录输入参数和输出结果。
"""

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# 添加 python/scripts 到路径以便导入
# 目录结构：doc/scripts/setup_identity.py/distill.py
# 目标路径：python/scripts
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # D:\huangyg\git\sample\awiki
SCRIPTS_DIR = BASE_DIR / "python" / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from utils import SDKConfig
from utils.logging_config import configure_logging
from credential_store import list_identities, load_identity

logger = logging.getLogger(__name__)

# 输出目录
OUTPUT_DIR = Path(__file__).parent
GOLDEN_STANDARD_FILE = OUTPUT_DIR / "golden_standard.json"


def record_result(action: str, input_args: dict, output_data: dict, success: bool, error: str = None) -> dict:
    """记录执行结果。"""
    record = {
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "input": input_args,
        "output": output_data,
        "success": success,
        "error": error,
    }
    return record


def test_list_identities() -> dict:
    """测试列出所有身份。"""
    print("\n" + "=" * 70)
    print("测试：列出所有保存的身份")
    print("=" * 70)
    
    input_args = {"action": "list"}
    output_data = {"identities": [], "count": 0}
    
    try:
        identities = list_identities()
        output_data["identities"] = [
            {
                "credential_name": ident["credential_name"],
                "did": ident["did"],
                "name": ident.get("name", "N/A"),
                "has_jwt": ident["has_jwt"],
                "created_at": ident.get("created_at", "N/A"),
            }
            for ident in identities
        ]
        output_data["count"] = len(identities)
        
        print(f"找到 {len(identities)} 个身份:")
        for ident in output_data["identities"]:
            print(f"  - [{ident['credential_name']}] {ident['did']}")
        
        return record_result("list", input_args, output_data, True)
    except Exception as e:
        print(f"错误：{e}")
        return record_result("list", input_args, output_data, False, str(e))


def test_sdk_config() -> dict:
    """测试 SDK 配置。"""
    print("\n" + "=" * 70)
    print("测试：SDK 配置")
    print("=" * 70)
    
    input_args = {"action": "config"}
    output_data = {}
    
    try:
        config = SDKConfig()
        output_data = {
            "user_service_url": config.user_service_url,
            "did_domain": config.did_domain,
            "molt_message_url": config.molt_message_url,
            "molt_message_ws_url": config.molt_message_ws_url,
        }
        
        print("服务配置:")
        print(f"  user-service      : {config.user_service_url}")
        print(f"  DID domain        : {config.did_domain}")
        print(f"  molt_message      : {config.molt_message_url}")
        print(f"  molt_message_ws   : {config.molt_message_ws_url}")
        
        return record_result("config", input_args, output_data, True)
    except Exception as e:
        print(f"错误：{e}")
        return record_result("config", input_args, output_data, False, str(e))


def test_load_identity(credential_name: str = "default") -> dict:
    """测试加载身份。"""
    print("\n" + "=" * 70)
    print(f"测试：加载身份 '{credential_name}'")
    print("=" * 70)
    
    input_args = {"action": "load", "credential_name": credential_name}
    output_data = {"loaded": False}
    
    try:
        data = load_identity(credential_name)
        if data is None:
            print(f"凭证 '{credential_name}' 未找到")
            output_data["error"] = "Credential not found"
            return record_result("load", input_args, output_data, False, "Credential not found")
        
        output_data = {
            "loaded": True,
            "credential_name": credential_name,
            "did": data["did"],
            "unique_id": data["unique_id"],
            "user_id": data.get("user_id", "N/A"),
            "has_jwt": bool(data.get("jwt_token")),
            "created_at": data.get("created_at", "N/A"),
            "name": data.get("name", "N/A"),
        }
        
        print(f"加载成功:")
        print(f"  DID       : {data['did']}")
        print(f"  unique_id : {data['unique_id']}")
        print(f"  user_id   : {data.get('user_id', 'N/A')}")
        print(f"  JWT       : {'yes' if data.get('jwt_token') else 'no'}")
        print(f"  Created at: {data.get('created_at', 'N/A')}")
        
        return record_result("load", input_args, output_data, True)
    except Exception as e:
        print(f"错误：{e}")
        return record_result("load", input_args, output_data, False, str(e))


async def run_all_tests() -> list:
    """运行所有测试并收集结果。"""
    results = []
    
    # 测试 1: SDK 配置
    results.append(test_sdk_config())
    
    # 测试 2: 列出身份
    results.append(test_list_identities())
    
    # 测试 3: 尝试加载默认身份
    results.append(test_load_identity("default"))
    
    return results


def save_golden_standard(results: list) -> None:
    """保存黄金标准到文件。"""
    golden_data = {
        "generated_at": datetime.now().isoformat(),
        "script": "setup_identity.py",
        "description": "DID 身份管理脚本的输入输出黄金标准",
        "test_results": results,
        "summary": {
            "total_tests": len(results),
            "passed": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
        }
    }
    
    with open(GOLDEN_STANDARD_FILE, "w", encoding="utf-8") as f:
        json.dump(golden_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n黄金标准已保存到：{GOLDEN_STANDARD_FILE}")
    print(f"总计：{golden_data['summary']['total_tests']} 个测试，"
          f"通过：{golden_data['summary']['passed']}, "
          f"失败：{golden_data['summary']['failed']}")


def main() -> None:
    """主函数。"""
    configure_logging(console_level=logging.INFO, mirror_stdio=True)
    
    print("=" * 70)
    print("setup_identity.py 蒸馏脚本")
    print("记录输入输出作为黄金标准")
    print("=" * 70)
    
    start_time = time.time()
    
    # 运行所有测试
    results = asyncio.run(run_all_tests())
    
    # 保存结果
    save_golden_standard(results)
    
    elapsed = time.time() - start_time
    print(f"\n执行时间：{elapsed:.2f} 秒")


if __name__ == "__main__":
    main()
