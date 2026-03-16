# awiki.ai 隐性协议克服方案

**创建日期**: 2026-03-16  
**状态**: 执行中

---

## 1. 问题概述

### 1.1 背景

Python 版本 (awiki-agent-id-message) 和 awiki.ai 网站的服务端是同一个团队开发的。这两个项目之间的接口和时序、协议，有大量实现细节没有记录到任何文档，而是他们团队在开发过程直接口头交流确定的。

现在我们没有 awiki.ai 网站服务端的代码，需要把 Python 版本移植到 Node.js。

### 1.2 识别的隐性协议

根据分析报告 `IMPLICIT_PROTOCOL_ANALYSIS.md`，共识别 **5 个主要隐性协议**：

1. **DID WBA 认证协议** - 基于 secp256k1 的签名认证，JWT 令牌管理
2. **JSON-RPC 2.0 调用协议** - 标准 RPC 格式 + 401 自动重试
3. **E2EE 端到端加密协议** - HPKE (RFC 9180) + Chain Ratchet，三密钥体系
4. **WebSocket 推送协议** - JWT 查询参数认证，推送通知格式
5. **Handle 注册协议** - OTP 验证，电话号码规范化

### 1.3 主要风险

| 风险等级 | 风险项 | 描述 |
|----------|--------|------|
| 🔴 高 | E2EE 版本硬编码 | 版本 "1.1" 硬编码，服务端升级可能导致不兼容 |
| 🔴 高 | JWT 刷新逻辑 | 依赖 401 被动触发，高延迟网络可能失败 |
| 🔴 高 | HPKE 状态持久化 | 复杂的会话状态序列化/反序列化 |
| 🟡 中 | 未文档化错误码 | -32003、-32004 等错误码含义不明 |
| 🟡 中 | URL 路径硬编码 | RPC 端点路径写死在代码中 |

---

## 2. 克服方案总览

### 2.1 信息获取策略

| 方法 | 描述 | 优先级 | 预计时间 |
|------|------|--------|----------|
| **代码逆向分析** | 详细分析 Python 代码中的协议实现 | 🔴 高 | 2 周 |
| **网络抓包** | 捕获实际通信数据验证协议细节 | 🔴 高 | 1 周 |
| **测试驱动** | 编写测试用例验证协议行为 | 🔴 高 | 持续 |
| **与服务端联调** | 直接测试服务端响应 | 🔴 高 | 持续 |
| **文档补充** | 将发现记录到文档 | 🟡 中 | 持续 |

### 2.2 技术策略

| 策略 | 描述 | 应用范围 |
|------|------|----------|
| **配置化设计** | 将魔法值提取到配置文件 | 所有模块 |
| **协议版本协商** | 支持多个协议版本 | E2EE 模块 |
| **主动刷新** | 在过期前主动刷新 JWT | 认证模块 |
| **严格测试** | 单元测试覆盖所有边界情况 | 所有模块 |
| **渐进式移植** | 分 6 个阶段逐步完成 | 整体项目 |

---

## 3. 详细克服方案

### 3.1 DID WBA 认证协议

#### 问题
- JWT 刷新依赖 401 响应被动触发
- 认证头格式细节未文档化
- 服务端可能从响应头或响应体返回 JWT

#### 解决方案

**1. 实现主动 JWT 刷新**
```javascript
class JwtManager {
    constructor(config) {
        this.refreshThreshold = 300; // 过期前 5 分钟刷新
    }

    async getValidToken() {
        const token = await this.loadToken();
        const expiresIn = this.getExpiresIn(token);
        
        // 主动刷新：过期前 5 分钟
        if (expiresIn < this.refreshThreshold) {
            return await this.refreshToken();
        }
        
        return token;
    }
}
```

**2. 配置化认证头格式**
```javascript
const config = {
    auth: {
        headerPrefix: 'DIDWba',
        jwtPrefix: 'Bearer',
        extractFromResponse: ['body.access_token', 'headers.authorization'],
    }
};
```

**3. 双重 JWT 提取**
```javascript
function extractJwt(response) {
    // 优先从响应体提取
    if (response.data?.access_token) {
        return response.data.access_token;
    }
    
    // 回退到响应头
    const authHeader = response.headers?.authorization;
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
        return authHeader.split(' ', 2)[1];
    }
    
    return null;
}
```

#### 验证测试
```javascript
describe('JWT Management', () => {
    it('should refresh token before expiry', async () => {
        // 模拟即将过期的 JWT
        // 验证主动刷新逻辑
    });

    it('should extract JWT from response body', async () => {
        // 验证从 response.data.access_token 提取
    });

    it('should extract JWT from response header', async () => {
        // 验证从 Authorization 头提取
    });
});
```

---

### 3.2 JSON-RPC 2.0 调用协议

#### 问题
- 未文档化的错误码（-32003, -32004）
- 服务端可能不返回 result 字段
- 401 自动重试逻辑复杂

#### 解决方案

**1. 错误码映射表**
```javascript
const ERROR_CODES = {
    // JSON-RPC 标准错误码
    '-32700': 'Parse error',
    '-32600': 'Invalid Request',
    '-32601': 'Method not found',
    '-32602': 'Invalid params',
    '-32603': 'Internal error',
    
    // awiki 自定义错误码
    '-32003': 'DID already registered',
    '-32004': 'Slug already taken',
};

function getErrorMessage(code) {
    return ERROR_CODES[String(code)] || `Unknown error: ${code}`;
}
```

**2. 配置化重试策略**
```javascript
const config = {
    retry: {
        enabled: true,
        maxRetries: 1,
        retryableStatusCodes: [401],
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
    }
};
```

**3. 401 重试中间件**
```javascript
async function authenticatedRpcCall(client, endpoint, method, params, auth) {
    const authHeaders = await auth.getAuthHeader();
    
    try {
        const response = await client.post(endpoint, {
            jsonrpc: '2.0',
            method,
            params,
            id: 1,
        }, { headers: authHeaders });
        
        return response.data;
    } catch (error) {
        // 401 重试逻辑
        if (error.response?.status === 401) {
            await auth.refreshToken();
            const newAuthHeaders = await auth.getAuthHeader();
            
            const retryResponse = await client.post(endpoint, {
                jsonrpc: '2.0',
                method,
                params,
                id: 1,
            }, { headers: newAuthHeaders });
            
            return retryResponse.data;
        }
        
        throw error;
    }
}
```

#### 验证测试
```javascript
describe('JSON-RPC Error Handling', () => {
    it('should handle error -32003', async () => {
        // 模拟 DID 已注册错误
        mockRpcError(-32003, 'DID already registered');
        
        await expect(rpcCall('register', {}))
            .rejects.toThrow('DID already registered');
    });

    it('should retry on 401', async () => {
        // 第一次返回 401，第二次成功
        mockHttpError(401);
        mockSuccess({ result: {...} });
        
        const result = await rpcCall('method', {});
        expect(result).toBeDefined();
    });
});
```

---

### 3.3 E2EE 端到端加密协议

#### 问题
- E2EE 版本 "1.1" 硬编码
- HPKE 状态持久化复杂
- 三密钥体系（key-1, key-2, key-3）

#### 解决方案

**1. 协议版本协商**
```javascript
const E2EE_CONFIG = {
    // 支持的版本列表
    supportedVersions: ['1.0', '1.1'],
    
    // 默认版本
    defaultVersion: '1.1',
    
    // 版本协商函数
    negotiateVersion(serverVersions, clientVersions) {
        // 选择双方都支持的最高版本
        const common = serverVersions.filter(v => clientVersions.includes(v));
        return common.sort().pop() || null;
    }
};
```

**2. HPKE 状态序列化**
```javascript
class E2eeStateManager {
    exportState(session) {
        return {
            version: 'hpke_v1',
            sessionId: session.sessionId,
            localDid: session.localDid,
            peerDid: session.peerDid,
            sendChainKey: bytesToBase64(session.sendChainKey),
            recvChainKey: bytesToBase64(session.recvChainKey),
            sendSeq: session.sendSeq,
            recvSeq: session.recvSeq,
            expiresAt: session.expiresAt,
        };
    }

    importState(state) {
        if (state.version !== 'hpke_v1') {
            throw new Error(`Unsupported state version: ${state.version}`);
        }
        
        return new E2eeSession({
            sessionId: state.sessionId,
            localDid: state.localDid,
            peerDid: state.peerDid,
            sendChainKey: base64ToBytes(state.sendChainKey),
            recvChainKey: base64ToBytes(state.recvChainKey),
            sendSeq: state.sendSeq,
            recvSeq: state.recvSeq,
            expiresAt: state.expiresAt,
        });
    }
}
```

**3. 三密钥管理**
```javascript
class KeyManager {
    constructor() {
        this.keys = {
            'key-1': null,  // secp256k1 (DID 身份)
            'key-2': null,  // secp256r1 (E2EE 签名)
            'key-3': null,  // X25519 (密钥协商)
        };
    }

    async generateKeyPair(keyId) {
        switch (keyId) {
            case 'key-1':
                return await generateSecp256k1KeyPair();
            case 'key-2':
                return await generateSecp256r1KeyPair();
            case 'key-3':
                return await generateX25519KeyPair();
            default:
                throw new Error(`Unknown key ID: ${keyId}`);
        }
    }
}
```

#### 验证测试
```javascript
describe('E2EE Protocol', () => {
    it('should negotiate E2EE version', () => {
        const version = negotiateVersion(['1.0', '1.1'], ['1.1', '1.2']);
        expect(version).toBe('1.1');
    });

    it('should export and import HPKE state', () => {
        const session = createSession();
        const state = exportState(session);
        const restored = importState(state);
        
        expect(restored.sessionId).toBe(session.sessionId);
        expect(restored.sendChainKey).toEqual(session.sendChainKey);
    });

    it('should handle three key types', async () => {
        const km = new KeyManager();
        
        const key1 = await km.generateKeyPair('key-1');
        const key2 = await km.generateKeyPair('key-2');
        const key3 = await km.generateKeyPair('key-3');
        
        expect(key1.algorithm).toBe('secp256k1');
        expect(key2.algorithm).toBe('secp256r1');
        expect(key3.algorithm).toBe('X25519');
    });
});
```

---

### 3.4 WebSocket 推送协议

#### 问题
- JWT 通过查询参数传递（非标准）
- 推送通知无 id 字段
- URL 自动转换逻辑

#### 解决方案

**1. 配置化认证方式**
```javascript
const WS_CONFIG = {
    auth: {
        // 认证方式：'query' | 'header' | 'subprotocol'
        method: 'query',
        tokenParam: 'token',
    },
    url: {
        // URL 转换规则
        httpToWs: {
            'http://': 'ws://',
            'https://': 'wss://',
        }
    }
};
```

**2. 推送通知识别**
```javascript
function isPushNotification(message) {
    // 推送通知没有 id 字段
    return !('id' in message);
}

function handleMessage(message) {
    if (isPushNotification(message)) {
        // 处理推送通知
        return handlePush(message);
    } else {
        // 处理请求响应
        return handleResponse(message);
    }
}
```

**3. URL 自动转换**
```javascript
function convertHttpToWsUrl(httpUrl) {
    let wsUrl = httpUrl;
    
    for (const [http, ws] of Object.entries(WS_CONFIG.url.httpToWs)) {
        if (wsUrl.startsWith(http)) {
            wsUrl = wsUrl.replace(http, ws);
            break;
        }
    }
    
    return wsUrl;
}
```

#### 验证测试
```javascript
describe('WebSocket Protocol', () => {
    it('should identify push notification', () => {
        const push = { jsonrpc: '2.0', method: 'message', params: {...} };
        const response = { jsonrpc: '2.0', id: 1, result: {...} };
        
        expect(isPushNotification(push)).toBe(true);
        expect(isPushNotification(response)).toBe(false);
    });

    it('should convert HTTP URL to WebSocket', () => {
        expect(convertHttpToWsUrl('https://awiki.ai'))
            .toBe('wss://awiki.ai');
    });
});
```

---

### 3.5 Handle 注册协议

#### 问题
- 电话号码格式化规则复杂
- OTP 代码自动去除空白
- 短 Handle 需要邀请码

#### 解决方案

**1. 配置化电话格式化**
```javascript
const PHONE_CONFIG = {
    // 默认国家代码
    defaultCountryCode: '+86',
    
    // 中国本地号码正则
    cnLocalPattern: /^1[3-9]\d{9}$/,
    
    // 国际格式正则
    intlPattern: /^\+\d{1,3}\d{6,14}$/,
    
    // 国家代码映射
    countryCodes: {
        'CN': '+86',
        'US': '+1',
        // ...
    }
};
```

**2. 电话规范化函数**
```javascript
function normalizePhone(phone) {
    phone = phone.trim();
    
    // 已是国际格式
    if (PHONE_CONFIG.intlPattern.test(phone)) {
        return phone;
    }
    
    // 中国本地格式
    if (PHONE_CONFIG.cnLocalPattern.test(phone)) {
        return PHONE_CONFIG.defaultCountryCode + phone;
    }
    
    throw new Error(`Invalid phone number: ${phone}`);
}
```

**3. OTP 代码清理**
```javascript
function sanitizeOtp(code) {
    return code.replace(/\s+/g, '');
}
```

#### 验证测试
```javascript
describe('Phone Normalization', () => {
    it('should accept international format', () => {
        expect(normalizePhone('+8613800138000')).toBe('+8613800138000');
        expect(normalizePhone('+14155552671')).toBe('+14155552671');
    });

    it('should convert China local format', () => {
        expect(normalizePhone('13800138000')).toBe('+8613800138000');
    });

    it('should sanitize OTP code', () => {
        expect(sanitizeOtp('123 456')).toBe('123456');
        expect(sanitizeOtp('12\n34\t56')).toBe('123456');
    });
});
```

---

## 4. 配置化设计

### 4.1 统一配置文件

```javascript
// config/awiki.config.js
export const AWIKI_CONFIG = {
    // 服务端端点
    endpoints: {
        didAuth: '/user-service/did-auth/rpc',
        handle: '/user-service/handle/rpc',
        message: '/message/rpc',
        group: '/group/rpc',
        wellKnownHandle: '/user-service/.well-known/handle',
    },
    
    // 超时设置
    timeouts: {
        http: 30000,
        wsReceive: 10000,
        jwtRefreshThreshold: 300,
    },
    
    // E2EE 配置
    e2ee: {
        supportedVersions: ['1.0', '1.1'],
        defaultVersion: '1.1',
        sessionExpires: 86400,
        maxSeqSkip: 256,
    },
    
    // 错误码映射
    errorCodes: {
        '-32003': 'DID already registered',
        '-32004': 'Slug already taken',
    },
    
    // 电话配置
    phone: {
        defaultCountryCode: '+86',
        cnLocalPattern: /^1[3-9]\d{9}$/,
        intlPattern: /^\+\d{1,3}\d{6,14}$/,
    },
    
    // WebSocket 配置
    ws: {
        authMethod: 'query',
        tokenParam: 'token',
        httpToWs: {
            'http://': 'ws://',
            'https://': 'wss://',
        },
    },
};
```

### 4.2 环境变量覆盖

```javascript
// config/env.config.js
export function loadEnvConfig() {
    return {
        endpoints: {
            didAuth: process.env.AWIKI_DID_AUTH_ENDPOINT,
            handle: process.env.AWIKI_HANDLE_ENDPOINT,
            message: process.env.AWIKI_MESSAGE_ENDPOINT,
            group: process.env.AWIKI_GROUP_ENDPOINT,
        },
        timeouts: {
            http: parseInt(process.env.AWIKI_HTTP_TIMEOUT || '30000'),
            wsReceive: parseInt(process.env.AWIKI_WS_RECEIVE_TIMEOUT || '10000'),
        },
        e2ee: {
            defaultVersion: process.env.AWIKI_E2EE_VERSION || '1.1',
        },
    };
}
```

---

## 5. 测试驱动开发

### 5.1 单元测试

```javascript
// tests/unit/protocol.test.js
describe('Implicit Protocol Tests', () => {
    describe('JWT Management', () => {
        it('should refresh token before expiry', async () => {
            // 实现
        });

        it('should handle 401 and retry', async () => {
            // 实现
        });
    });

    describe('E2EE Protocol', () => {
        it('should negotiate version', () => {
            // 实现
        });

        it('should export/import state', () => {
            // 实现
        });
    });
});
```

### 5.2 集成测试

```javascript
// tests/integration/server.test.js
describe('Server Integration Tests', () => {
    it('should complete DID registration flow', async () => {
        // 完整测试 DID 注册流程
    });

    it('should complete E2EE conversation', async () => {
        // 完整测试 E2EE 对话流程
    });
});
```

### 5.3 网络抓包验证

```bash
# 使用 Wireshark 或 tcpdump 捕获实际通信
tcpdump -i any -s 0 -w awiki.pcap host awiki.ai

# 使用 mitmproxy 进行中间人分析
mitmproxy --mode regular --listen-port 8080
```

---

## 6. 渐进式移植策略

### 阶段 1: 基础 HTTP 客户端 + JSON-RPC (Week 1-2)

**目标**: 实现基础 HTTP 客户端和 JSON-RPC 封装

**交付物**:
- HTTP 客户端工厂
- JSON-RPC 调用封装
- 错误处理
- 基础测试

**验证**: 能够调用服务端 RPC 接口

### 阶段 2: DID WBA 认证 + JWT 管理 (Week 3-4)

**目标**: 实现 DID 认证和 JWT 管理

**交付物**:
- DID WBA 认证头生成
- JWT 主动刷新
- 401 自动重试
- 认证测试

**验证**: 能够完成 DID 注册和认证流程

### 阶段 3: Handle 注册 + 解析 (Week 5-6)

**目标**: 实现 Handle 相关功能

**交付物**:
- OTP 发送
- Handle 注册
- Handle 解析
- 电话格式化

**验证**: 能够注册和解析 Handle

### 阶段 4: WebSocket 客户端 + 推送处理 (Week 7-8)

**目标**: 实现 WebSocket 通信

**交付物**:
- WebSocket 客户端
- 推送通知处理
- JSON-RPC 请求/响应
- 心跳机制

**验证**: 能够接收推送通知

### 阶段 5: E2EE 加密 + 会话管理 (Week 9-12)

**目标**: 实现 E2EE 端到端加密

**交付物**:
- HPKE 加密/解密
- 会话管理
- 状态持久化
- 密钥轮换

**验证**: 能够完成 E2EE 加密对话

### 阶段 6: 完整集成测试 (Week 13-14)

**目标**: 完整集成测试和优化

**交付物**:
- 集成测试套件
- 性能优化
- 文档完善
- 发布准备

**验证**: 所有测试通过，可以发布

---

## 7. 监控和日志

### 7.1 协议调试日志

```javascript
const logger = {
    debug Protocol, message, data) {
        console.log(`[PROTOCOL] ${protocol}: ${message}`, data);
    },
    
    warn Protocol, message, data) {
        console.warn(`[PROTOCOL WARN] ${protocol}: ${message}`, data);
    },
    
    error Protocol, error, data) {
        console.error(`[PROTOCOL ERROR] ${protocol}: ${error}`, data);
    }
};
```

### 7.2 指标收集

```javascript
const metrics = {
    rpcCalls: 0,
    rpcErrors: 0,
    jwtRefreshes: 0,
    e2eeSessions: 0,
    wsMessages: 0,
    
    recordRpcCall(success) {
        this.rpcCalls++;
        if (!success) this.rpcErrors++;
    },
    
    getErrorRate() {
        return this.rpcErrors / this.rpcCalls;
    }
};
```

---

## 8. 总结

### 8.1 克服方案汇总

| 方案 | 应用范围 | 优先级 |
|------|---------|--------|
| 配置化设计 | 所有模块 | 🔴 高 |
| 协议版本协商 | E2EE 模块 | 🔴 高 |
| 主动 JWT 刷新 | 认证模块 | 🔴 高 |
| 严格单元测试 | 所有模块 | 🔴 高 |
| 网络抓包验证 | 所有模块 | 🟡 中 |
| 渐进式移植 | 整体项目 | 🟡 中 |

### 8.2 预计时间

| 阶段 | 内容 | 时间 |
|------|------|------|
| 阶段 1 | 基础 HTTP + JSON-RPC | 2 周 |
| 阶段 2 | DID WBA 认证 | 2 周 |
| 阶段 3 | Handle 注册 | 2 周 |
| 阶段 4 | WebSocket | 2 周 |
| 阶段 5 | E2EE 加密 | 4 周 |
| 阶段 6 | 集成测试 | 2 周 |
| **总计** | | **14 周** |

### 8.3 成功标准

1. **功能对等**: 与 Python 版本功能完全对等
2. **协议兼容**: 与 awiki.ai 服务端完全兼容
3. **测试覆盖**: 单元测试覆盖率 ≥85%
4. **文档完整**: 所有隐性协议已文档化
5. **可维护性**: 配置化设计，易于扩展

---

**文档位置**: `doc/IMPLICIT_PROTOCOL_SOLUTIONS.md`  
**创建日期**: 2026-03-16  
**状态**: 执行中
