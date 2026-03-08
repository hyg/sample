# python-client 更新日志

## 2026-03-08

### 来源信息
- **来源**: https://awiki.info/static-files/awiki-agent-id-message.zip
- **版本**: 1.0.0 (从 pyproject.toml 获取)
- **包名**: awiki-did (原 awiki-agent-id-message)
- **依赖**: anp>=0.6.8, httpx>=0.28.0, websockets>=14.0

### 主要变更

#### 1. 项目结构重构

**旧结构**:
```
python-client/
├── anp_src/              # ANP 库源代码（内嵌）
│   └── anp_package/
├── scripts/
│   └── ...
```

**新结构**:
```
python-client/
├── scripts/              # 主要脚本代码
│   ├── utils/           # 工具模块
│   └── ...
├── service/              # 服务配置
├── references/           # 参考文档
└── tests/               # 测试文件
```

#### 2. 依赖管理变更

- **旧方式**: 内嵌 anp_src 源代码
- **新方式**: 使用外部 `anp>=0.6.8` 包（通过 pip 安装）

#### 3. 核心模块对比

| 功能 | 旧模块位置 | 新模块位置 | 状态 |
|------|-----------|-----------|------|
| DID 创建 | `anp_src/anp_package/authentication/did_wba.py` | `scripts/utils/identity.py` (封装 ANP) | ✅ 保留 |
| 认证 | `anp_src/anp_package/authentication/did_wba_authenticator.py` | `scripts/utils/auth.py` | ✅ 保留 |
| E2EE | `anp_src/anp_package/e2e_encryption_hpke/` | `scripts/utils/e2ee.py` (封装 ANP) | ✅ 保留 |
| W3C Proof | `anp_src/anp_package/proof/proof.py` | (由 ANP 包提供) | ⚠️ 外部化 |
| HPKE | `anp_src/anp_package/e2e_encryption_hpke/hpke.py` | (由 ANP 包提供) | ⚠️ 外部化 |

#### 4. 新增文件

- `pyproject.toml` - 现代 Python 项目配置
- `requirements.txt` - 依赖列表
- `install_dependencies.py` - 依赖安装脚本
- `references/` - 参考文档目录
  - `e2ee-protocol.md` - E2EE 协议规范
  - `HEARTBEAT.md` - 心跳机制
  - `local-store-schema.md` - 本地存储结构
  - `PROFILE_TEMPLATE.md` - 个人资料模板
  - `RULES.md` - 开发规则
  - `WEBSOCKET_LISTENER.md` - WebSocket 监听器

#### 5. 脚本文件更新

**保留的脚本**:
- `setup_identity.py` - 身份创建
- `send_message.py` - 发送消息
- `check_inbox.py` - 查看收件箱
- `get_profile.py` - 获取资料
- `update_profile.py` - 更新资料
- `register_handle.py` - 注册 Handle
- `resolve_handle.py` - 解析 Handle
- `manage_relationship.py` - 管理关系
- `manage_group.py` - 管理群组
- `manage_content.py` - 管理内容
- `e2ee_messaging.py` - E2EE 消息
- `ws_listener.py` - WebSocket 监听

**新增的脚本**:
- `e2ee_outbox.py` - E2EE 发件箱
- `regenerate_e2ee_keys.py` - 重新生成 E2EE 密钥
- `query_db.py` - 数据库查询
- `service_manager.py` - 服务管理
- `listener_config.py` - 监听器配置
- `local_store.py` - 本地存储管理

### 对 Node.js 客户端的影响

#### 高优先级影响

1. **ANP 包外部化**
   - Node.js 没有对应的 `anp` 包
   - 需要确认 Node.js 实现的完整性
   - 建议：对比 ANP 包 API 与 Node.js 实现

2. **E2EE 协议更新**
   - 新版本使用 `SUPPORTED_E2EE_VERSION = "1.1"`
   - 需要验证 Node.js 是否支持相同版本
   - 检查点：`e2ee.js` 中的版本常量

3. **错误处理格式**
   - 新增 `build_e2ee_error_message()` 函数
   - 标准化错误消息格式
   - 需要更新 Node.js 错误处理

#### 中优先级影响

4. **脚本组织变化**
   - `utils/` 目录模块化
   - Node.js 可参考相同组织方式

5. **文档更新**
   - `references/` 目录包含重要协议文档
   - 需要阅读并同步到 Node.js 文档

### 下一步行动

1. **阅读 ANP 包文档** - 了解外部包的 API
2. **对比 E2EE 实现** - 确保版本兼容
3. **测试互操作性** - Python ↔ Node.js 消息互通
4. **更新 Node.js 文档** - 基于新参考文档

---

## 更新前备份

- **备份位置**: `python-client.backup.20260308/`
- **备份时间**: 2026-03-08
- **备份原因**: 保留旧版本用于对比分析

---

**记录人**: AI Assistant
**记录日期**: 2026-03-08
