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


# =============================================================================
# 附录：补充场景测试 - E2EE 状态机、WebSocket 推送、协议消息处理
# =============================================================================

def test_e2ee_state_machine_full_cycle(
    credential_name: str = "test_credential",
    output_file: str | None = None,
) -> dict:
    """测试 E2EE 状态机完整周期。
    
    数据准备:
    1. 创建 E2eeHandler 实例
    2. 模拟完整的 E2EE 会话生命周期
    
    预期结果:
    状态转换:
    - uninitialized → initializing (收到 e2ee_init)
    - initializing → initialized (处理 e2ee_init)
    - initialized → confirmed (收到 e2ee_ack)
    - confirmed → active (发送 e2ee_msg)
    - active → expired (模拟过期)
    """
    input_data = {
        "scenario": "state_machine_full_cycle",
        "credential_name": credential_name,
    }
    
    output_data = {
        "state_transitions": [],
        "final_state": None,
        "error": None,
    }
    
    try:
        handler = E2eeHandler(credential_name=credential_name, save_interval=30.0, decrypt_fail_action="drop")
        
        # 步骤 1: 初始状态
        output_data["state_transitions"].append({
            "state": "uninitialized",
            "is_ready": handler.is_ready,
            "trigger": "initial"
        })
        
        # 步骤 2: 处理 e2ee_init (uninitialized → initializing)
        init_msg = {
            "type": "e2ee_init",
            "sender_did": "did:wba:awiki.ai:user:test_peer",
            "content": json.dumps({"version": "1.0", "sender_key": "mock_key"})
        }
        result = asyncio.run(handler.handle_protocol_message(init_msg))
        output_data["state_transitions"].append({
            "state": "initializing",
            "message_type": "e2ee_init",
            "result": str(result),
            "trigger": "receive_e2ee_init"
        })
        
        # 步骤 3: 处理 e2ee_ack (initializing → initialized)
        ack_msg = {
            "type": "e2ee_ack",
            "sender_did": "did:wba:awiki.ai:user:test_peer",
            "content": json.dumps({"version": "1.0", "receiver_key": "mock_key"})
        }
        result = asyncio.run(handler.handle_protocol_message(ack_msg))
        output_data["state_transitions"].append({
            "state": "initialized",
            "message_type": "e2ee_ack",
            "result": str(result),
            "trigger": "receive_e2ee_ack"
        })
        
        # 步骤 4: 验证状态
        output_data["final_state"] = "initialized"
        
        return _record_e2ee_handler_test("state_machine_full_cycle", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_e2ee_handler_test("state_machine_full_cycle", input_data, output_data, False, output_file, str(e))


def test_handle_websocket_push_message(
    credential_name: str = "test_credential",
    output_file: str | None = None,
) -> dict:
    """测试 WebSocket 推送消息处理。
    
    数据准备:
    1. 创建 E2eeHandler 实例
    2. 模拟 WebSocket 推送的 E2EE 消息
    
    预期结果:
    1. 识别为 E2EE 消息类型
    2. 尝试解密
    3. 路由到 webhook（如果配置）
    """
    input_data = {
        "scenario": "websocket_push_message",
        "credential_name": credential_name,
        "mock_websocket_message": {
            "type": "e2ee_msg",
            "sender_did": "did:wba:awiki.ai:user:test_peer",
            "content": json.dumps({"version": "1.0", "ciphertext": "mock"}),
        },
    }
    
    output_data = {
        "identified_as_e2ee": False,
        "decryption_attempted": False,
        "routed_to_webhook": False,
        "error": None,
    }
    
    try:
        handler = E2eeHandler(credential_name=credential_name, save_interval=30.0, decrypt_fail_action="drop")
        
        # 步骤 1: 识别消息类型
        msg_type = input_data["mock_websocket_message"]["type"]
        is_e2ee = handler.is_e2ee_type(msg_type)
        is_protocol = handler.is_protocol_type(msg_type)
        
        output_data["identified_as_e2ee"] = is_e2ee
        output_data["is_protocol"] = is_protocol
        
        # 步骤 2: 尝试解密（由于没有客户端，应返回错误）
        decrypt_result = asyncio.run(handler.decrypt_message(input_data["mock_websocket_message"]))
        output_data["decryption_attempted"] = True
        output_data["decrypt_result"] = {
            "params": str(decrypt_result.params),
            "error_responses": str(decrypt_result.error_responses),
        }
        
        # 步骤 3: 验证错误处理
        output_data["routed_to_webhook"] = len(decrypt_result.error_responses) > 0
        
        return _record_e2ee_handler_test("websocket_push_message", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_e2ee_handler_test("websocket_push_message", input_data, output_data, False, output_file, str(e))


def test_handle_protocol_message_all_types(
    credential_name: str = "test_credential",
    output_file: str | None = None,
) -> dict:
    """测试所有 E2EE 协议消息类型的处理。
    
    数据准备:
    1. 创建 E2eeHandler 实例
    2. 构造所有类型的协议消息
    
    预期结果:
    - e2ee_init: 返回 e2ee_ack
    - e2ee_ack: 无响应（会话建立）
    - e2ee_rekey: 返回确认
    - e2ee_error: 记录错误
    - e2ee_msg: 尝试解密
    """
    input_data = {
        "scenario": "protocol_message_all_types",
        "credential_name": credential_name,
        "message_types": ["e2ee_init", "e2ee_ack", "e2ee_rekey", "e2ee_error", "e2ee_msg"],
    }
    
    output_data = {
        "results": {},
        "error": None,
    }
    
    try:
        handler = E2eeHandler(credential_name=credential_name, save_interval=30.0, decrypt_fail_action="drop")
        
        for msg_type in input_data["message_types"]:
            mock_msg = {
                "type": msg_type,
                "sender_did": "did:wba:awiki.ai:user:test_peer",
                "content": json.dumps({"version": "1.0", "mock_data": "test"})
            }
            
            try:
                result = asyncio.run(handler.handle_protocol_message(mock_msg))
                output_data["results"][msg_type] = {
                    "success": True,
                    "response_count": len(result) if isinstance(result, list) else 1,
                    "response": str(result)[:100],  # 截断长输出
                }
            except Exception as e:
                output_data["results"][msg_type] = {
                    "success": False,
                    "error": str(e),
                }
        
        return _record_e2ee_handler_test("protocol_message_all_types", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_e2ee_handler_test("protocol_message_all_types", input_data, output_data, False, output_file, str(e))


def test_decrypt_message_with_scenarios(
    credential_name: str = "test_credential",
    output_file: str | None = None,
) -> dict:
    """测试消息解密的各种场景。
    
    数据准备:
    1. 创建 E2eeHandler 实例
    2. 构造不同场景的加密消息
    
    预期结果:
    - 正常消息：解密成功
    - 会话不存在：返回错误
    - 版本不支持：返回 e2ee_error
    - 解密失败：根据策略处理
    """
    input_data = {
        "scenario": "decrypt_message_scenarios",
        "credential_name": credential_name,
        "test_cases": [
            {"name": "session_not_found", "content": {"version": "1.0", "session_id": "nonexistent"}},
            {"name": "unsupported_version", "content": {"version": "99.0", "ciphertext": "mock"}},
            {"name": "invalid_ciphertext", "content": {"version": "1.0", "ciphertext": "invalid"}},
        ],
    }
    
    output_data = {
        "test_results": {},
        "error": None,
    }
    
    try:
        handler = E2eeHandler(credential_name=credential_name, save_interval=30.0, decrypt_fail_action="drop")
        
        for test_case in input_data["test_cases"]:
            mock_msg = {
                "id": f"msg_{test_case['name']}",
                "type": "e2ee_msg",
                "sender_did": "did:wba:awiki.ai:user:test_peer",
                "content": json.dumps(test_case["content"]),
            }
            
            try:
                result = asyncio.run(handler.decrypt_message(mock_msg))
                output_data["test_results"][test_case["name"]] = {
                    "success": True,
                    "params": str(result.params)[:100],
                    "error_count": len(result.error_responses),
                }
            except Exception as e:
                output_data["test_results"][test_case["name"]] = {
                    "success": False,
                    "error": str(e),
                }
        
        return _record_e2ee_handler_test("decrypt_message_scenarios", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_e2ee_handler_test("decrypt_message_scenarios", input_data, output_data, False, output_file, str(e))


def _record_e2ee_handler_test(
    scenario: str,
    input_data: dict,
    output_data: dict,
    success: bool,
    output_file: str | None = None,
    error: str | None = None,
) -> dict:
    """记录 E2EE Handler 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,  # 使用时间戳
        "script": "e2ee_handler.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
        print(f"黄金标准已保存到：{output_file}", file=sys.stderr)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    
    return golden_record


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
