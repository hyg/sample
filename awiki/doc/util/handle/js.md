# handle 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/handle.py`  
**JavaScript 目标文件**: `module/src/handle.js`  
**功能**: Handle 注册、恢复和解析

---

## 2. 接口设计

### 2.1 常量

```javascript
const HANDLE_RPC = '/user-service/handle/rpc';
const DID_AUTH_RPC = '/user-service/did-auth/rpc';
const DEFAULT_COUNTRY_CODE = '+86';
```

### 2.2 `normalizePhone` 函数

```javascript
/**
 * 标准化电话号码为国际格式
 * @param {string} phone - 电话号码
 * @returns {string} 国际格式电话号码
 */
function normalizePhone(phone) {
    phone = phone.trim();

    // 已是国际格式
    if (phone.startsWith('+')) {
        if (/^\+\d{1,3}\d{6,14}$/.test(phone)) {
            return phone;
        }
        throw new Error(`Invalid international phone: ${phone}`);
    }

    // 中国本地格式
    if (/^1[3-9]\d{9}$/.test(phone)) {
        return `${DEFAULT_COUNTRY_CODE}${phone}`;
    }

    throw new Error(`Invalid phone number: ${phone}. Use +{country_code}{number}`);
}
```

### 2.3 `sanitizeOtp` 函数

```javascript
/**
 * 清理 OTP 验证码（移除空白）
 * @param {string} code - OTP 验证码
 * @returns {string}
 */
function sanitizeOtp(code) {
    return code.replace(/\s+/g, '');
}
```

### 2.4 `sendOtp` 函数

```javascript
/**
 * 发送 OTP 验证码
 * @param {AsyncClient} client - HTTP 客户端
 * @param {string} phone - 电话号码
 * @returns {Promise<Object>}
 */
async function sendOtp(client, phone) {
    const normalized = normalizePhone(phone);
    try {
        return await rpcCall(client, HANDLE_RPC, 'send_otp', { phone: normalized });
    } catch (error) {
        if (error instanceof JsonRpcError) {
            throw new JsonRpcError(
                error.code,
                `${error.message}. Please verify phone number and country code.`,
                error.data
            );
        }
        throw error;
    }
}
```

### 2.5 `registerHandle` 函数

```javascript
/**
 * 注册 Handle
 * @param {AsyncClient} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {string} phone - 电话号码
 * @param {string} otpCode - OTP 验证码
 * @param {string} handle - Handle 名称
 * @param {Object} options - 选项
 * @returns {Promise<DIDIdentity>}
 */
async function registerHandle(client, config, phone, otpCode, handle, options = {}) {
    const {
        inviteCode = null,
        name = null,
        isPublic = false,
        services = null,
    } = options;

    const normalized = normalizePhone(phone);

    // 1. 创建带 Handle 前缀的 DID
    const identity = createIdentity({
        hostname: config.didDomain,
        pathPrefix: [handle],
        proofPurpose: 'authentication',
        domain: config.didDomain,
        services,
    });

    // 2. 注册 DID
    const payload = {
        did_document: identity.didDocument,
        handle,
        phone: normalized,
        otp_code: sanitizeOtp(otpCode),
    };

    if (inviteCode !== null) payload.invite_code = inviteCode;
    if (name !== null) payload.name = name;
    if (isPublic) payload.is_public = true;

    const regResult = await rpcCall(client, DID_AUTH_RPC, 'register', payload);
    identity.userId = regResult.user_id;

    // 3. 获取 JWT
    if (regResult.access_token) {
        identity.jwtToken = regResult.access_token;
    } else {
        identity.jwtToken = await getJwtViaWba(client, identity, config.didDomain);
    }

    return identity;
}
```

### 2.6 `recoverHandle` 函数

```javascript
/**
 * 恢复 Handle
 * @param {AsyncClient} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {string} phone - 电话号码
 * @param {string} otpCode - OTP 验证码
 * @param {string} handle - Handle 名称
 * @param {Object} options - 选项
 * @returns {Promise<[DIDIdentity, Object]>}
 */
async function recoverHandle(client, config, phone, otpCode, handle, options = {}) {
    const { services = null } = options;
    const normalized = normalizePhone(phone);

    const identity = createIdentity({
        hostname: config.didDomain,
        pathPrefix: [handle],
        proofPurpose: 'authentication',
        domain: config.didDomain,
        services,
    });

    const payload = {
        did_document: identity.didDocument,
        handle,
        phone: normalized,
        otp_code: sanitizeOtp(otpCode),
    };

    const recoverResult = await rpcCall(client, DID_AUTH_RPC, 'recover_handle', payload);
    identity.userId = recoverResult.user_id;

    if (recoverResult.access_token) {
        identity.jwtToken = recoverResult.access_token;
    } else {
        identity.jwtToken = await getJwtViaWba(client, identity, config.didDomain);
    }

    return [identity, recoverResult];
}
```

### 2.7 `resolveHandle` 函数

```javascript
/**
 * 解析 Handle
 * @param {AsyncClient} client - HTTP 客户端
 * @param {string} handle - Handle 名称
 * @returns {Promise<Object>}
 */
async function resolveHandle(client, handle) {
    return await rpcCall(client, HANDLE_RPC, 'lookup', { handle });
}
```

### 2.8 `lookupHandle` 函数

```javascript
/**
 * 通过 DID 查找 Handle
 * @param {AsyncClient} client - HTTP 客户端
 * @param {string} did - DID
 * @returns {Promise<Object>}
 */
async function lookupHandle(client, did) {
    return await rpcCall(client, HANDLE_RPC, 'lookup', { did });
}
```

---

## 3. 导出接口

```javascript
export {
    HANDLE_RPC,
    DID_AUTH_RPC,
    DEFAULT_COUNTRY_CODE,
    normalizePhone,
    sanitizeOtp,
    sendOtp,
    registerHandle,
    recoverHandle,
    resolveHandle,
    lookupHandle,
};
```

---

## 4. 迁移检查清单

- [ ] 实现 `normalizePhone` 函数
- [ ] 实现 `sanitizeOtp` 函数
- [ ] 实现 `sendOtp` 函数
- [ ] 实现 `registerHandle` 函数
- [ ] 实现 `recoverHandle` 函数
- [ ] 实现 `resolveHandle` 函数
- [ ] 实现 `lookupHandle` 函数
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 更新文档
