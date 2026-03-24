# 蒸馏脚本覆盖检查清单

## 1. 新增模块蒸馏脚本状态

| 模块 | 文件夹 | distill.py | 测试场景覆盖 | 状态 |
|------|--------|------------|-------------|------|
| `bind_contact.py` | ✅ 已创建 | ⚪ 待创建 | 6.2.5 联系方式绑定 | 🔴 缺失 |
| `e2ee_session_store.py` | ✅ 已创建 | ⚪ 待创建 | 6.2.3 E2EE 失败重试 | 🔴 缺失 |
| `e2ee_outbox.py` | ✅ 已创建 | ✅ 已存在 | 6.2.3 E2EE 失败重试 | 🟡 需补充 |
| `listener_recovery.py` | ✅ 已创建 | ⚪ 待创建 | 6.2.2 心跳检查 | 🔴 缺失 |
| `message_daemon.py` | ✅ 已创建 | ⚪ 待创建 | 6.2.1 实时消息设置 | 🔴 缺失 |
| `message_transport.py` | ✅ 已创建 | ⚪ 待创建 | 6.2.1 实时消息设置 | 🔴 缺失 |
| `send_verification_code.py` | ✅ 已创建 | ⚪ 待创建 | 5.7 手工测试 | 🔴 缺失 |
| `setup_realtime.py` | ✅ 已创建 | ⚪ 待创建 | 6.2.1 实时消息设置 | 🔴 缺失 |

## 2. 旧模块新增功能检查

### 2.1 check_status.py
- ✅ 已有蒸馏脚本
- ⚠️ 需补充测试场景：
  - [ ] JWT 过期自动刷新（5.1）
  - [ ] E2EE 自动处理和解密（6.2.3）
  - [ ] 群组消息分类（6.2.4）
  - [ ] 监听器状态检查（6.2.2）

### 2.2 manage_group.py
- ✅ 已有蒸馏脚本
- ⚠️ 需补充测试场景：
  - [ ] 重复加入群组（已加入后再次加入）（5.4）
  - [ ] 无限群组 vs 发现式群组（5.4）
  - [ ] 成员事件分类（6.2.4）
  - [ ] 加入码刷新和获取（5.4）

### 2.3 register_handle.py
- ✅ 已有蒸馏脚本
- ⚠️ 需补充测试场景：
  - [ ] 邮箱注册流程（5.7）
  - [ ] 邮箱注册轮询模式（5.7）
  - [ ] 短 Handle 邀请码（5.7）

### 2.4 recover_handle.py
- ✅ 已有蒸馏脚本
- ⚠️ 需补充测试场景：
  - [ ] 与 send_verification_code.py 配合使用（5.7）

### 2.5 e2ee_messaging.py
- ✅ 已有蒸馏脚本
- ⚠️ 需补充测试场景：
  - [ ] 自动会话初始化（6.2.3）
  - [ ] 发件箱失败记录（6.2.3）
  - [ ] 重试/丢弃功能（6.2.3）

### 2.6 utils/handle.py
- ✅ 已有蒸馏脚本
- ⚠️ 需补充测试场景：
  - [ ] bind_email_send（5.7）
  - [ ] bind_phone_send_otp（5.7）
  - [ ] bind_phone_verify（5.7）
  - [ ] ensure_email_verification（5.7）

## 3. 特殊测试条件清单

### 3.1 JWT 过期场景
**覆盖模块**：所有需要认证的模块
**测试方法**：
```python
# 在蒸馏脚本中模拟 JWT 过期
def test_jwt_expired(credential_name: str = "distill_alice_py"):
    # 1. 修改凭证文件，使 JWT 过期
    # 2. 执行操作
    # 3. 验证 JWT 已自动刷新
```

**需要覆盖的模块**：
- [ ] setup_identity.py
- [ ] send_message.py
- [ ] check_inbox.py
- [ ] manage_group.py
- [ ] manage_relationship.py
- [ ] get_profile.py
- [ ] update_profile.py
- [ ] manage_content.py
- [ ] search_users.py
- [ ] manage_credits.py
- [ ] e2ee_messaging.py
- [ ] bind_contact.py

### 3.2 重复加入群组场景
**覆盖模块**：manage_group.py
**测试方法**：
```python
# 第一次加入
result1 = join_group(join_code="860114")
assert result1["status"] == "active"

# 第二次加入（应返回错误）
result2 = join_group(join_code="860114")
assert result2["error"]["message"] == "already an active group member"
```

### 3.3 E2EE 会话不存在场景
**覆盖模块**：e2ee_messaging.py
**测试方法**：
```python
# 清除 E2EE 会话
clear_e2ee_session(peer_did)

# 发送消息（应自动初始化会话）
result = send_encrypted(peer_did, "hello")
assert "e2ee_init" in result
```

### 3.4 邮箱验证轮询场景
**覆盖模块**：register_handle.py, bind_contact.py
**测试方法**：
```python
# 启动轮询模式
result = register_handle(handle="test", email="test@example.com", wait_for_email_verification=True)
# 等待用户点击激活链接
# 验证注册完成
```

### 3.5 监听器运行状态场景
**覆盖模块**：check_status.py, setup_realtime.py, listener_recovery.py
**测试方法**：
```python
# 停止监听器
stop_listener()

# 检查状态
status = check_status()
assert status["realtime_listener"]["running"] == False

# 自动重启
ensure_listener_runtime()
assert status["realtime_listener"]["running"] == True
```

## 4. 蒸馏脚本创建优先级

### 优先级 1（高）- 核心功能
1. **send_verification_code.py** - 验证码发送（Handle 注册前置）
2. **bind_contact.py** - 联系方式绑定（身份完善）
3. **setup_realtime.py** - 实时消息设置（核心体验）

### 优先级 2（中）- E2EE 增强
4. **e2ee_session_store.py** - E2EE 会话存储
5. **e2ee_outbox.py** - E2EE 发件箱（补充测试场景）
6. **message_transport.py** - 消息传输模式

### 优先级 3（低）- 辅助功能
7. **listener_recovery.py** - 监听器恢复
8. **message_daemon.py** - 消息守护进程

## 5. 蒸馏脚本模板

### 5.1 send_verification_code.py 模板

```python
#!/usr/bin/env python3
"""蒸馏脚本 - 提取 send_verification_code.py 的输入输出"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / 'python' / 'scripts'))

from send_verification_code import do_send
from utils import SDKConfig, create_user_service_client
import asyncio

def distill():
    results = {
        "file": "python/scripts/send_verification_code.py",
        "doc_path": "doc/scripts/send_verification_code.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    # 测试场景 1：发送验证码到手机
    test_output_1 = {"success": True, "phone": "+8613800138000"}
    results["functions"].append({
        "name": "do_send",
        "type": "async_function",
        "signature": "(phone: str) -> None",
        "tests": [{
            "input": {"phone": "+8613800138000"},
            "output": test_output_1,
            "scenario": "发送验证码到手机"
        }]
    })
    
    # 测试场景 2：CLI 参数验证
    results["functions"].append({
        "name": "main",
        "type": "function",
        "signature": "() -> None",
        "tests": [{
            "input": {"argv": ["send_verification_code.py", "--phone", "+8613800138000"]},
            "output": {"exit_code": 0},
            "scenario": "CLI 参数验证"
        }]
    })
    
    return results

if __name__ == "__main__":
    import json
    results = distill()
    print(json.dumps(results, indent=2, default=str))
```

### 5.2 bind_contact.py 模板

```python
#!/usr/bin/env python3
"""蒸馏脚本 - 提取 bind_contact.py 的输入输出"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / 'python' / 'scripts'))

from bind_contact import do_bind
from credential_store import load_identity
import asyncio

def distill():
    results = {
        "file": "python/scripts/bind_contact.py",
        "doc_path": "doc/scripts/bind_contact.py",
        "functions": [],
        "constants": {"PENDING_VERIFICATION_EXIT_CODE": 3},
        "classes": {}
    }
    
    # 测试场景 1：绑定邮箱（发送激活邮件）
    results["functions"].append({
        "name": "do_bind",
        "type": "async_function",
        "signature": "(bind_email: str | None, bind_phone: str | None, ...) -> bool",
        "tests": [{
            "input": {
                "bind_email": "user@example.com",
                "credential_name": "distill_alice_py"
            },
            "output": {"pending_verification": True},
            "scenario": "绑定邮箱（发送激活邮件）"
        }]
    })
    
    # 测试场景 2：绑定邮箱（轮询模式）
    results["functions"].append({
        "name": "do_bind",
        "type": "async_function",
        "tests": [{
            "input": {
                "bind_email": "user@example.com",
                "wait_for_email_verification": True,
                "credential_name": "distill_alice_py"
            },
            "output": {"success": True},
            "scenario": "绑定邮箱（轮询模式）"
        }]
    })
    
    # 测试场景 3：绑定手机（发送 OTP）
    results["functions"].append({
        "name": "do_bind",
        "type": "async_function",
        "tests": [{
            "input": {
                "bind_phone": "+8613800138000",
                "send_phone_otp": True,
                "credential_name": "distill_alice_py"
            },
            "output": {"otp_sent": True},
            "scenario": "绑定手机（发送 OTP）"
        }]
    })
    
    # 测试场景 4：绑定手机（验证 OTP）
    results["functions"].append({
        "name": "do_bind",
        "type": "async_function",
        "tests": [{
            "input": {
                "bind_phone": "+8613800138000",
                "otp_code": "123456",
                "credential_name": "distill_alice_py"
            },
            "output": {"success": True},
            "scenario": "绑定手机（验证 OTP）"
        }]
    })
    
    return results

if __name__ == "__main__":
    import json
    results = distill()
    print(json.dumps(results, indent=2, default=str))
```

### 5.3 setup_realtime.py 模板

```python
#!/usr/bin/env python3
"""蒸馏脚本 - 提取 setup_realtime.py 的输入输出"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / 'python' / 'scripts'))

from setup_realtime import setup_realtime
import asyncio

def distill():
    results = {
        "file": "python/scripts/setup_realtime.py",
        "doc_path": "doc/scripts/setup_realtime.py",
        "functions": [],
        "constants": {
            "RECEIVE_MODE_HTTP": "http",
            "RECEIVE_MODE_WEBSOCKET": "websocket"
        },
        "classes": {}
    }
    
    # 测试场景 1：配置 WebSocket 模式
    results["functions"].append({
        "name": "setup_realtime",
        "type": "function",
        "signature": "(mode: str = 'websocket') -> dict",
        "tests": [{
            "input": {"mode": "websocket"},
            "output": {
                "settings_updated": True,
                "openclaw_updated": True,
                "service_installed": True
            },
            "scenario": "配置 WebSocket 模式"
        }]
    })
    
    # 测试场景 2：配置 HTTP 轮询模式
    results["functions"].append({
        "name": "setup_realtime",
        "type": "function",
        "tests": [{
            "input": {"mode": "http"},
            "output": {
                "settings_updated": True,
                "openclaw_updated": True,
                "service_not_installed": True
            },
            "scenario": "配置 HTTP 轮询模式"
        }]
    })
    
    # 测试场景 3：幂等性测试（重复运行）
    results["functions"].append({
        "name": "setup_realtime",
        "type": "function",
        "tests": [{
            "input": {"mode": "websocket", "rerun": True},
            "output": {
                "settings_merged": True,
                "no_overwrite": True
            },
            "scenario": "幂等性测试（重复运行）"
        }]
    })
    
    return results

if __name__ == "__main__":
    import json
    results = distill()
    print(json.dumps(results, indent=2, default=str))
```

## 6. 下一步行动

1. **创建缺失的蒸馏脚本**（优先级 1）
   - [ ] doc/scripts/send_verification_code.py/distill.py
   - [ ] doc/scripts/bind_contact.py/distill.py
   - [ ] doc/scripts/setup_realtime.py/distill.py

2. **补充现有蒸馏脚本的测试场景**（优先级 2）
   - [ ] check_status.py - 添加 JWT 过期、E2EE 自动处理、群组消息分类
   - [ ] manage_group.py - 添加重复加入、群组类型、成员事件
   - [ ] e2ee_messaging.py - 添加自动会话初始化、发件箱
   - [ ] utils/handle.py - 添加绑定 API

3. **创建剩余蒸馏脚本**（优先级 3）
   - [ ] doc/scripts/e2ee_session_store.py/distill.py
   - [ ] doc/scripts/message_transport.py/distill.py
   - [ ] doc/scripts/listener_recovery.py/distill.py
   - [ ] doc/scripts/message_daemon.py/distill.py
