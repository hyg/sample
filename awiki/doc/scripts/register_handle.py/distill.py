"""蒸馏脚本：记录 register_handle.py 的输入输出作为黄金标准。

此脚本执行原始脚本的核心逻辑，并记录所有输入和输出结果。
用于验证和测试目的。

使用方法:
    python doc/scripts/register_handle.py/distill.py
"""

import argparse
import asyncio
import logging
import sys
import json
from datetime import datetime
from pathlib import Path

# 使用绝对路径添加 python/scripts 目录到路径
PROJECT_ROOT = Path(r"D:\huangyg\git\sample\awiki")
PYTHON_SCRIPTS_DIR = PROJECT_ROOT / "python" / "scripts"
sys.path.insert(0, str(PYTHON_SCRIPTS_DIR))

from utils import SDKConfig, create_user_service_client, send_otp, register_handle
from utils.logging_config import configure_logging
from credential_store import save_identity

logger = logging.getLogger(__name__)


def log_section(title: str) -> None:
    """打印分隔线标题。"""
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)


async def do_register_distill(
    handle: str,
    phone: str,
    otp_code: str | None = None,
    invite_code: str | None = None,
    name: str | None = None,
    credential_name: str = "default",
) -> dict:
    """注册 Handle 并记录输入输出。
    
    返回:
        包含所有输入和输出的字典
    """
    result = {
        "timestamp": datetime.now().isoformat(),
        "script": "register_handle.py",
        "input": {
            "handle": handle,
            "phone": phone,
            "otp_code": "***" if otp_code else None,
            "otp_code_present": bool(otp_code),
            "invite_code": "***" if invite_code else None,
            "invite_code_present": bool(invite_code),
            "name": name,
            "credential_name": credential_name,
        },
        "output": {},
        "status": "pending",
    }
    
    log_section("注册配置")
    config = SDKConfig()
    config_info = {
        "user_service_url": config.user_service_url,
        "did_domain": config.did_domain,
    }
    print(f"Service configuration:")
    print(f"  user-service: {config.user_service_url}")
    print(f"  DID domain  : {config.did_domain}")
    result["config"] = config_info

    async with create_user_service_client(config) as client:
        # 1. 发送 OTP（如果未提供）
        if otp_code is None:
            log_section("发送 OTP")
            print(f"Sending OTP to {phone}...")
            await send_otp(client, phone)
            print("OTP sent. Check your phone.")
            otp_code = input("Enter OTP code: ").strip()
            if not otp_code:
                print("OTP code is required.")
                result["status"] = "failed"
                result["error"] = "OTP code is required"
                return result
            result["input"]["otp_code"] = "***"
            result["input"]["otp_code_present"] = True

        # 2. 注册 Handle
        log_section("注册 Handle")
        print(f"Registering Handle '{handle}'...")
        identity = await register_handle(
            client=client,
            config=config,
            phone=phone,
            otp_code=otp_code,
            handle=handle,
            invite_code=invite_code,
            name=name or handle,
            is_public=True,
        )

        identity_info = {
            "handle": f"{handle}.{config.did_domain}",
            "did": identity.did,
            "unique_id": identity.unique_id,
            "user_id": identity.user_id,
            "jwt_token_prefix": identity.jwt_token[:50] + "...",
        }
        
        print(f"  Handle    : {identity_info['handle']}")
        print(f"  DID       : {identity_info['did']}")
        print(f"  unique_id : {identity_info['unique_id']}")
        print(f"  user_id   : {identity_info['user_id']}")
        print(f"  JWT token : {identity_info['jwt_token_prefix']}")
        
        result["output"]["identity"] = identity_info

        # 3. 保存凭证
        log_section("保存凭证")
        path = save_identity(
            did=identity.did,
            unique_id=identity.unique_id,
            user_id=identity.user_id,
            private_key_pem=identity.private_key_pem,
            public_key_pem=identity.public_key_pem,
            jwt_token=identity.jwt_token,
            display_name=name or handle,
            handle=handle,
            name=credential_name,
            did_document=identity.did_document,
            e2ee_signing_private_pem=identity.e2ee_signing_private_pem,
            e2ee_agreement_private_pem=identity.e2ee_agreement_private_pem,
        )
        print(f"Credential saved to: {path}")
        print(f"Credential name: {credential_name}")
        
        result["output"]["credential_path"] = path
        result["output"]["credential_name"] = credential_name
        result["status"] = "success"

    return result


def main() -> None:
    """主函数：执行蒸馏脚本。"""
    configure_logging(console_level=None, mirror_stdio=True)
    
    parser = argparse.ArgumentParser(
        description="蒸馏脚本：记录 register_handle.py 的输入输出"
    )
    parser.add_argument("--handle", type=str, default="test_distill",
                        help="Handle 本地部分（默认：test_distill）")
    parser.add_argument("--phone", type=str, default="+8613800138000",
                        help="电话号码（默认：+8613800138000）")
    parser.add_argument("--otp-code", type=str, default=None,
                        help="OTP 代码（如果已获得；否则将发送并提示）")
    parser.add_argument("--invite-code", type=str, default=None,
                        help="邀请码（短 handle <= 4 字符需要）")
    parser.add_argument("--name", type=str, default=None,
                        help="显示名称（默认为 handle）")
    parser.add_argument("--credential", type=str, default="distill_test",
                        help="凭证存储名称（默认：distill_test）")
    parser.add_argument("--json-output", type=str, default=None,
                        help="输出 JSON 结果到指定文件")

    args = parser.parse_args()
    
    log_section("蒸馏脚本启动")
    print(f"脚本：register_handle.py/distill.py")
    print(f"时间：{datetime.now().isoformat()}")
    print(f"参数:")
    print(f"  --handle: {args.handle}")
    print(f"  --phone: {args.phone}")
    print(f"  --otp-code: {'***' if args.otp_code else '(未提供，将交互式输入)'}")
    print(f"  --invite-code: {'***' if args.invite_code else '(未提供)'}")
    print(f"  --name: {args.name or args.handle}")
    print(f"  --credential: {args.credential}")

    logger.info(
        "distill started handle=%s credential=%s",
        args.handle,
        args.credential,
    )
    
    result = asyncio.run(do_register_distill(
        handle=args.handle,
        phone=args.phone,
        otp_code=args.otp_code,
        invite_code=args.invite_code,
        name=args.name,
        credential_name=args.credential,
    ))
    
    log_section("蒸馏结果")
    print(f"状态：{result['status']}")
    
    if args.json_output:
        with open(args.json_output, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"结果已保存到：{args.json_output}")
    
    if result["status"] == "success":
        print("\n✓ 注册成功")
        sys.exit(0)
    else:
        print("\n✗ 注册失败")
        if "error" in result:
            print(f"错误：{result['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
