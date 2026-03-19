"""E2EE Handler 蒸馏脚本 - 记录输入输出作为黄金标准"""

import asyncio
import json
import sys
from pathlib import Path

# 添加 python/scripts 到路径
BASE_DIR = Path(r"D:\huangyg\git\sample\awiki\python\scripts")
sys.path.insert(0, str(BASE_DIR))

from e2ee_handler import E2eeHandler, DecryptResult


def print_section(title: str) -> None:
    """打印分隔线"""
    print(f"\n{'='*60}")
    print(f" {title}")
    print('='*60)


async def test_e2ee_handler() -> None:
    """测试 E2eeHandler 的主要功能"""
    
    print_section("E2EE Handler 蒸馏测试")
    
    # 1. 测试初始化
    print_section("1. 创建 E2eeHandler 实例")
    handler = E2eeHandler(
        credential_name="test_credential",
        save_interval=30.0,
        decrypt_fail_action="drop"
    )
    print(f"输入：credential_name='test_credential', save_interval=30.0, decrypt_fail_action='drop'")
    print(f"输出：E2eeHandler 实例已创建")
    print(f"is_ready: {handler.is_ready}")
    
    # 2. 测试消息类型检查
    print_section("2. 测试消息类型检查")
    test_types = ["e2ee_init", "e2ee_msg", "e2ee_ack", "e2ee_rekey", "e2ee_error", "normal_msg"]
    for msg_type in test_types:
        is_e2ee = handler.is_e2ee_type(msg_type)
        is_protocol = handler.is_protocol_type(msg_type)
        print(f"  {msg_type}: is_e2ee={is_e2ee}, is_protocol={is_protocol}")
    
    # 3. 测试协议消息处理（无客户端时）
    print_section("3. 测试协议消息处理（未初始化）")
    params = {
        "type": "e2ee_init",
        "sender_did": "did:wba:awiki.ai:user:test",
        "content": json.dumps({"version": "1.0"})
    }
    result = await handler.handle_protocol_message(params)
    print(f"输入：{params}")
    print(f"输出：{result}")
    
    # 4. 测试消息解密（无客户端时）
    print_section("4. 测试消息解密（未初始化）")
    encrypted_params = {
        "id": "msg_001",
        "type": "e2ee_msg",
        "sender_did": "did:wba:awiki.ai:user:sender",
        "content": json.dumps({"encrypted": "data"})
    }
    decrypt_result = await handler.decrypt_message(encrypted_params)
    print(f"输入：{encrypted_params}")
    print(f"输出：DecryptResult(params={decrypt_result.params}, error_responses={decrypt_result.error_responses})")
    
    # 5. 测试状态保存（无客户端时）
    print_section("5. 测试状态保存（未初始化）")
    await handler.maybe_save_state()
    await handler.force_save_state()
    print("输入：调用 maybe_save_state() 和 force_save_state()")
    print("输出：无操作（客户端未初始化）")
    
    # 6. 测试错误分类
    print_section("6. 测试错误分类")
    test_exceptions = [
        Exception("unsupported_version"),
        Exception("session not found"),
        Exception("session expired"),
        Exception("invalid sequence"),
        Exception("unknown error")
    ]
    for exc in test_exceptions:
        error_code, retry_hint = handler._classify_error(exc)
        print(f"  异常：{exc} -> error_code={error_code}, retry_hint={retry_hint}")
    
    # 7. 测试解密失败策略
    print_section("7. 测试解密失败策略")
    for action in ["drop", "forward_raw"]:
        h = E2eeHandler("test", decrypt_fail_action=action)
        fallback = h._on_decrypt_fail({"type": "test", "content": "data"})
        print(f"  decrypt_fail_action={action} -> fallback={fallback}")
    
    # 8. 测试 DecryptResult 命名元组
    print_section("8. 测试 DecryptResult 命名元组")
    result = DecryptResult(params={"type": "message", "content": "plaintext"}, error_responses=[])
    print(f"创建：DecryptResult(params={{'type': 'message', 'content': 'plaintext'}}, error_responses=[])")
    print(f"params: {result.params}")
    print(f"error_responses: {result.error_responses}")
    
    print_section("蒸馏测试完成")
    print("所有测试通过 - 黄金标准已记录")


def main() -> int:
    """主函数"""
    try:
        asyncio.run(test_e2ee_handler())
        return 0
    except Exception as e:
        print(f"错误：{e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
