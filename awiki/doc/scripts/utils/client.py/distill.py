#!/usr/bin/env python3
"""蒸馏脚本：记录 client.py 的输入输出黄金标准

[目标]: 执行并记录所有公共函数的输入输出
[公共函数]: create_user_service_client, create_molt_message_client
[内部函数]: _resolve_verify
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

# 添加 scripts 目录到路径以便导入 utils
# distill.py 路径: doc/scripts/utils/client.py/distill.py
# parents[4] = D:\huangyg\git\sample\awiki
# scripts = D:\huangyg\git\sample\awiki\python\scripts
base_dir = Path(__file__).resolve().parents[4]
scripts_dir = base_dir / "python" / "scripts"
sys.path.insert(0, str(scripts_dir))

from utils.client import _resolve_verify, create_molt_message_client, create_user_service_client
from utils.config import SDKConfig


def record_result(category: str, func_name: str, input_desc: str, output_desc: str) -> dict:
    """记录测试结果"""
    return {
        "category": category,
        "function": func_name,
        "input": input_desc,
        "output": output_desc,
    }


def test_resolve_verify() -> list[dict]:
    """测试 _resolve_verify 函数"""
    results = []

    # 测试 1: 普通 HTTPS URL
    result1 = _resolve_verify("https://awiki.ai")
    results.append(record_result(
        "_resolve_verify",
        "_resolve_verify",
        "base_url='https://awiki.ai'",
        f"type={type(result1).__name__}, value={result1}",
    ))

    # 测试 2: localhost
    result2 = _resolve_verify("http://localhost:8080")
    results.append(record_result(
        "_resolve_verify",
        "_resolve_verify",
        "base_url='http://localhost:8080'",
        f"type={type(result2).__name__}, value={result2}",
    ))

    # 测试 3: .test 域名
    result3 = _resolve_verify("https://api.test")
    results.append(record_result(
        "_resolve_verify",
        "_resolve_verify",
        "base_url='https://api.test'",
        f"type={type(result3).__name__}, value={result3}",
    ))

    return results


async def test_create_clients() -> list[dict]:
    """测试客户端创建函数"""
    results = []
    config = SDKConfig()

    # 测试 create_user_service_client
    try:
        async with create_user_service_client(config) as client:
            results.append(record_result(
                "client_factory",
                "create_user_service_client",
                f"config.user_service_url='{config.user_service_url}'",
                f"httpx.AsyncClient(base_url='{client.base_url}', timeout={client.timeout})",
            ))
    except Exception as e:
        results.append(record_result(
            "client_factory",
            "create_user_service_client",
            f"config.user_service_url='{config.user_service_url}'",
            f"Error: {e}",
        ))

    # 测试 create_molt_message_client
    try:
        async with create_molt_message_client(config) as client:
            results.append(record_result(
                "client_factory",
                "create_molt_message_client",
                f"config.molt_message_url='{config.molt_message_url}'",
                f"httpx.AsyncClient(base_url='{client.base_url}', timeout={client.timeout})",
            ))
    except Exception as e:
        results.append(record_result(
            "client_factory",
            "create_molt_message_client",
            f"config.molt_message_url='{config.molt_message_url}'",
            f"Error: {e}",
        ))

    return results


def main():
    """主函数：执行所有测试并输出黄金标准"""
    print("=" * 60)
    print("client.py 蒸馏脚本 - 黄金标准记录")
    print("=" * 60)
    print()

    all_results = []

    # 1. 测试 _resolve_verify
    print("[1] 测试 _resolve_verify 函数...")
    resolve_results = test_resolve_verify()
    all_results.extend(resolve_results)
    for r in resolve_results:
        print(f"  - {r['function']}: {r['input']}")
    print()

    # 2. 测试客户端创建函数
    print("[2] 测试客户端创建函数...")
    client_results = asyncio.run(test_create_clients())
    all_results.extend(client_results)
    for r in client_results:
        print(f"  - {r['function']}: {r['input']}")
    print()

    # 3. 输出黄金标准
    print("=" * 60)
    print("黄金标准输出 (JSON)")
    print("=" * 60)
    print(json.dumps(all_results, indent=2, default=str))

    print()
    print("=" * 60)
    print("蒸馏完成")
    print("=" * 60)

    return all_results


if __name__ == "__main__":
    main()
