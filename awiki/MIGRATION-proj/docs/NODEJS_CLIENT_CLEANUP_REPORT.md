# nodejs-client 清理报告

**日期**: 2026-03-08
**状态**: 第一阶段完成（文件移动）

---

## 清理摘要

### 已移动的文件

#### 1. 测试文件 (77 个文件)
**源**: `nodejs-client/tests/`
**目标**: `MIGRATION-proj/nodejs-work/tests/`

包括：
- `*.test.js` - 单元测试文件
- `capture_*.js` - 捕获测试
- `check_*.js` - 验证测试
- `debug_*.js` - 调试测试
- `test_*.js` - 功能测试
- `verify_*.js` - 验证测试
- JSON 结果文件

#### 2. 脚本测试文件 (6 个文件)
**源**: `nodejs-client/scripts/`
**目标**: `MIGRATION-proj/nodejs-work/tests/`

- `complete_message_test.js`
- `cross_platform_message_test.js`
- `final_cross_platform_test.js`
- `multi_round_ratchet_test.js`
- `send_receive_decrypt_test.js`
- `simple_cross_test.js`

#### 3. 测试结果 (5 个文件)
**源**: `nodejs-client/scripts/`
**目标**: `MIGRATION-proj/nodejs-work/outputs/`

- `complete_message_test_results.json`
- `final_cross_platform_results.json`
- `message_test_results.json`
- `nodejs_multi_round_ratchet_results.json`
- `send_receive_decrypt_results.json`

#### 4. 测试凭证 (4 个文件)
**源**: `nodejs-client/.credentials/`
**目标**: `MIGRATION-proj/nodejs-work/.credentials/`

- `nodeagentfixed.json`
- `nodetest1.json`
- `node_test_base.json`
- `testnodefix9_private_key.pem`

#### 5. E2EE 测试数据 (1 个文件)
**源**: `nodejs-client/.e2ee_store/`
**目标**: `MIGRATION-proj/nodejs-work/.e2ee_store/`

- `nodetest1.json`

#### 6. 开发文档 (10 个文件)
**源**: `nodejs-client/`
**目标**: `MIGRATION-proj/docs/`

- `AI_CODE_SUMMARY.md`
- `AI_DISCLOSURE.md`
- `AUTH_GUIDE.md`
- `JWT_GUIDE.md`
- `LICENSE_AND_PUBLISHING.md`
- `PROJECT_LICENSE_SUMMARY.md`
- `PYTHON_NODEJS_COMPARISON.md`
- `PYTHON_NODEJS_DIFF.md`
- `RELEASE_CHECKLIST.md`
- `RELEASE_NOTES.md`

#### 7. 测试脚本 (43 个文件)
**源**: `nodejs-client/`
**目标**: `MIGRATION-proj/nodejs-work/scripts/`

- `*.mjs` (41 个文件)
- `debug_*.js` (2 个文件)

---

## 清理后的目录结构

```
nodejs-client/
├── bin/                        # CLI 工具（保留）
├── lib/                        # 新增：核心库
│   └── anp/                    # 新增：ANP 实现
│       ├── authentication/
│       ├── e2e_encryption_hpke/
│       ├── proof/
│       └── utils/
├── scripts/                    # 功能脚本（保留，已清理测试文件）
│   ├── check_inbox.js
│   ├── e2ee_messaging.js
│   ├── get_profile.js
│   ├── manage_content.js
│   ├── manage_group.js
│   ├── manage_relationship.js
│   ├── register_handle.js
│   ├── send_message.js
│   ├── setup_identity.js
│   ├── update_profile.js
│   └── ws_listener.js
├── src/                        # 待迁移到 lib/anp/
│   ├── utils/
│   └── *.js
├── node_modules/               # npm 依赖（保留）
├── LICENSE                     # 许可证（保留）
├── NOTICE.md                   # 第三方许可（保留）
├── package.json                # npm 配置（保留）
├── package-lock.json           # npm 锁定（保留）
├── README.md                   # npm 包说明（保留，已更新）
└── USAGE.md                    # 使用指南（保留）
```

---

## 下一步工作

### 1. 重组 src/ 到 lib/anp/

需要移动的文件：

| 源文件 | 目标文件 |
|--------|---------|
| `src/hpke.js` | `lib/anp/e2e_encryption_hpke/hpke.js` |
| `src/ratchet.js` | `lib/anp/e2e_encryption_hpke/ratchet.js` |
| `src/w3c_proof.js` | `lib/anp/proof/proof.js` |
| `src/e2ee.js` | `lib/anp/e2e_encryption_hpke/__init__.js` |
| `src/e2ee_session.js` | `lib/anp/e2e_encryption_hpke/session.js` |
| `src/e2ee_key_manager.js` | `lib/anp/e2e_encryption_hpke/key_manager.js` |
| `src/e2ee_proof.js` | `lib/anp/e2e_encryption_hpke/message_builder.js` |
| `src/e2ee_outbox.js` | `lib/anp/e2e_encryption_hpke/e2ee_outbox.js` |
| `src/e2ee_store.js` | `scripts/utils/e2ee_store.js` |
| `src/credential_store.js` | `scripts/utils/credential_store.js` |
| `src/ws_client.js` | `scripts/utils/ws.js` |
| `src/utils/config.js` | `scripts/utils/config.js` |
| `src/utils/identity.js` | `scripts/utils/identity.js` |
| `src/utils/auth.js` | `scripts/utils/auth.js` |
| `src/utils/client.js` | `scripts/utils/client.js` |
| `src/utils/rpc.js` | `scripts/utils/rpc.js` |
| `src/utils/resolve.js` | `scripts/utils/resolve.js` |

### 2. 新增缺失的脚本

需要新增的脚本（与 Python 对应）：

- `scripts/check_status.js`
- `scripts/resolve_handle.js`
- `scripts/e2ee_handler.js`
- `scripts/e2ee_outbox.js`
- `scripts/query_db.js`
- `scripts/service_manager.js`
- `scripts/regenerate_e2ee_keys.js`
- `scripts/listener_config.js`
- `scripts/utils/handle.js`

### 3. 创建 __init__.js 文件

为每个 lib/anp 子模块创建导出文件：

- `lib/anp/__init__.js`
- `lib/anp/authentication/__init__.js`
- `lib/anp/e2e_encryption_hpke/__init__.js`
- `lib/anp/proof/__init__.js`
- `lib/anp/utils/__init__.js`

### 4. 更新 package.json

- 修改包名为 `nodejs-awiki`
- 更新 bin 字段指向新的脚本路径
- 更新 main 字段指向 `lib/anp/__init__.js`

### 5. 创建 SKILL.md 套装

- `SKILL.md` (主文件)
- `SKILL-DID.md`
- `SKILL-PROFILE.md`
- `SKILL-MESSAGE.md`
- `SKILL-SOCIAL.md`
- `SKILL-GROUP.md`
- `SKILL-CONTENT.md`

---

## 统计

| 类别 | 数量 |
|------|------|
| 移动测试文件 | 77 |
| 移动脚本测试 | 6 |
| 移动测试结果 | 5 |
| 移动测试凭证 | 4 |
| 移动 E2EE 数据 | 1 |
| 移动开发文档 | 10 |
| 移动测试脚本 | 43 |
| **总计移动** | **146** |

---

**清理人**: AI Assistant
**清理日期**: 2026-03-08
**状态**: 第一阶段完成，等待下一步指令
