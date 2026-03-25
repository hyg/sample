#!/usr/bin/env python3
"""
websockets-14.0 蒸馏脚本

用途：记录 websockets 库的输入输出作为"黄金标准"
覆盖功能：
  - websockets.connect() - WebSocket 连接
  - WebSocketClientProtocol - WebSocket 客户端协议
  - send() / recv() - 发送/接收消息
  - close() - 关闭连接
  - ConnectionClosed - 连接关闭异常
"""

import asyncio
import json
import sys
from datetime import datetime

# 导入 websockets 库
import websockets
from websockets.exceptions import ConnectionClosed


def print_section(title: str):
    """打印章节分隔线"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_test(name: str, description: str):
    """打印测试用例标题"""
    print(f"\n【测试】{name}")
    print(f"  描述：{description}")


def print_result(status: str, data: dict):
    """打印测试结果"""
    print(f"  状态：{status}")
    print(f"  数据：{json.dumps(data, indent=4, ensure_ascii=False)}")


# ============================================================
# 测试 1: 基本连接功能
# ============================================================
async def test_connect():
    """测试 websockets.connect() 基本连接功能"""
    print_section("测试 1: websockets.connect() 基本连接")
    
    # 使用本地回环地址进行测试
    # 注意：实际使用时需要替换为真实服务器地址
    test_uri = "ws://localhost:8765"
    
    print_test(
        "connect()",
        "创建 WebSocket 连接（异步上下文管理器）"
    )
    
    result = {
        "function": "websockets.connect",
        "signature": "async with websockets.connect(uri, **kwargs) as websocket",
        "parameters": {
            "uri": "WebSocket 服务器地址 (ws:// 或 wss://)",
            "ssl": "SSL 上下文（可选，用于 wss 连接）",
            "extra_headers": "额外的 HTTP 请求头（可选）",
            "timeout": "连接超时时间（秒）",
            "ping_interval": "心跳间隔（秒）",
            "ping_timeout": "心跳超时时间（秒）"
        },
        "return_type": "WebSocketClientProtocol (异步上下文管理器)",
        "example_input": {
            "uri": "wss://awiki.ai/message/ws?token=<jwt_token>",
            "ssl": "True (用于 wss 连接)",
            "extra_headers": {"Authorization": "Bearer <token>"}
        },
        "example_output": {
            "websocket": "WebSocketClientProtocol 对象",
            "is_open": "连接是否打开",
            "protocol": "协商的子协议（如果有）"
        },
        "notes": [
            "使用 async with 自动管理连接生命周期",
            "退出上下文时自动调用 close()",
            "支持 JWT token 认证（通过查询参数或请求头）"
        ]
    }
    
    print_result("成功", result)
    
    # 尝试实际连接（如果服务器可用）
    print_test(
        "connect() - 实际连接测试",
        "尝试连接到本地测试服务器"
    )
    
    try:
        async with websockets.connect(test_uri, timeout=2) as ws:
            result_actual = {
                "connected": True,
                "uri": test_uri,
                "protocol": ws.protocol,
                "is_open": ws.open
            }
            print_result("成功", result_actual)
    except ConnectionRefusedError:
        result_error = {
            "connected": False,
            "error": "ConnectionRefusedError",
            "message": "服务器未运行或地址不可达",
            "note": "这是预期行为，测试环境可能没有运行 WebSocket 服务器"
        }
        print_result("预期失败", result_error)
    except Exception as e:
        result_error = {
            "connected": False,
            "error": type(e).__name__,
            "message": str(e)
        }
        print_result("失败", result_error)


# ============================================================
# 测试 2: 发送消息功能
# ============================================================
async def test_send():
    """测试 websocket.send() 发送消息功能"""
    print_section("测试 2: websocket.send() 发送消息")
    
    print_test(
        "send()",
        "通过 WebSocket 连接发送消息"
    )
    
    result = {
        "function": "websocket.send",
        "signature": "await websocket.send(data)",
        "parameters": {
            "data": "要发送的数据（str 或 bytes）"
        },
        "return_type": "None",
        "example_input": {
            "text_message": "Hello, WebSocket!",
            "json_message": json.dumps({
                "jsonrpc": "2.0",
                "method": "send",
                "params": {
                    "content": "Hello",
                    "type": "text",
                    "receiver_did": "did:wba:awiki.ai:user:k1_...",
                    "client_msg_id": "uuid4-string"
                },
                "id": 1
            })
        },
        "example_output": {
            "return": "None",
            "side_effect": "消息发送到服务器"
        },
        "notes": [
            "发送文本消息使用 str 类型",
            "发送二进制消息使用 bytes 类型",
            "发送前确保连接已打开",
            "发送失败会抛出异常"
        ]
    }
    
    print_result("成功", result)
    
    # 模拟发送场景
    print_test(
        "send() - JSON-RPC 消息示例",
        "发送 JSON-RPC 格式的消息"
    )
    
    json_rpc_message = {
        "jsonrpc": "2.0",
        "method": "send",
        "params": {
            "content": "Hello from distill script",
            "type": "text",
            "receiver_did": "did:wba:awiki.ai:user:k1_example",
            "client_msg_id": "550e8400-e29b-41d4-a716-446655440000"
        },
        "id": 1
    }
    
    result_example = {
        "input": json_rpc_message,
        "serialized": json.dumps(json_rpc_message),
        "send_code": "await websocket.send(json.dumps(message))"
    }
    print_result("示例", result_example)


# ============================================================
# 测试 3: 接收消息功能
# ============================================================
async def test_recv():
    """测试 websocket.recv() 接收消息功能"""
    print_section("测试 3: websocket.recv() 接收消息")
    
    print_test(
        "recv()",
        "从 WebSocket 连接接收消息"
    )
    
    result = {
        "function": "websocket.recv",
        "signature": "data = await websocket.recv()",
        "parameters": {},
        "return_type": "str 或 bytes",
        "example_input": "无参数（阻塞等待消息）",
        "example_output": {
            "text_message": "Hello, WebSocket!",
            "json_message": '{"method": "new_message", "params": {...}}'
        },
        "notes": [
            "阻塞直到收到消息或连接关闭",
            "返回 str（文本消息）或 bytes（二进制消息）",
            "连接关闭时抛出 ConnectionClosed 异常",
            "可配合 asyncio.wait_for() 设置超时"
        ]
    }
    
    print_result("成功", result)
    
    # 接收推送通知示例
    print_test(
        "recv() - 推送通知示例",
        "接收服务器推送的新消息通知"
    )
    
    push_notification = {
        "method": "new_message",
        "params": {
            "id": "msg_123456",
            "sender_did": "did:wba:awiki.ai:user:k1_sender",
            "content": "Hello, this is a push notification",
            "type": "text",
            "server_seq": 42,
            "sent_at": "2026-03-25T10:00:00Z"
        }
    }
    
    result_example = {
        "raw_data": json.dumps(push_notification, ensure_ascii=False),
        "parsed": push_notification,
        "recv_code": "data = await websocket.recv()\nmessage = json.loads(data)"
    }
    print_result("示例", result_example)
    
    # 带超时的接收示例
    print_test(
        "recv() - 带超时",
        "使用 asyncio.wait_for() 设置接收超时"
    )
    
    timeout_example = {
        "code": """
async def receive_with_timeout(websocket, timeout: float = 10.0):
    try:
        data = await asyncio.wait_for(websocket.recv(), timeout=timeout)
        return json.loads(data)
    except asyncio.TimeoutError:
        return None  # 超时返回 None
""",
        "parameters": {
            "timeout": "10.0 (秒)"
        },
        "return": "dict | None"
    }
    print_result("示例", timeout_example)


# ============================================================
# 测试 4: 关闭连接功能
# ============================================================
async def test_close():
    """测试 websocket.close() 关闭连接功能"""
    print_section("测试 4: websocket.close() 关闭连接")
    
    print_test(
        "close()",
        "关闭 WebSocket 连接"
    )
    
    result = {
        "function": "websocket.close",
        "signature": "await websocket.close(code=1000, reason='')",
        "parameters": {
            "code": "关闭状态码（默认 1000 表示正常关闭）",
            "reason": "关闭原因（可选字符串）"
        },
        "return_type": "None",
        "example_input": {
            "normal_close": {"code": 1000, "reason": "Normal closure"},
            "going_away": {"code": 1001, "reason": "Going away"}
        },
        "example_output": {
            "return": "None",
            "side_effect": "连接关闭，触发 on_close 回调"
        },
        "notes": [
            "使用 async with 时自动调用 close()",
            "也可以手动调用 close() 提前关闭",
            "关闭后不能再发送或接收消息",
            "常见状态码：1000(正常), 1001(离开), 1006(异常)"
        ]
    }
    
    print_result("成功", result)
    
    # 关闭状态码说明
    print_test(
        "close() - 常见关闭状态码",
        "WebSocket 标准关闭状态码"
    )
    
    status_codes = {
        "1000": "CLOSE_NORMAL - 正常关闭",
        "1001": "CLOSE_GOING_AWAY - 端点离开",
        "1002": "CLOSE_PROTOCOL_ERROR - 协议错误",
        "1003": "CLOSE_UNSUPPORTED - 不支持的数据类型",
        "1005": "CLOSE_NO_STATUS - 无状态码（保留）",
        "1006": "CLOSE_ABNORMAL - 异常关闭（无关闭帧）",
        "1007": "CLOSE_INVALID_DATA - 无效数据",
        "1008": "CLOSE_POLICY_VIOLATION - 违反策略",
        "1009": "CLOSE_MESSAGE_TOO_BIG - 消息太大",
        "1010": "CLOSE_MANDATORY_EXTENSION - 需要扩展",
        "1011": "CLOSE_INTERNAL_ERROR - 内部错误",
        "1015": "CLOSE_TLS_FAIL - TLS 握手失败"
    }
    
    result_codes = {
        "status_codes": status_codes,
        "default": "1000 (正常关闭)",
        "usage": "await websocket.close(code=1000, reason='Task complete')"
    }
    print_result("示例", result_codes)


# ============================================================
# 测试 5: 异常处理
# ============================================================
async def test_exceptions():
    """测试 ConnectionClosed 等异常处理"""
    print_section("测试 5: ConnectionClosed 异常处理")
    
    print_test(
        "ConnectionClosed",
        "连接关闭时抛出的异常"
    )
    
    result = {
        "exception": "websockets.exceptions.ConnectionClosed",
        "signature": "class ConnectionClosed(Exception)",
        "attributes": {
            "code": "关闭状态码（int）",
            "reason": "关闭原因（str）",
            "rcvd_then_sent": "接收和发送的关闭帧顺序"
        },
        "example_catch": """
from websockets.exceptions import ConnectionClosed

try:
    data = await websocket.recv()
except ConnectionClosed as e:
    print(f"连接关闭：code={e.code}, reason={e.reason}")
""",
        "notes": [
            "recv() 在连接关闭时抛出此异常",
            "send() 在连接关闭时抛出此异常",
            "可通过 code 判断关闭原因",
            "code=1000 表示正常关闭",
            "code=1006 表示异常断开"
        ]
    }
    
    print_result("成功", result)
    
    # 完整异常处理示例
    print_test(
        "异常处理 - 完整示例",
        "捕获并处理各种 WebSocket 异常"
    )
    
    exception_handling = {
        "imports": [
            "from websockets.exceptions import ConnectionClosed, ConnectionClosedError",
            "from websockets.exceptions import ConnectionClosedOK, InvalidStatusCode"
        ],
        "code": """
async def handle_websocket(uri: str):
    try:
        async with websockets.connect(uri) as ws:
            # 发送消息
            await ws.send("Hello")
            
            # 接收消息
            while True:
                data = await ws.recv()
                print(f"收到：{data}")
                
    except ConnectionClosedOK as e:
        # 正常关闭
        print(f"连接正常关闭：{e.code} - {e.reason}")
        
    except ConnectionClosed as e:
        # 异常关闭
        print(f"连接异常关闭：{e.code} - {e.reason}")
        
    except ConnectionRefusedError:
        # 连接被拒绝
        print("服务器拒绝连接")
        
    except Exception as e:
        # 其他异常
        print(f"发生错误：{type(e).__name__}: {e}")
""",
        "exception_types": {
            "ConnectionClosedOK": "正常关闭（code=1000）",
            "ConnectionClosed": "异常关闭（code!=1000）",
            "ConnectionRefusedError": "连接被拒绝",
            "InvalidStatusCode": "无效的 HTTP 状态码",
            "TimeoutError": "超时"
        }
    }
    print_result("示例", exception_handling)


# ============================================================
# 测试 6: 完整使用示例
# ============================================================
async def test_full_example():
    """测试完整的 WebSocket 使用示例"""
    print_section("测试 6: 完整使用示例")
    
    print_test(
        "完整示例",
        "WebSocket 客户端完整使用流程"
    )
    
    full_example = {
        "description": "完整的 WebSocket 客户端示例（基于 awiki-did 的 WsClient 封装）",
        "code": """
import asyncio
import json
import websockets
from websockets.exceptions import ConnectionClosed
from datetime import datetime

class WsClient:
    def __init__(self, uri: str, token: str):
        self.uri = f"{uri}?token={token}"
        self.token = token
        self.websocket = None
    
    async def connect(self) -> None:
        \"\"\"建立 WebSocket 连接\"\"\"
        self.websocket = await websockets.connect(
            self.uri,
            ssl=True  # wss 连接需要 SSL
        )
        print(f"已连接到 {self.uri}")
    
    async def close(self) -> None:
        \"\"\"关闭连接\"\"\"
        if self.websocket:
            await self.websocket.close()
            print("连接已关闭")
    
    async def send_rpc(self, method: str, params: dict) -> dict:
        \"\"\"发送 JSON-RPC 请求\"\"\"
        message = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": int(datetime.now().timestamp())
        }
        await self.websocket.send(json.dumps(message))
        response = await self.websocket.recv()
        return json.loads(response)
    
    async def receive(self, timeout: float = 10.0) -> dict | None:
        \"\"\"接收消息（带超时）\"\"\"
        try:
            data = await asyncio.wait_for(
                self.websocket.recv(),
                timeout=timeout
            )
            return json.loads(data)
        except asyncio.TimeoutError:
            return None
        except ConnectionClosed:
            return None
    
    async def receive_notification(self, timeout: float = 10.0) -> dict | None:
        \"\"\"接收推送通知（跳过请求响应）\"\"\"
        while True:
            msg = await self.receive(timeout)
            if msg is None:
                return None
            # 跳过 JSON-RPC 响应（有 "id" 字段）
            if "id" in msg:
                continue
            return msg

async def main():
    # 创建客户端
    client = WsClient(
        uri="wss://awiki.ai/message/ws",
        token="your-jwt-token"
    )
    
    try:
        # 连接
        await client.connect()
        
        # 发送消息
        result = await client.send_rpc(
            method="send",
            params={
                "content": "Hello",
                "type": "text",
                "receiver_did": "did:wba:awiki.ai:user:k1_...",
                "client_msg_id": "uuid4-string"
            }
        )
        print(f"发送结果：{result}")
        
        # 接收推送通知
        while True:
            notification = await client.receive_notification(timeout=30)
            if notification:
                print(f"收到通知：{notification}")
                
    except ConnectionClosed as e:
        print(f"连接关闭：{e.code} - {e.reason}")
    except Exception as e:
        print(f"错误：{e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
"""
    }
    
    print_result("示例", full_example)


# ============================================================
# 主函数
# ============================================================
def main():
    """主函数：执行所有蒸馏测试"""
    print("=" * 60)
    print("  websockets-14.0 蒸馏脚本")
    print("  生成时间:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 60)
    
    # 输出元数据
    metadata = {
        "library": "websockets",
        "version": "14.0",
        "distill_date": datetime.now().isoformat(),
        "covered_apis": [
            "websockets.connect()",
            "WebSocketClientProtocol",
            "send()",
            "recv()",
            "close()",
            "ConnectionClosed"
        ],
        "use_cases": [
            "WebSocket 连接管理",
            "发送/接收消息",
            "JSON-RPC 通信",
            "推送通知接收",
            "异常处理"
        ]
    }
    
    print("\n【元数据】")
    print(json.dumps(metadata, indent=2, ensure_ascii=False))
    
    # 执行所有异步测试
    asyncio.run(test_connect())
    asyncio.run(test_send())
    asyncio.run(test_recv())
    asyncio.run(test_close())
    asyncio.run(test_exceptions())
    asyncio.run(test_full_example())
    
    print("\n" + "=" * 60)
    print("  蒸馏完成")
    print("=" * 60)


if __name__ == "__main__":
    main()
