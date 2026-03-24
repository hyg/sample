# 蒸馏脚本覆盖矩阵

## 1. 脚本文件覆盖状态

| # | 脚本文件 | 文件夹创建 | distill.py | 覆盖场景 | 状态 |
|---|----------|-----------|------------|----------|------|
| 1 | bind_contact.py | ✅ | ✅ 已创建 | 6.2.5 联系方式绑定 | 🟢 完成 |
| 2 | send_verification_code.py | ✅ | ✅ 已创建 | 5.7 手工测试 | 🟢 完成 |
| 3 | setup_realtime.py | ✅ | ✅ 已创建 | 6.2.1 实时消息设置 | 🟢 完成 |
| 4 | e2ee_session_store.py | ✅ | ✅ 已创建 | 6.2.3 E2EE 失败重试 | 🟢 完成 |
| 5 | e2ee_outbox.py | ✅ | ✅ 已存在 | 6.2.3 E2EE 失败重试 | 🟢 完成 |
| 6 | listener_recovery.py | ✅ | ✅ 已创建 | 6.2.2 心跳检查 | 🟢 完成 |
| 7 | message_daemon.py | ✅ | ✅ 已创建 | 6.2.1 实时消息设置 | 🟢 完成 |
| 8 | message_transport.py | ✅ | ✅ 已创建 | 6.2.1 实时消息设置 | 🟢 完成 |

**新增模块蒸馏脚本覆盖率：8/8 = 100%** ✅

## 2. 旧模块新增功能覆盖

### 2.1 需要补充测试场景的模块

| 模块 | 缺失场景 | 优先级 | 备注 |
|------|---------|--------|------|
| check_status.py | JWT 过期、E2EE 自动处理、群组消息分类、监听器状态 | 🔴 高 | 核心巡检功能 |
| manage_group.py | 重复加入、群组类型、成员事件、加入码管理 | 🔴 高 | 群组核心功能 |
| e2ee_messaging.py | 自动会话初始化、发件箱、重试/丢弃 | 🔴 高 | E2EE 核心功能 |
| register_handle.py | 邮箱注册、轮询模式、短 Handle 邀请码 | 🟡 中 | Handle 注册完善 |
| utils/handle.py | 绑定 API（bind_email_send, bind_phone_*） | 🟡 中 | 新增绑定功能 |
| recover_handle.py | 与 send_verification_code.py 配合 | 🟡 中 | 流程完善 |

### 2.2 已覆盖的模块

| 模块 | 覆盖场景 | 状态 |
|------|---------|------|
| setup_identity.py | 身份创建、加载、JWT 刷新 | 🟢 完成 |
| send_message.py | 明文发送、Handle 解析 | 🟢 完成 |
| check_inbox.py | 收件箱、历史、标记已读 | 🟢 完成 |
| manage_content.py | 页面 CRUD | 🟢 完成 |
| search_users.py | 用户搜索 | 🟢 完成 |
| get_profile.py | Profile 获取 | 🟢 完成 |
| update_profile.py | Profile 更新 | 🟢 完成 |
| manage_relationship.py | 关注/取消关注 | 🟢 完成 |
| manage_contacts.py | 联系人管理 | 🟢 完成 |
| query_db.py | 数据库查询 | 🟢 完成 |
| manage_credits.py | 积分查询 | 🟢 完成 |
| ws_listener.py | WebSocket 监听 | 🟢 完成 |
| e2ee_handler.py | E2EE 处理 | 🟢 完成 |
| e2ee_store.py | E2EE 状态存储 | 🟢 完成 |
| listener_config.py | 监听器配置 | 🟢 完成 |
| service_manager.py | 服务管理 | 🟢 完成 |
| credential_store.py | 凭证存储 | 🟢 完成 |
| local_store.py | 本地存储 | 🟢 完成 |
| database_migration.py | 数据库迁移 | 🟢 完成 |
| credential_layout.py | 凭证布局 | 🟢 完成 |
| credential_migration.py | 凭证迁移 | 🟢 完成 |
| migrate_credentials.py | 凭证迁移 CLI | 🟢 完成 |
| migrate_local_database.py | 数据库迁移 CLI | 🟢 完成 |
| regenerate_e2ee_keys.py | E2EE 密钥重新生成 | 🟢 完成 |

## 3. 特殊测试条件覆盖

### 3.1 JWT 过期场景

**覆盖状态**：🟡 部分覆盖

**需要覆盖的模块**：
- [x] setup_identity.py - 已覆盖
- [ ] send_message.py - 需补充
- [ ] check_inbox.py - 需补充
- [ ] manage_group.py - 需补充
- [ ] manage_relationship.py - 需补充
- [ ] get_profile.py - 需补充
- [ ] update_profile.py - 需补充
- [ ] manage_content.py - 需补充
- [ ] search_users.py - 需补充
- [ ] manage_credits.py - 需补充
- [ ] e2ee_messaging.py - 需补充
- [ ] bind_contact.py - 需补充

**蒸馏脚本模板**：
```python
def test_jwt_expired(credential_name: str = "distill_alice_py"):
    """测试 JWT 过期自动刷新"""
    input_args = {"credential_name": credential_name, "jwt_expired": True}
    output_data = {"loaded": False, "jwt_refreshed": False}
    
    # 1. 修改凭证文件，使 JWT 过期
    # 2. 执行操作（如 load_saved_identity）
    # 3. 验证 JWT 已自动刷新
    return record_result("jwt_expired", input_args, output_data, success)
```

### 3.2 重复加入群组场景

**覆盖状态**：🔴 未覆盖

**需要覆盖的模块**：
- [ ] manage_group.py

**蒸馏脚本模板**：
```python
def test_join_group_twice():
    """测试重复加入群组"""
    # 第一次加入
    result1 = join_group(join_code="860114")
    assert result1["status"] == "active"
    
    # 第二次加入（应返回错误）
    result2 = join_group(join_code="860114")
    assert result2["error"]["message"] == "already an active group member"
    
    return record_result("join_twice", input_args, output_data, success)
```

### 3.3 E2EE 会话不存在场景

**覆盖状态**：🔴 未覆盖

**需要覆盖的模块**：
- [ ] e2ee_messaging.py
- [ ] e2ee_session_store.py

**蒸馏脚本模板**：
```python
def test_e2ee_auto_init():
    """测试 E2EE 自动会话初始化"""
    # 清除 E2EE 会话
    clear_e2ee_session(peer_did)
    
    # 发送消息（应自动初始化会话）
    result = send_encrypted(peer_did, "hello")
    assert "e2ee_init" in result
    
    return record_result("e2ee_auto_init", input_args, output_data, success)
```

### 3.4 邮箱验证轮询场景

**覆盖状态**：🟡 部分覆盖

**需要覆盖的模块**：
- [x] bind_contact.py - 已覆盖
- [ ] register_handle.py - 需补充

**蒸馏脚本模板**：
```python
def test_email_polling():
    """测试邮箱验证轮询模式"""
    # 启动轮询模式
    result = register_handle(
        handle="test",
        email="test@example.com",
        wait_for_email_verification=True
    )
    # 等待用户点击激活链接（模拟）
    # 验证注册完成
    assert result["success"] == True
    
    return record_result("email_polling", input_args, output_data, success)
```

### 3.5 监听器运行状态场景

**覆盖状态**：🔴 未覆盖

**需要覆盖的模块**：
- [ ] check_status.py
- [ ] setup_realtime.py
- [ ] listener_recovery.py

**蒸馏脚本模板**：
```python
def test_listener_status():
    """测试监听器运行状态检查"""
    # 停止监听器
    stop_listener()
    
    # 检查状态
    status = check_status()
    assert status["realtime_listener"]["running"] == False
    
    # 自动重启
    ensure_listener_runtime()
    assert status["realtime_listener"]["running"] == True
    
    return record_result("listener_status", input_args, output_data, success)
```

## 4. 蒸馏脚本创建清单

### 4.1 高优先级（核心功能）

- [x] send_verification_code.py - ✅ 已完成
- [x] bind_contact.py - ✅ 已完成
- [x] setup_realtime.py - ✅ 已完成
- [ ] check_status.py - 补充 JWT 过期、E2EE、群组消息分类
- [ ] manage_group.py - 补充重复加入、群组类型
- [ ] e2ee_messaging.py - 补充自动会话初始化、发件箱

### 4.2 中优先级（E2EE 增强）

- [ ] e2ee_session_store.py - 新建
- [ ] e2ee_outbox.py - 补充重试/丢弃场景
- [ ] message_transport.py - 新建
- [ ] utils/handle.py - 补充绑定 API

### 4.3 低优先级（辅助功能）

- [ ] listener_recovery.py - 新建
- [ ] message_daemon.py - 新建
- [ ] register_handle.py - 补充邮箱注册
- [ ] recover_handle.py - 补充配合流程

## 5. 下一步行动

### 5.1 立即执行

1. **补充 check_status.py 蒸馏脚本**
   - 添加 JWT 过期测试场景
   - 添加 E2EE 自动处理测试
   - 添加群组消息分类测试
   - 添加监听器状态检查

2. **补充 manage_group.py 蒸馏脚本**
   - 添加重复加入测试
   - 添加无限群组/发现式群组测试
   - 添加成员事件分类测试

3. **补充 e2ee_messaging.py 蒸馏脚本**
   - 添加自动会话初始化测试
   - 添加发件箱查询测试
   - 添加重试/丢弃测试

### 5.2 本周执行

4. **创建 e2ee_session_store.py 蒸馏脚本**
5. **创建 message_transport.py 蒸馏脚本**
6. **创建 listener_recovery.py 蒸馏脚本**
7. **创建 message_daemon.py 蒸馏脚本**

### 5.3 下周执行

8. **补充 utils/handle.py 绑定 API 测试**
9. **补充 register_handle.py 邮箱注册测试**
10. **补充所有模块的 JWT 过期测试**

## 6. 质量检查清单

### 6.1 蒸馏脚本质量

- [ ] 每个函数都有测试场景
- [ ] 包含正常流程和错误处理
- [ ] 包含边界条件测试
- [ ] 包含特殊测试条件（JWT 过期、重复操作等）
- [ ] 输入输出可序列化（JSON）
- [ ] 测试场景有明确描述

### 6.2 测试场景覆盖

- [ ] 所有新增模块都有蒸馏脚本
- [ ] 所有旧模块的新增功能都有测试
- [ ] 所有特殊测试条件都有覆盖
- [ ] 所有手工测试场景都有记录

### 6.3 文档同步

- [ ] skill.js.md 已更新
- [ ] cli.md 已更新
- [ ] web.md 已更新
- [ ] skill.py.md 已更新
- [ ] DISTILLATION_CHECKLIST.md 已创建
- [ ] 本覆盖矩阵已创建
