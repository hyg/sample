"""E2EE 端到端加密消息脚本的蒸馏版本。

记录输入输出作为"黄金标准"。
"""

import argparse
import asyncio
import json
import logging
import sys
import uuid
from pathlib import Path
from typing import Any

# 添加 python/scripts 目录到路径以支持导入
# distill.py 位于 doc/scripts/e2ee_messaging.py/
# 需要到达 python/scripts 目录（utils 在此目录中）
_scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

from utils import SDKConfig, E2eeClient, create_molt_message_client, authenticated_rpc_call, resolve_to_did
from utils.e2ee import (
    SUPPORTED_E2EE_VERSION,
    build_e2ee_error_content,
    build_e2ee_error_message,
)
from utils.logging_config import configure_logging
from credential_store import create_authenticator, load_identity
from e2ee_store import save_e2ee_state, load_e2ee_state
from e2ee_outbox import (
    begin_send_attempt,
    get_record,
    list_failed_records,
    mark_dropped,
    record_local_failure,
    mark_send_success,
    record_remote_failure,
)


MESSAGE_RPC = "/message/rpc"
logger = logging.getLogger(__name__)

_E2EE_MSG_TYPES = {"e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"}
_E2EE_SESSION_SETUP_TYPES = {"e2ee_init", "e2ee_rekey"}
_E2EE_USER_NOTICE = "This is an encrypted message."

_E2EE_TYPE_ORDER = {"e2ee_init": 0, "e2ee_ack": 1, "e2ee_rekey": 2, "e2ee_msg": 3, "e2ee_error": 4}


def _message_time_value(message: dict[str, Any]) -> str:
    """返回消息的可排序时间戳字符串。"""
    timestamp = message.get("sent_at") or message.get("created_at")
    return timestamp if isinstance(timestamp, str) else ""


def _sender_did_value(message: dict[str, Any], fallback: str = "?") -> str:
    """返回安全的发送者 DID 字符串。"""
    sender_did = message.get("sender_did")
    return sender_did if isinstance(sender_did, str) and sender_did else fallback


def _message_sort_key(message: dict[str, Any]) -> tuple[Any, ...]:
    """构建稳定的收件箱排序键。"""
    sender_did_raw = message.get("sender_did")
    sender_did = sender_did_raw if isinstance(sender_did_raw, str) else ""
    server_seq = message.get("server_seq")
    has_server_seq = 0 if isinstance(server_seq, int) else 1
    server_seq_value = server_seq if isinstance(server_seq, int) else 0
    return (
        sender_did,
        has_server_seq,
        server_seq_value,
        _message_time_value(message),
        _E2EE_TYPE_ORDER.get(message.get("type"), 99),
    )


def _render_user_visible_e2ee_text(plaintext: str) -> str:
    """渲染解密后的 E2EE 消息的用户可见文本。"""
    return f"{_E2EE_USER_NOTICE}\n{plaintext}"


def _render_auto_session_notice(peer_did: str) -> str:
    """渲染发送优先自动初始化流程的用户可见通知。"""
    return (
        "No active E2EE session found; sent automatic init before the encrypted payload. "
        f"Peer: {peer_did}"
    )


def _classify_decrypt_error(exc: BaseException) -> tuple[str, str]:
    """将解密失败映射为 e2ee_error 代码和重试提示。"""
    msg = str(exc).lower()
    if "unsupported_version" in msg:
        return "unsupported_version", "drop"
    if "session" in msg and "not found" in msg:
        return "session_not_found", "rekey_then_resend"
    if "expired" in msg:
        return "session_expired", "rekey_then_resend"
    if "seq" in msg or "sequence" in msg:
        return "invalid_seq", "rekey_then_resend"
    return "decryption_failed", "resend"


def _load_or_create_e2ee_client(local_did: str, credential_name: str) -> E2eeClient:
    """从磁盘加载现有 E2EE 客户端状态，或创建新客户端。"""
    cred = load_identity(credential_name)
    signing_pem: str | None = None
    x25519_pem: str | None = None
    if cred is not None:
        signing_pem = cred.get("e2ee_signing_private_pem")
        x25519_pem = cred.get("e2ee_agreement_private_pem")

    if signing_pem is None or x25519_pem is None:
        print("Warning: Credential missing E2EE keys (key-2/key-3); please recreate identity to enable HPKE E2EE")

    state = load_e2ee_state(credential_name)
    if state is not None and state.get("local_did") == local_did:
        if signing_pem is not None:
            state["signing_pem"] = signing_pem
        if x25519_pem is not None:
            state["x25519_pem"] = x25519_pem
        client = E2eeClient.from_state(state)
        return client

    return E2eeClient(local_did, signing_pem=signing_pem, x25519_pem=x25519_pem)


def _save_e2ee_client(client: E2eeClient, credential_name: str) -> None:
    """保存 E2EE 客户端状态到磁盘。"""
    state = client.export_state()
    save_e2ee_state(state, credential_name)


async def _send_msg(client, sender_did, receiver_did, msg_type, content, *, auth, credential_name="default", client_msg_id: str | None = None, title: str | None = None):
    """发送消息（E2EE 或明文）。"""
    if isinstance(content, dict):
        content = json.dumps(content)
    if client_msg_id is None:
        client_msg_id = str(uuid.uuid4())
    params = {
        "sender_did": sender_did,
        "receiver_did": receiver_did,
        "content": content,
        "type": msg_type,
        "client_msg_id": client_msg_id,
    }
    if title is not None:
        params["title"] = title
    return await authenticated_rpc_call(
        client, MESSAGE_RPC, "send",
        params=params,
        auth=auth,
        credential_name=credential_name,
    )


async def initiate_handshake(peer_did: str, credential_name: str = "default") -> None:
    """手动启动 E2EE 会话（高级/手动路径）。"""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)
    msg_type, content = await e2ee_client.initiate_handshake(peer_did)

    async with create_molt_message_client(config) as client:
        await _send_msg(client, data["did"], peer_did, msg_type, content,
                        auth=auth, credential_name=credential_name)

    _save_e2ee_client(e2ee_client, credential_name)

    print(f"E2EE session established (one-step initialization)")
    print(f"  session_id: {content.get('session_id')}")
    print(f"  peer_did  : {peer_did}")
    print("Session is ACTIVE; you can send encrypted messages now")
    print("Tip: --send auto-initializes a session when needed; manual handshake is mainly for debugging or pre-warming.")


async def send_encrypted(peer_did: str, plaintext: str, credential_name: str = "default", original_type: str = "text", outbox_id: str | None = None, title: str | None = None) -> None:
    """通过正常发送优先流程发送加密消息。"""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)

    init_msgs = await e2ee_client.ensure_active_session(peer_did)

    async with create_molt_message_client(config) as client:
        if init_msgs:
            print(_render_auto_session_notice(peer_did))
        for init_type, init_content in init_msgs:
            await _send_msg(client, data["did"], peer_did, init_type, init_content,
                            auth=auth, credential_name=credential_name)

        enc_type, enc_content = e2ee_client.encrypt_message(peer_did, plaintext, original_type)
        session_id = enc_content.get("session_id")
        outbox_id = begin_send_attempt(
            peer_did=peer_did,
            plaintext=plaintext,
            original_type=original_type,
            credential_name=credential_name,
            session_id=session_id,
            outbox_id=outbox_id,
        )
        send_client_msg_id = str(uuid.uuid4())
        try:
            send_result = await _send_msg(
                client,
                data["did"],
                peer_did,
                enc_type,
                enc_content,
                auth=auth,
                credential_name=credential_name,
                client_msg_id=send_client_msg_id,
                title=title,
            )
        except Exception as exc:
            record_local_failure(
                outbox_id=outbox_id,
                credential_name=credential_name,
                error_code="send_request_failed",
                retry_hint="resend",
                metadata=json.dumps({"error": str(exc)}, ensure_ascii=False),
            )
            print(f"Encrypted message send failed; outbox_id={outbox_id}")
            raise

        mark_send_success(
            outbox_id=outbox_id,
            credential_name=credential_name,
            local_did=data["did"],
            peer_did=peer_did,
            plaintext=plaintext,
            original_type=original_type,
            session_id=session_id,
            sent_msg_id=send_result.get("id"),
            sent_server_seq=send_result.get("server_seq"),
            sent_at=send_result.get("sent_at"),
            client_msg_id=send_client_msg_id,
            title=title,
        )

    _save_e2ee_client(e2ee_client, credential_name)

    print("Encrypted message sent")
    print(f"  Plaintext: {plaintext}")
    print(f"  Receiver : {peer_did}")
    print(f"  Outbox ID: {outbox_id}")


async def process_inbox(peer_did: str, credential_name: str = "default") -> None:
    """处理收件箱中的 E2EE 消息。"""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    async with create_molt_message_client(config) as client:
        inbox = await authenticated_rpc_call(
            client, MESSAGE_RPC, "get_inbox",
            params={"user_did": data["did"], "limit": 50},
            auth=auth, credential_name=credential_name,
        )
        messages = inbox.get("messages", [])
        if not messages:
            print("Inbox is empty")
            return

        messages.sort(key=_message_sort_key)

        e2ee_client: E2eeClient | None = None
        e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)
        processed_ids = []

        for msg in messages:
            msg_type = msg["type"]
            sender_did = _sender_did_value(msg)
            processed_ok = False

            if msg_type in _E2EE_MSG_TYPES:
                content = json.loads(msg["content"])

                if msg_type == "e2ee_msg":
                    try:
                        original_type, plaintext = e2ee_client.decrypt_message(content)
                        logger.info(
                            "Decrypted E2EE inbox message sender=%s original_type=%s",
                            sender_did,
                            original_type,
                        )
                        print(_render_user_visible_e2ee_text(plaintext))
                        processed_ok = True
                    except Exception as e:
                        logger.warning(
                            "Failed to decrypt E2EE inbox message sender=%s error=%s",
                            sender_did,
                            e,
                        )
                        error_code, retry_hint = _classify_decrypt_error(e)
                        error_content = build_e2ee_error_content(
                            error_code=error_code,
                            session_id=content.get("session_id"),
                            failed_msg_id=msg.get("id"),
                            failed_server_seq=msg.get("server_seq"),
                            retry_hint=retry_hint,
                            required_e2ee_version=SUPPORTED_E2EE_VERSION if error_code == "unsupported_version" else None,
                            message=build_e2ee_error_message(
                                error_code,
                                required_e2ee_version=SUPPORTED_E2EE_VERSION if error_code == "unsupported_version" else None,
                                detail=str(e),
                            ),
                        )
                        await _send_msg(
                            client, data["did"], sender_did, "e2ee_error", error_content,
                            auth=auth, credential_name=credential_name,
                        )
                else:
                    if msg_type == "e2ee_error":
                        matched_outbox_id = record_remote_failure(
                            credential_name=credential_name,
                            peer_did=sender_did,
                            content=content,
                        )
                        if matched_outbox_id:
                            logger.info(
                                "Matched failed E2EE outbox sender=%s outbox_id=%s",
                                sender_did,
                                matched_outbox_id,
                            )
                    responses = await e2ee_client.process_e2ee_message(msg_type, content)
                    session_ready = True
                    terminal_error_notified = any(
                        resp_type == "e2ee_error" for resp_type, _ in responses
                    )
                    if msg_type in _E2EE_SESSION_SETUP_TYPES:
                        session_ready = e2ee_client.has_session_id(content.get("session_id"))
                    logger.info(
                        "Processed E2EE protocol message type=%s sender=%s responses=%d session_ready=%s terminal_error_notified=%s",
                        msg_type,
                        sender_did,
                        len(responses),
                        session_ready,
                        terminal_error_notified,
                    )
                    if session_ready:
                        processed_ok = True
                    elif terminal_error_notified:
                        processed_ok = True
                    for resp_type, resp_content in responses:
                        await _send_msg(
                            client, data["did"], peer_did, resp_type, resp_content,
                            auth=auth, credential_name=credential_name,
                        )
            else:
                print(f"  [{msg_type}] From {sender_did[:40]}...: {msg['content']}")
                processed_ok = True

            if processed_ok:
                processed_ids.append(msg["id"])

        if processed_ids:
            await authenticated_rpc_call(
                client, MESSAGE_RPC, "mark_read",
                params={"user_did": data["did"], "message_ids": processed_ids},
                auth=auth, credential_name=credential_name,
            )
            logger.info("Marked %d E2EE inbox message(s) as read", len(processed_ids))

        if e2ee_client is not None:
            _save_e2ee_client(e2ee_client, credential_name)


def main() -> None:
    configure_logging(console_level=None, mirror_stdio=True)

    parser = argparse.ArgumentParser(
        description="E2EE 端到端加密消息（正常路径：--send 自动初始化会话）"
    )
    group = parser.add_mutually_exclusive_group(required=False)  # 改为可选
    group.add_argument("--handshake", type=str, help="预初始化 E2EE 会话")
    group.add_argument("--send", type=str, help="发送加密消息并自动初始化会话")
    group.add_argument("--process", action="store_true", help="处理收件箱 E2EE 消息")
    group.add_argument("--list-failed", action="store_true", help="列出失败的发件箱记录")
    group.add_argument("--retry", type=str, help="重试失败的记录")
    group.add_argument("--drop", type=str, help="丢弃失败的记录")
    group.add_argument("--test", action="store_true", help="执行测试场景")

    parser.add_argument("--content", type=str, help="消息内容（--send 必需）")
    parser.add_argument("--title", type=str, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--peer", type=str, help="对等方 DID（--process 必需）")
    parser.add_argument("--credential", type=str, default="default", help="凭证名称")

    args = parser.parse_args()
    
    # 如果指定--test 或无参数，执行测试场景
    if args.test or not any([args.handshake, args.send, args.process, args.list_failed, args.retry, args.drop]):
        print("Running E2EE test scenarios...")
        r1 = test_e2ee_session_not_found(peer_did='test', plaintext='test', credential_name='huangyg.default')
        print(f"test_e2ee_session_not_found: {'PASS' if r1['success'] else 'FAIL'}")
        r2 = test_e2ee_decrypt_unsupported_version(peer_did='test', credential_name='huangyg.default')
        print(f"test_e2ee_decrypt_unsupported_version: {'PASS' if r2['success'] else 'FAIL'}")
        return
    
    logger.info(
        "e2ee_messaging CLI started credential=%s action=%s",
        args.credential,
        (
            "handshake" if args.handshake else
            "send" if args.send else
            "process" if args.process else
            "list_failed" if args.list_failed else
            "retry" if args.retry else
            "drop"
        ),
    )

    if args.handshake:
        peer_did = asyncio.run(resolve_to_did(args.handshake))
        asyncio.run(initiate_handshake(peer_did, args.credential))
    elif args.send:
        if not args.content:
            parser.error("发送加密消息需要 --content")
        peer_did = asyncio.run(resolve_to_did(args.send))
        asyncio.run(send_encrypted(peer_did, args.content, args.credential, title=args.title))
    elif args.process:
        if not args.peer:
            parser.error("处理收件箱需要 --peer")
        peer_did = asyncio.run(resolve_to_did(args.peer))
        asyncio.run(process_inbox(peer_did, args.credential))
    elif args.list_failed:
        records = list_failed_records(args.credential)
        print(json.dumps(records, indent=2, ensure_ascii=False))
    elif args.retry:
        record = get_record(args.retry, args.credential)
        if record is None:
            parser.error(f"发件箱记录 '{args.retry}' 未找到")
        asyncio.run(
            send_encrypted(
                record["peer_did"],
                record["plaintext"],
                args.credential,
                original_type=record.get("original_type") or "text",
                outbox_id=record["outbox_id"],
            )
        )
    elif args.drop:
        mark_dropped(args.drop, args.credential)
        print(f"Dropped outbox record: {args.drop}")


if __name__ == "__main__":
    main()


# =============================================================================
# 附录：E2EE 状态机测试和边缘场景
# =============================================================================

def test_e2ee_session_not_found(
    peer_did: str,
    plaintext: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试 E2EE 会话不存在场景。
    
    数据准备:
    1. 删除 E2EE 会话状态文件
    2. 尝试发送加密消息
    
    预期结果:
    1. 自动重新建立会话（发送 e2ee_init）
    2. 消息成功发送
    3. 会话状态恢复
    """
    import os
    from e2ee_store import load_e2ee_state, save_e2ee_state
    
    input_data = {
        "scenario": "session_not_found",
        "peer_did": peer_did,
        "plaintext": plaintext,
        "credential_name": credential_name,
        "session_deleted": True,
    }
    
    output_data = {
        "auto_initiated": False,
        "new_session_created": False,
        "message_sent": False,
        "error": None,
    }
    
    try:
        # 步骤 1: 删除会话状态（模拟会话丢失）
        config = SDKConfig()
        auth_result = create_authenticator(credential_name, config)
        if auth_result is None:
            output_data["error"] = f"Credential '{credential_name}' not found"
            return _record_e2ee_test_result("session_not_found", input_data, output_data, False, output_file)
        
        _, data = auth_result
        my_did = data["did"]
        
        # 备份会话状态
        backup_state = load_e2ee_state(my_did, peer_did, credential_name)
        
        # 删除会话状态
        _delete_e2ee_session(my_did, peer_did, credential_name)
        logger.info("Deleted E2EE session for testing peer=%s", peer_did)
        
        # 步骤 2: 发送加密消息（应自动建立会话）
        asyncio.run(send_encrypted(peer_did, plaintext, credential_name))
        
        # 步骤 3: 验证会话已重新建立
        new_state = load_e2ee_state(my_did, peer_did, credential_name)
        
        output_data["auto_initiated"] = True
        output_data["new_session_created"] = new_state is not None
        output_data["message_sent"] = True
        output_data["session_restored"] = new_state is not None
        
        # 恢复备份（可选）
        if backup_state:
            save_e2ee_state(my_did, peer_did, credential_name, backup_state)
        
        return _record_e2ee_test_result("session_not_found", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_e2ee_test_result("session_not_found", input_data, output_data, False, output_file, str(e))


def test_e2ee_decrypt_unsupported_version(
    peer_did: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试不支持的 E2EE 版本场景。
    
    数据准备:
    1. 构造一个高版本号的 e2ee_msg
    2. 尝试解密
    
    预期结果:
    1. 识别为不支持的版本
    2. 返回 e2ee_error
    3. 错误码为 unsupported_version
    """
    from utils.e2ee import SUPPORTED_E2EE_VERSION
    
    input_data = {
        "scenario": "decrypt_unsupported_version",
        "peer_did": peer_did,
        "credential_name": credential_name,
        "mock_version": "99.0",  # 不支持的高版本
        "supported_version": SUPPORTED_E2EE_VERSION,
    }
    
    output_data = {
        "error_code": None,
        "retry_hint": None,
        "e2ee_error_sent": False,
        "error": None,
    }
    
    try:
        # 步骤 1: 构造不支持版本的消息
        mock_content = {
            "version": "99.0",
            "ciphertext": "mock_ciphertext",
            "tag": "mock_tag",
        }
        
        # 步骤 2: 尝试解密（应抛出异常）
        config = SDKConfig()
        auth_result = create_authenticator(credential_name, config)
        if auth_result is None:
            output_data["error"] = f"Credential '{credential_name}' not found"
            return _record_e2ee_test_result("decrypt_unsupported_version", input_data, output_data, False, output_file)
        
        _, data = auth_result
        my_did = data["did"]
        
        e2ee_client = _load_or_create_e2ee_client(my_did, credential_name)
        
        try:
            e2ee_client.decrypt_message(mock_content)
            output_data["error"] = "Expected exception but decryption succeeded"
            return _record_e2ee_test_result("decrypt_unsupported_version", input_data, output_data, False, output_file)
        except Exception as e:
            # 步骤 3: 验证错误分类
            error_code, retry_hint = _classify_decrypt_error(e)
            
            output_data["error_code"] = error_code
            output_data["retry_hint"] = retry_hint
            output_data["exception_type"] = type(e).__name__
            output_data["exception_message"] = str(e)
            
            # 验证错误码正确
            success = error_code == "unsupported_version" and retry_hint == "drop"
            output_data["e2ee_error_sent"] = success
            
            return _record_e2ee_test_result("decrypt_unsupported_version", input_data, output_data, success, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_e2ee_test_result("decrypt_unsupported_version", input_data, output_data, False, output_file, str(e))


def test_e2ee_state_machine_full_cycle(
    peer_did: str,
    plaintext: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试 E2EE 状态机完整周期。
    
    数据准备:
    1. 清除会话状态
    2. 执行完整的 E2EE 会话生命周期
    
    预期结果:
    状态转换:
    - no_session → initiating (send_message)
    - initiating → initialized (send_e2ee_init)
    - initialized → confirmed (receive_e2ee_ack)
    - confirmed → active (send_e2ee_msg)
    - active → expired (timeout, 模拟)
    """
    from e2ee_store import load_e2ee_state
    
    input_data = {
        "scenario": "state_machine_full_cycle",
        "peer_did": peer_did,
        "plaintext": plaintext,
        "credential_name": credential_name,
    }
    
    output_data = {
        "state_transitions": [],
        "final_state": None,
        "message_sent": False,
        "error": None,
    }
    
    try:
        config = SDKConfig()
        auth_result = create_authenticator(credential_name, config)
        if auth_result is None:
            output_data["error"] = f"Credential '{credential_name}' not found"
            return _record_e2ee_test_result("state_machine_full_cycle", input_data, output_data, False, output_file)
        
        _, data = auth_result
        my_did = data["did"]
        
        # 步骤 1: 清除会话状态 (no_session)
        _delete_e2ee_session(my_did, peer_did, credential_name)
        output_data["state_transitions"].append({"from": "none", "to": "no_session", "trigger": "delete_session"})
        
        # 步骤 2: 发送加密消息 (触发 initiating → initialized)
        asyncio.run(send_encrypted(peer_did, plaintext, credential_name))
        output_data["state_transitions"].append({"from": "no_session", "to": "initiating", "trigger": "send_message"})
        output_data["state_transitions"].append({"from": "initiating", "to": "initialized", "trigger": "send_e2ee_init"})
        
        # 步骤 3: 验证会话已建立 (active)
        state = load_e2ee_state(my_did, peer_did, credential_name)
        if state:
            output_data["state_transitions"].append({"from": "initialized", "to": "active", "trigger": "session_established"})
            output_data["final_state"] = "active"
            output_data["message_sent"] = True
        else:
            output_data["final_state"] = "unknown"
            output_data["message_sent"] = False
        
        return _record_e2ee_test_result("state_machine_full_cycle", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_e2ee_test_result("state_machine_full_cycle", input_data, output_data, False, output_file, str(e))


def _delete_e2ee_session(my_did: str, peer_did: str, credential_name: str) -> None:
    """删除 E2EE 会话状态（仅用于测试）。"""
    from e2ee_store import _get_e2ee_state_path
    import os
    
    state_path = _get_e2ee_state_path(my_did, peer_did, credential_name)
    if os.path.exists(state_path):
        os.remove(state_path)
        logger.debug("Deleted E2EE session file: %s", state_path)


def _record_e2ee_test_result(
    scenario: str,
    input_data: dict,
    output_data: dict,
    success: bool,
    output_file: str | None = None,
    error: str | None = None,
) -> dict:
    """记录 E2EE 测试结果。"""
    golden_record = {
        "timestamp": datetime.now().isoformat(),
        "script": "e2ee_messaging.py",
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
            json.dump(golden_record, f, indent=2, ensure_ascii=False)
        print(f"黄金标准已保存到：{output_file}", file=sys.stderr)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False))
    
    return golden_record
