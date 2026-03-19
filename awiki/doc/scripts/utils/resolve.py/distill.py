#!/usr/bin/env python3
"""Distiller script for python/scripts/utils/resolve.py.

执行 resolve_to_did 函数并记录输入输出作为"黄金标准"。
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# 添加 python/scripts 目录到路径以便导入 utils 模块
# distill.py 位于 doc/scripts/utils/resolve.py/distill.py
# utils 模块位于 python/scripts/utils/
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent  # 4 级回到项目根目录
PYTHON_SCRIPTS = PROJECT_ROOT / "python" / "scripts"
sys.path.insert(0, str(PYTHON_SCRIPTS))

from utils.config import SDKConfig
from utils.resolve import resolve_to_did


async def distill_resolve_to_did() -> dict:
    """执行 resolve_to_did 并记录输入输出。
    
    Returns:
        包含输入输出记录的字典。
    """
    results = []
    
    # 测试用例 1: DID 直返
    test_input_1 = "did:wba:awiki.ai:user:k1_test"
    try:
        result_1 = await resolve_to_did(test_input_1)
        results.append({
            "test": "DID 直返",
            "input": test_input_1,
            "output": result_1,
            "status": "success"
        })
    except Exception as e:
        results.append({
            "test": "DID 直返",
            "input": test_input_1,
            "error": str(e),
            "status": "error"
        })
    
    # 测试用例 2: Handle 解析 (使用默认配置)
    test_input_2 = "alice"
    config = SDKConfig()
    try:
        result_2 = await resolve_to_did(test_input_2, config)
        results.append({
            "test": "Handle 解析",
            "input": test_input_2,
            "output": result_2,
            "config": {
                "user_service_url": config.user_service_url,
                "did_domain": config.did_domain
            },
            "status": "success"
        })
    except Exception as e:
        results.append({
            "test": "Handle 解析",
            "input": test_input_2,
            "error": str(e),
            "status": "error"
        })
    
    # 测试用例 3: Handle 带域名后缀
    test_input_3 = "bob.awiki.ai"
    try:
        result_3 = await resolve_to_did(test_input_3, config)
        results.append({
            "test": "Handle 带域名后缀",
            "input": test_input_3,
            "output": result_3,
            "status": "success"
        })
    except Exception as e:
        results.append({
            "test": "Handle 带域名后缀",
            "input": test_input_3,
            "error": str(e),
            "status": "error"
        })
    
    return {"results": results}


def main() -> None:
    """主函数：执行蒸馏并输出结果。"""
    print("=" * 60)
    print("resolve.py 蒸馏脚本 - 黄金标准记录")
    print("=" * 60)
    print()
    
    results = asyncio.run(distill_resolve_to_did())
    
    print("测试结果:")
    print("-" * 60)
    for i, result in enumerate(results["results"], 1):
        print(f"\n测试 {i}: {result['test']}")
        print(f"  输入：{result['input']}")
        if result['status'] == 'success':
            print(f"  输出：{result['output']}")
        else:
            print(f"  错误：{result['error']}")
        print(f"  状态：{result['status']}")
    
    print()
    print("=" * 60)
    print("蒸馏完成")
    print("=" * 60)


if __name__ == "__main__":
    main()
