#!/usr/bin/env python3
"""Distill script for python/scripts/utils/ws.py

Records the "golden standard" behavior of WsClient class.
"""

from __future__ import annotations

import json
import uuid


def demonstrate_url_building() -> dict:
    """Demonstrate WebSocket URL building logic.
    
    Input: base_url (HTTP or WebSocket)
    Output: WebSocket URL with token
    """
    test_cases = [
        "https://awiki.ai/message",
        "http://localhost:8080/message",
        "wss://awiki.ai/message",
        "ws://localhost:8080/message",
    ]
    
    results = []
    for base_url in test_cases:
        # Convert HTTP URL to WebSocket URL
        if base_url.startswith("ws://") or base_url.startswith("wss://"):
            ws_url = base_url.rstrip("/")
        else:
            ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://")
        
        url = f"{ws_url}/message/ws?token=mock_jwt_token"
        results.append({
            "input": base_url,
            "output": url,
        })
    
    return {"url_building": results}


def demonstrate_json_rpc_format() -> dict:
    """Demonstrate JSON-RPC message formats.
    
    Input: method, params, request_id
    Output: JSON-RPC formatted messages
    """
    # Request format
    request = {
        "jsonrpc": "2.0",
        "method": "send",
        "params": {
            "content": "Hello!",
            "type": "text",
            "receiver_did": "did:wba:awiki.ai:user:k1_test",
            "client_msg_id": str(uuid.uuid4()),
        },
        "id": 1,
    }
    
    # Response format
    response = {
        "jsonrpc": "2.0",
        "result": {
            "id": "msg_123",
            "server_seq": 42,
            "sent_at": "2026-03-19T10:00:00Z",
        },
        "id": 1,
    }
    
    # Notification format (no id field)
    notification = {
        "method": "new_message",
        "params": {
            "id": "msg_456",
            "sender_did": "did:wba:awiki.ai:user:k1_sender",
            "content": "Hello back!",
            "type": "text",
            "server_seq": 43,
            "sent_at": "2026-03-19T10:01:00Z",
        },
    }
    
    return {
        "json_rpc_formats": {
            "request": request,
            "response": response,
            "notification": notification,
        }
    }


def demonstrate_send_message_params() -> dict:
    """Demonstrate send_message parameter handling.
    
    Input: various parameters
    Output: params dict sent to server
    """
    # Simulate send_message parameter building
    client_msg_id = str(uuid.uuid4())
    
    params = {
        "content": "Hello!",
        "type": "text",
        "client_msg_id": client_msg_id,
        "receiver_did": "did:wba:awiki.ai:user:k1_test",
        "title": "Test Message",
    }
    
    return {
        "send_message_params": params,
        "auto_generated_client_msg_id": client_msg_id,
    }


def demonstrate_notification_detection() -> dict:
    """Demonstrate how to detect push notifications.
    
    Input: JSON-RPC message
    Output: is_notification (bool)
    """
    test_messages = [
        # Request response (has id)
        {"jsonrpc": "2.0", "result": {}, "id": 1},
        # Error response (has id)
        {"jsonrpc": "2.0", "error": {"code": -32000, "message": "Error"}, "id": 2},
        # Notification (no id)
        {"method": "new_message", "params": {}},
        # Ping/pong (no id)
        {"method": "pong"},
    ]
    
    results = []
    for msg in test_messages:
        is_notification = "id" not in msg
        results.append({
            "message": msg,
            "is_notification": is_notification,
        })
    
    return {"notification_detection": results}


def demonstrate_class_interface() -> dict:
    """Demonstrate WsClient class interface.
    
    Input: None
    Output: Class methods and signatures
    """
    return {
        "class_interface": {
            "class_name": "WsClient",
            "description": "molt-message WebSocket client wrapper",
            "methods": [
                {
                    "name": "__init__",
                    "signature": "(config: SDKConfig, identity: DIDIdentity) -> None",
                    "description": "Initialize WebSocket client",
                },
                {
                    "name": "connect",
                    "signature": "() -> None",
                    "description": "Establish WebSocket connection",
                },
                {
                    "name": "close",
                    "signature": "() -> None",
                    "description": "Close the connection",
                },
                {
                    "name": "__aenter__",
                    "signature": "() -> WsClient",
                    "description": "Async context manager entry",
                },
                {
                    "name": "__aexit__",
                    "signature": "(*args: Any) -> None",
                    "description": "Async context manager exit",
                },
                {
                    "name": "send_rpc",
                    "signature": "(method: str, params: dict | None) -> dict",
                    "description": "Send JSON-RPC request and wait for response",
                },
                {
                    "name": "send_message",
                    "signature": "(content, receiver_did, receiver_id, group_did, group_id, msg_type, client_msg_id, title) -> dict",
                    "description": "Convenience method for sending messages",
                },
                {
                    "name": "ping",
                    "signature": "() -> bool",
                    "description": "Send application-layer heartbeat",
                },
                {
                    "name": "receive",
                    "signature": "(timeout: float) -> dict | None",
                    "description": "Receive a single message",
                },
                {
                    "name": "receive_notification",
                    "signature": "(timeout: float) -> dict | None",
                    "description": "Receive a single push notification",
                },
            ],
        }
    }


def main() -> None:
    """Run all demonstrations and record golden standard output."""
    print("=" * 60)
    print("DISTILL: python/scripts/utils/ws.py")
    print("=" * 60)
    
    # 1. URL building
    print("\n[1] URL Building Logic")
    print("-" * 40)
    url_result = demonstrate_url_building()
    print(json.dumps(url_result, indent=2))
    
    # 2. JSON-RPC formats
    print("\n[2] JSON-RPC Message Formats")
    print("-" * 40)
    rpc_result = demonstrate_json_rpc_format()
    print(json.dumps(rpc_result, indent=2))
    
    # 3. send_message parameters
    print("\n[3] send_message Parameters")
    print("-" * 40)
    params_result = demonstrate_send_message_params()
    print(json.dumps(params_result, indent=2))
    
    # 4. Notification detection
    print("\n[4] Notification Detection")
    print("-" * 40)
    notify_result = demonstrate_notification_detection()
    print(json.dumps(notify_result, indent=2))
    
    # 5. Class interface
    print("\n[5] WsClient Class Interface")
    print("-" * 40)
    interface_result = demonstrate_class_interface()
    print(json.dumps(interface_result, indent=2))
    
    print("\n" + "=" * 60)
    print("DISTILL COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
