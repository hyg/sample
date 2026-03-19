"""Distill script for manage_credits.py

执行 manage_credits.py 的主要函数，记录输入输出作为"黄金标准"。
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# 添加 python/scripts 目录到路径
# distill.py 位于：D:\huangyg\git\sample\awiki\doc\scripts\manage_credits.py\distill.py
# python/scripts 位于：D:\huangyg\git\sample\awiki\python\scripts
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent.parent  # doc/scripts -> doc -> awiki
python_scripts = project_root / "python" / "scripts"
sys.path.insert(0, str(python_scripts))

from utils import SDKConfig, create_user_service_client, rpc_call, authenticated_rpc_call
from utils.logging_config import configure_logging
from credential_store import create_authenticator

CREDITS_RPC = "/user-service/credits/rpc"
logger = logging.getLogger(__name__)


async def distill_get_balance(credential_name: str = "default") -> dict:
    """蒸馏 get_balance 函数：记录输入并执行，返回输出。"""
    logger.info("Distilling get_balance: credential=%s", credential_name)
    
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        return {
            "status": "error",
            "error": f"Credential '{credential_name}' unavailable",
            "hint": "Please create an identity first with setup_identity.py or register_handle.py",
        }

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, CREDITS_RPC, "get_balance", {},
            auth=auth, credential_name=credential_name,
        )
        return result


async def distill_get_transactions(
    credential_name: str = "default",
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """蒸馏 get_transactions 函数：记录输入并执行，返回输出。"""
    logger.info(
        "Distilling get_transactions: credential=%s, limit=%d, offset=%d",
        credential_name, limit, offset,
    )
    
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        return {
            "status": "error",
            "error": f"Credential '{credential_name}' unavailable",
            "hint": "Please create an identity first with setup_identity.py or register_handle.py",
        }

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, CREDITS_RPC, "get_transactions",
            {"limit": limit, "offset": offset},
            auth=auth, credential_name=credential_name,
        )
        return result


async def distill_get_rules() -> dict:
    """蒸馏 get_rules 函数：记录输入并执行，返回输出。"""
    logger.info("Distilling get_rules")
    
    config = SDKConfig()
    async with create_user_service_client(config) as client:
        result = await rpc_call(
            client, CREDITS_RPC, "get_rules", {},
        )
        return result


def main() -> None:
    configure_logging(console_level=None, mirror_stdio=True)

    parser = argparse.ArgumentParser(
        description="Distill manage_credits.py — record inputs and outputs as golden standards"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--balance", action="store_true", help="Distill get_balance")
    group.add_argument("--transactions", action="store_true", help="Distill get_transactions")
    group.add_argument("--rules", action="store_true", help="Distill get_rules")

    parser.add_argument("--credential", type=str, default="default",
                        help="Credential name (default: default)")
    parser.add_argument("--limit", type=int, default=20,
                        help="Transaction list limit (default: 20)")
    parser.add_argument("--offset", type=int, default=0,
                        help="Transaction list offset (default: 0)")

    args = parser.parse_args()
    logger.info("Distill started: mode=balance=%s, transactions=%s, rules=%s",
                args.balance, args.transactions, args.rules)

    if args.balance:
        result = asyncio.run(distill_get_balance(args.credential))
    elif args.transactions:
        result = asyncio.run(distill_get_transactions(args.credential, args.limit, args.offset))
    elif args.rules:
        result = asyncio.run(distill_get_rules())
    else:
        result = {"status": "error", "error": "No operation specified"}

    # 输出 JSON 结果
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
