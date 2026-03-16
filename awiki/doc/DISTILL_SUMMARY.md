# Module 项目测试数据蒸馏总结

## 1. 概述

本文档总结为 Module 项目所有 util 模块和 lib 依赖库蒸馏的测试数据。

**蒸馏日期**: 2026-03-16  
**数据来源**: Python 源文件 (`python/scripts/utils/*`)  
**测试数据格式**: JSON (distill.json)

---

## 2. 测试数据总览

### 2.1 Util 模块

| 模块 | 测试用例数 | 覆盖场景 | 数据文件 |
|------|-----------|---------|---------|
| auth | 25 | 6 | [util/auth/distill.json](util/auth/distill.json) |
| client | 15 | 4 | [util/client/distill.json](util/client/distill.json) |
| config | 12 | 4 | [util/config/distill.json](util/config/distill.json) |
| e2ee | 44 | 7 | [util/e2ee/distill.json](util/e2ee/distill.json) |
| handle | 36 | 7 | [util/handle/distill.json](util/handle/distill.json) |
| identity | 20 | 4 | [util/identity/distill.json](util/identity/distill.json) |
| logging_config | 50 | 6 | [util/logging_config/distill.json](util/logging_config/distill.json) |
| resolve | 18 | 6 | [util/resolve/distill.json](util/resolve/distill.json) |
| rpc | 15 | 8 | [util/rpc/distill.json](util/rpc/distill.json) |
| ws | 30 | 8 | [util/ws/distill.json](util/ws/distill.json) |
| **总计** | **265** | **60** | - |

### 2.2 Lib 依赖库

| 依赖库 | 测试用例数 | 覆盖功能 | 数据文件 |
|--------|-----------|---------|---------|
| anp-0.6.8 | 14 | 10 | [lib/anp-0.6.8/distill.json](lib/anp-0.6.8/distill.json) |
| httpx-0.28.0 | 35 | 7 | [lib/httpx-0.28.0/distill.json](lib/httpx-0.28.0/distill.json) |
| websockets-16.0 | 24 | 5 | [lib/websockets-16.0/distill.json](lib/websockets-16.0/distill.json) |
| **总计** | **73** | **22** | - |

---

## 3. 详细测试数据

### 3.1 Auth 模块 (25 个用例)

**文件**: `util/auth/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| DID WBA 认证头生成 | 4 | `generate_wba_auth_header` |
| DID 注册 | 5 | `register_did` |
| DID 文档更新 | 5 | `update_did_document` |
| JWT 获取 | 4 | `get_jwt_via_wba` |
| 一站式身份创建 | 5 | `create_authenticated_identity` |
| 签名回调 | 2 | `_secp256k1_sign_callback` |

### 3.2 Client 模块 (15 个用例)

**文件**: `util/client/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| TLS 验证配置 | 7 | `_resolve_verify` |
| user-service 客户端 | 3 | `create_user_service_client` |
| molt-message 客户端 | 3 | `create_molt_message_client` |
| 客户端独立性 | 2 | - |

### 3.3 Config 模块 (12 个用例)

**文件**: `util/config/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| 凭证目录解析 | 1 | `_default_credentials_dir` |
| 数据目录解析 | 3 | `_default_data_dir` |
| SDK 配置加载 | 6 | `SDKConfig.load` |
| 环境变量覆盖 | 2 | - |

### 3.4 E2EE 模块 (44 个用例)

**文件**: `util/e2ee/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| E2EE 会话初始化 | 6 | `initiate_handshake`, `_handle_init` |
| 消息加密/解密 | 5 | `encrypt_message`, `decrypt_message` |
| 会话状态管理 | 10 | `has_active_session`, `ensure_active_session` |
| 状态持久化 | 5 | `export_state`, `from_state` |
| 错误处理 | 10 | `ensure_supported_e2ee_version`, `_classify_protocol_error` |
| 消息处理流程 | 7 | `process_e2ee_message` |
| 兼容性处理 | 3 | `_extract_proof_verification_method` |

### 3.5 Handle 模块 (36 个用例)

**文件**: `util/handle/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| 电话号码格式化 | 11 | `normalize_phone` |
| OTP 代码清理 | 5 | `_sanitize_otp` |
| OTP 发送 | 3 | `send_otp` |
| Handle 注册 | 5 | `register_handle` |
| Handle 恢复 | 2 | `recover_handle` |
| Handle 解析 | 2 | `resolve_handle` |
| Handle 查找 | 2 | `lookup_handle` |

### 3.6 Identity 模块 (20 个用例)

**文件**: `util/identity/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| DID 身份创建 | 13 | `create_identity` |
| 密钥对生成 | 2 | - |
| DID 文档生成 | 2 | - |
| 私钥加载 | 3 | `load_private_key` |

### 3.7 Logging Config 模块 (50 个用例)

**文件**: `util/logging_config/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| 日志目录管理 | 3 | `get_log_dir` |
| 日志文件路径 | 8 | `get_log_file_path` |
| 日志文件列表 | 4 | `_list_managed_log_files` |
| 日志清理 | 8 | `cleanup_log_files` |
| 每日文件处理器 | 13 | `DailyRetentionFileHandler` |
| 日志配置 | 14 | `configure_logging` |

### 3.8 Resolve 模块 (18 个用例)

**文件**: `util/resolve/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| DID 直接返回 | 3 | `resolve_to_did` |
| Handle 解析 | 1 | `resolve_to_did` |
| 域名后缀处理 | 4 | `resolve_to_did` |
| 错误处理 | 7 | `resolve_to_did` |
| 配置处理 | 1 | `resolve_to_did` |
| 边界情况 | 2 | `resolve_to_did` |

### 3.9 RPC 模块 (15 个用例)

**文件**: `util/rpc/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| JSON-RPC 基础调用 | 5 | `rpc_call` |
| JsonRpcError 异常 | 2 | - |
| 认证 RPC 调用 | 8 | `authenticated_rpc_call` |

### 3.10 WS 模块 (30 个用例)

**文件**: `util/ws/distill.json`

| 业务场景 | 用例数 | 核心函数 |
|----------|--------|---------|
| WebSocket 连接 | 5 | `connect` |
| 连接管理 | 3 | `close`, `__aenter__`, `__aexit__` |
| JSON-RPC 请求 | 5 | `send_rpc` |
| 消息发送 | 7 | `send_message` |
| 心跳检测 | 2 | `ping` |
| 消息接收 | 3 | `receive`, `receive_notification` |
| 推送通知 | 4 | `receive_notification` |
| 综合场景 | 1 | - |

---

## 4. Lib 依赖库测试数据

### 4.1 ANP 库 (14 个用例)

**文件**: `lib/anp-0.6.8/distill.json`

| 模块 | 功能 | 用例数 |
|------|------|--------|
| authentication | `generate_auth_header` | 1 |
| authentication | `create_did_wba_document_with_key_binding` | 2 |
| authentication | `resolve_did_wba_document` | 1 |
| e2e_encryption_hpke | `E2eeHpkeSession` | 5 |
| e2e_encryption_hpke | `HpkeKeyManager` | 2 |
| e2e_encryption_hpke | `generate_proof` | 1 |
| e2e_encryption_hpke | `validate_proof` | 1 |
| e2e_encryption_hpke | `detect_message_type` | 1 |

### 4.2 Httpx 库 (35 个用例)

**文件**: `lib/httpx-0.28.0/distill.json`

| 功能类别 | 用例数 |
|----------|--------|
| AsyncClient 创建 | 4 |
| TLS 配置 | 3 |
| POST 请求 | 15 |
| GET 请求 | 6 |
| 错误处理 | 8 |
| 认证场景 | 6 |
| 业务场景 | 10 |

### 4.3 Websockets 库 (24 个用例)

**文件**: `lib/websockets-16.0/distill.json`

| 功能 | 用例数 |
|------|--------|
| 连接建立 | 6 |
| 发送消息 | 9 |
| 接收消息 | 5 |
| 心跳检测 | 2 |
| 连接关闭 | 2 |

---

## 5. 测试数据特点

### 5.1 数据格式

每个 distill.json 包含：
```json
{
  "module": "模块名",
  "sourceFile": "Python 源文件路径",
  "testCases": [
    {
      "id": "唯一 ID",
      "name": "测试用例名称",
      "description": "场景描述",
      "function": "函数名",
      "input": { "参数": "值" },
      "expectedOutput": { "预期输出" },
      "expectedError": null,
      "category": "unit|integration|scenario"
    }
  ]
}
```

### 5.2 测试用例分类

| 分类 | 数量 | 说明 |
|------|------|------|
| 单元测试 (unit) | ~150 | 单个函数测试 |
| 集成测试 (integration) | ~70 | 多函数协作 |
| 场景测试 (scenario) | ~45 | 完整业务场景 |
| 错误测试 | ~73 | 异常和边界条件 |

### 5.3 覆盖的测试类型

- ✅ 正常流程测试
- ✅ 边界值测试
- ✅ 错误处理测试
- ✅ 异常场景测试
- ✅ 配置选项测试
- ✅ 并发/竞态条件测试

---

## 6. 使用指南

### 6.1 加载测试数据

```javascript
const fs = require('fs');
const path = require('path');

// 加载 e2ee 模块测试数据
const e2eeTests = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'util/e2ee/distill.json'), 'utf-8')
);

// 遍历测试用例
e2eeTests.testCases.forEach(tc => {
    console.log(`Running ${tc.name}: ${tc.description}`);
    // 执行测试...
});
```

### 6.2 生成测试代码

```javascript
// 根据 distill.json 自动生成 Jest 测试
e2eeTests.testCases.forEach(tc => {
    test(tc.name, async () => {
        const result = await module[tc.function](...Object.values(tc.input));
        if (tc.expectedError) {
            expect(result).toThrow(tc.expectedError);
        } else {
            expect(result).toEqual(tc.expectedOutput);
        }
    });
});
```

---

## 7. 统计汇总

| 项目 | 数量 |
|------|------|
| **总测试用例数** | **338** |
| Util 模块测试 | 265 |
| Lib 依赖库测试 | 73 |
| 覆盖的 Python 文件 | 13 |
| 覆盖的业务场景 | 82 |

---

## 8. 下一步行动

1. **验证测试数据**: 在 Python 环境中执行部分测试用例，验证输入输出正确性
2. **生成测试代码**: 根据 distill.json 自动生成 Jest 测试代码
3. **补充边界用例**: 根据测试执行情况补充边界条件
4. **持续更新**: 代码变更时同步更新测试数据

---

**蒸馏完成**: ✅  
**可以开始测试开发**: ✅
