# @awiki/module 项目测试计划

## 1. 概述

**项目名称**: @awiki/module  
**测试范围**: 所有移植的 JavaScript 模块  
**测试目标**: 确保与 Python 版本功能对等、接口一致、互操作

---

## 2. 测试策略

### 2.1 测试层次

```
┌─────────────────────────────────────┐
│         交叉测试 (Python ↔ JS)       │  ← 确保互操作性
├─────────────────────────────────────┤
│         集成测试 (模块组合)          │  ← 确保模块协作
├─────────────────────────────────────┤
│         单元测试 (单模块)            │  ← 确保功能正确
└─────────────────────────────────────┘
```

### 2.2 测试类型

| 测试类型 | 比例 | 说明 |
|----------|------|------|
| 单元测试 | 60% | 单个模块功能测试 |
| 集成测试 | 25% | 多模块协作测试 |
| 交叉测试 | 15% | Python ↔ JS 互操作测试 |

### 2.3 测试环境

```yaml
测试环境:
  - Node.js: 18.x, 20.x
  - Python: 3.10+
  - 数据库：SQLite (内存)
  - 网络：mock + 真实 awiki.ai 测试环境
```

---

## 3. 模块测试设计

### 3.1 auth 模块

**测试文件**: `tests/unit/auth.test.js`

#### 3.1.1 单元测试

```javascript
describe('auth module', () => {
    describe('generateWbaAuthHeader', () => {
        it('should generate valid DIDWba header', async () => {
            const identity = await createTestIdentity();
            const header = await generateWbaAuthHeader(identity, 'awiki.ai');
            
            expect(header).toMatch(/^DIDWba did:wba:awiki\.ai:user:k1_[a-zA-Z0-9]+:[a-f0-9]+:\d+$/);
        });

        it('should generate different headers for different timestamps', async () => {
            const identity = await createTestIdentity();
            const header1 = await generateWbaAuthHeader(identity, 'awiki.ai');
            await sleep(1000);
            const header2 = await generateWbaAuthHeader(identity, 'awiki.ai');
            
            expect(header1).not.toBe(header2);
        });
    });

    describe('registerDid', () => {
        it('should register DID successfully', async () => {
            const client = createMockClient();
            const identity = await createTestIdentity();
            
            const result = await registerDid(client, identity, { name: 'Test' });
            
            expect(result).toHaveProperty('user_id');
            expect(result).toHaveProperty('did');
        });

        it('should handle registration failure', async () => {
            const client = createMockClient({ status: 400 });
            const identity = await createTestIdentity();
            
            await expect(registerDid(client, identity))
                .rejects.toThrow(JsonRpcError);
        });
    });

    describe('getJwtViaWba', () => {
        it('should obtain JWT successfully', async () => {
            const client = createMockClient();
            const identity = await createTestIdentity();
            
            const jwt = await getJwtViaWba(client, identity, 'awiki.ai');
            
            expect(jwt).toMatch(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
        });

        it('should handle authentication failure', async () => {
            const client = createMockClient({ status: 401 });
            const identity = await createTestIdentity();
            
            await expect(getJwtViaWba(client, identity, 'awiki.ai'))
                .rejects.toThrow('Authentication failed');
        });
    });

    describe('createAuthenticatedIdentity', () => {
        it('should create complete identity', async () => {
            const client = createMockClient();
            const config = new SDKConfig();
            
            const identity = await createAuthenticatedIdentity(client, config, {
                name: 'Test Agent',
            });
            
            expect(identity).toHaveProperty('did');
            expect(identity).toHaveProperty('userId');
            expect(identity).toHaveProperty('jwtToken');
        });
    });
});
```

#### 3.1.2 超时测试

```javascript
describe('auth module - timeout tests', () => {
    it('should handle JWT expiration and refresh', async () => {
        const client = createMockClient();
        const identity = await createTestIdentity();
        
        // 设置 JWT 即将过期
        identity.jwtToken = createExpiringJwt(5000); // 5 秒后过期
        
        // 第一次调用 - JWT 有效
        const result1 = await authenticatedRpcCall(client, '/rpc', 'test', {}, {
            auth: new DIDWbaAuthHeader(identity),
        });
        expect(result1).toBeDefined();
        
        // 等待 JWT 过期
        await sleep(6000);
        
        // 第二次调用 - 自动刷新 JWT
        const result2 = await authenticatedRpcCall(client, '/rpc', 'test', {}, {
            auth: new DIDWbaAuthHeader(identity),
        });
        expect(result2).toBeDefined();
        expect(identity.jwtToken).not.toBe(result1.jwtToken); // JWT 已刷新
    });

    it('should fail when refresh times out', async () => {
        const client = createMockClient({ delay: 35000 }); // 35 秒延迟
        const identity = await createTestIdentity();
        
        await expect(
            authenticatedRpcCall(client, '/rpc', 'test', {}, {
                auth: new DIDWbaAuthHeader(identity),
            })
        ).rejects.toThrow('Request timeout');
    });
});
```

---

### 3.2 client 模块

**测试文件**: `tests/unit/client.test.js`

```javascript
describe('client module', () => {
    describe('createUserServiceClient', () => {
        it('should create client with correct config', () => {
            const config = new SDKConfig();
            const client = createUserServiceClient(config);
            
            expect(client.baseURL).toBe(config.userServiceUrl);
            expect(client.timeout).toBe(30000);
        });

        it('should resolve verify for localhost', () => {
            const result = _resolveVerify('http://localhost:8080');
            expect(result).toBe(true);
        });

        it('should use custom CA bundle from env', () => {
            process.env.AWIKI_CA_BUNDLE = '/path/to/ca.pem';
            const result = _resolveVerify('https://awiki.ai');
            expect(result).toBeInstanceOf(https.Agent);
            delete process.env.AWIKI_CA_BUNDLE;
        });
    });
});
```

---

### 3.3 e2ee 模块

**测试文件**: `tests/unit/e2ee.test.js`

```javascript
describe('e2ee module', () => {
    describe('E2eeClient', () => {
        it('should create E2EE client', () => {
            const client = new E2eeClient(localDid, {
                signingPem: testSigningPem,
                x25519Pem: testX25519Pem,
            });
            
            expect(client.localDid).toBe(localDid);
        });

        it('should initiate handshake', async () => {
            const client = new E2eeClient(localDid, {
                signingPem: testSigningPem,
                x25519Pem: testX25519Pem,
            });
            
            const [msgType, content] = await client.initiateHandshake(peerDid);
            
            expect(msgType).toBe('e2ee_init');
            expect(content).toHaveProperty('e2ee_version', '1.1');
            expect(content).toHaveProperty('session_id');
        });

        it('should encrypt and decrypt message', async () => {
            // 创建两个客户端
            const alice = new E2eeClient(aliceDid, aliceKeys);
            const bob = new E2eeClient(bobDid, bobKeys);
            
            // Alice 发起握手
            const [msgType, initContent] = await alice.initiateHandshake(bobDid);
            
            // Bob 处理握手
            const ackMessages = await bob.processE2eeMessage(msgType, initContent);
            expect(ackMessages[0][0]).toBe('e2ee_ack');
            
            // Alice 发送加密消息
            const [encType, encContent] = alice.encryptMessage(bobDid, 'Secret message');
            expect(encType).toBe('e2ee_msg');
            
            // Bob 解密消息
            const [originalType, plaintext] = bob.decryptMessage(encContent);
            expect(originalType).toBe('text');
            expect(plaintext).toBe('Secret message');
        });

        it('should handle session expiration', async () => {
            const client = new E2eeClient(localDid, keys);
            
            // 创建过期会话
            await client.initiateHandshake(peerDid);
            
            // 模拟会话过期
            client.keyManager.sessions[0].expiresAt = Date.now() / 1000 - 1000;
            
            // 确保活跃会话 - 应该自动重新握手
            const messages = await client.ensureActiveSession(peerDid);
            expect(messages).toHaveLength(1);
            expect(messages[0][0]).toBe('e2ee_init');
        });
    });

    describe('state persistence', () => {
        it('should export and restore state', () => {
            const client1 = new E2eeClient(localDid, keys);
            
            // 导出状态
            const state = client1.exportState();
            
            // 恢复状态
            const client2 = E2eeClient.fromState(state);
            
            expect(client2.localDid).toBe(localDid);
            expect(client2.signingPem).toBe(keys.signingPem);
        });
    });
});
```

---

### 3.4 handle 模块

**测试文件**: `tests/unit/handle.test.js`

```javascript
describe('handle module', () => {
    describe('normalizePhone', () => {
        it('should accept international format', () => {
            expect(normalizePhone('+8613800138000')).toBe('+8613800138000');
            expect(normalizePhone('+14155552671')).toBe('+14155552671');
        });

        it('should convert China local format', () => {
            expect(normalizePhone('13800138000')).toBe('+8613800138000');
            expect(normalizePhone('14155552671')).toBe('+8614155552671');
        });

        it('should reject invalid format', () => {
            expect(() => normalizePhone('12345')).toThrow('Invalid phone number');
        });
    });

    describe('registerHandle', () => {
        it('should register handle successfully', async () => {
            const client = createMockClient();
            const config = new SDKConfig();
            
            const identity = await registerHandle(
                client, config,
                '+8613800138000', '123456', 'alice',
                { name: 'Alice' }
            );
            
            expect(identity.handle).toBe('alice');
            expect(identity.userId).toBeDefined();
        });

        it('should handle short handle with invite code', async () => {
            const client = createMockClient();
            const config = new SDKConfig();
            
            const identity = await registerHandle(
                client, config,
                '+8613800138000', '123456', 'bob',
                { inviteCode: 'ABC123' }
            );
            
            expect(identity.handle).toBe('bob');
        });
    });
});
```

---

## 4. 集成测试

### 4.1 身份管理流程

**测试文件**: `tests/integration/identity-flow.test.js`

```javascript
describe('Identity Flow Integration', () => {
    it('should complete full identity lifecycle', async () => {
        const client = createMockClient();
        const config = new SDKConfig();
        
        // 1. 创建身份
        const identity = await createAuthenticatedIdentity(client, config, {
            name: 'Test Agent',
        });
        expect(identity.did).toBeDefined();
        
        // 2. 加载身份
        const loadedIdentity = await loadIdentity('default');
        expect(loadedIdentity.did).toBe(identity.did);
        
        // 3. 更新 JWT
        const newJwt = await getJwtViaWba(client, identity, 'awiki.ai');
        expect(newJwt).toBeDefined();
        
        // 4. 删除身份
        await deleteIdentity('default');
        await expect(loadIdentity('default')).rejects.toThrow();
    });
});
```

### 4.2 E2EE 消息流程

**测试文件**: `tests/integration/e2ee-flow.test.js`

```javascript
describe('E2EE Flow Integration', () => {
    it('should complete E2EE conversation', async () => {
        // 创建两个用户
        const alice = await createTestIdentity('alice');
        const bob = await createTestIdentity('bob');
        
        const aliceE2ee = new E2eeClient(alice.did, alice.e2eeKeys);
        const bobE2ee = new E2eeClient(bob.did, bob.e2eeKeys);
        
        // 1. Alice 发起握手
        const [initType, initContent] = await aliceE2ee.initiateHandshake(bob.did);
        
        // 2. Bob 处理握手并确认
        const [ackType, ackContent] = (await bobE2ee.processE2eeMessage(initType, initContent))[0];
        expect(ackType).toBe('e2ee_ack');
        
        // 3. Alice 发送加密消息
        const [encType1, encContent1] = aliceE2ee.encryptMessage(bob.did, 'Hello Bob!');
        
        // 4. Bob 解密消息
        const [type1, plaintext1] = bobE2ee.decryptMessage(encContent1);
        expect(plaintext1).toBe('Hello Bob!');
        
        // 5. Bob 回复加密消息
        const [encType2, encContent2] = bobE2ee.encryptMessage(alice.did, 'Hi Alice!');
        
        // 6. Alice 解密消息
        const [type2, plaintext2] = aliceE2ee.decryptMessage(encContent2);
        expect(plaintext2).toBe('Hi Alice!');
        
        // 7. 多轮对话
        for (let i = 0; i < 10; i++) {
            const [encType, encContent] = aliceE2ee.encryptMessage(bob.did, `Message ${i}`);
            const [type, plaintext] = bobE2ee.decryptMessage(encContent);
            expect(plaintext).toBe(`Message ${i}`);
        }
    });
});
```

---

## 5. Python ↔ JS 交叉测试

### 5.1 认证交叉测试

**测试文件**: `tests/interop/auth-interop.test.js`

```javascript
describe('Auth Interop (Python ↔ JS)', () => {
    it('should verify JS-generated header in Python server', async () => {
        const identity = await createTestIdentity();
        
        // JS 生成认证头
        const jsHeader = await generateWbaAuthHeader(identity, 'awiki.ai');
        
        // 发送到 Python 服务器验证
        const response = await fetch('http://python-test-server/verify-header', {
            method: 'POST',
            headers: { 'Authorization': jsHeader },
        });
        
        expect(response.status).toBe(200);
    });

    it('should verify Python-generated header in JS', async () => {
        // 从 Python 服务器获取认证头
        const pyHeader = await fetch('http://python-test-server/generate-header')
            .then(r => r.text());
        
        // JS 验证
        const isValid = await verifyAuthHeader(pyHeader, 'awiki.ai');
        expect(isValid).toBe(true);
    });
});
```

### 5.2 E2EE 交叉测试

**测试文件**: `tests/interop/e2ee-interop.test.js`

```javascript
describe('E2EE Interop (Python ↔ JS)', () => {
    it('should decrypt JS-encrypted message in Python', async () => {
        const aliceJs = new E2eeClient(aliceDid, aliceKeys);
        
        // JS 加密
        const [encType, encContent] = aliceJs.encryptMessage(bobDid, 'Hello from JS!');
        
        // Python 解密
        const response = await fetch('http://python-test-server/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: encContent,
                recipient: 'bob',
            }),
        });
        
        const result = await response.json();
        expect(result.plaintext).toBe('Hello from JS!');
    });

    it('should decrypt Python-encrypted message in JS', async () => {
        const bobJs = new E2eeClient(bobDid, bobKeys);
        
        // Python 加密
        const encContent = await fetch('http://python-test-server/encrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plaintext: 'Hello from Python!',
                sender: 'alice',
                recipient: 'bob',
            }),
        }).then(r => r.json());
        
        // JS 解密
        const [type, plaintext] = bobJs.decryptMessage(encContent);
        expect(plaintext).toBe('Hello from Python!');
    });

    it('should complete multi-round conversation (Python ↔ JS)', async () => {
        // 第 1 轮：JS -> Python
        const aliceJs = new E2eeClient(aliceDid, aliceKeys);
        const [enc1, content1] = aliceJs.encryptMessage(bobDid, 'Round 1 from JS');
        const pyResult1 = await pythonDecrypt(content1, bobDid);
        expect(pyResult1.plaintext).toBe('Round 1 from JS');
        
        // 第 2 轮：Python -> JS
        const pyEnc2 = await pythonEncrypt('Round 2 from Python', aliceDid, bobDid);
        const [type2, jsPlain2] = aliceJs.decryptMessage(pyEnc2);
        expect(jsPlain2).toBe('Round 2 from Python');
        
        // 第 3-10 轮：多轮对话
        for (let i = 3; i <= 10; i++) {
            const isJsTurn = i % 2 === 1;
            
            if (isJsTurn) {
                const [enc, content] = aliceJs.encryptMessage(bobDid, `Round ${i} from JS`);
                const result = await pythonDecrypt(content, bobDid);
                expect(result.plaintext).toBe(`Round ${i} from JS`);
            } else {
                const pyEnc = await pythonEncrypt(`Round ${i} from Python`, aliceDid, bobDid);
                const [type, plain] = aliceJs.decryptMessage(pyEnc);
                expect(plain).toBe(`Round ${i} from Python`);
            }
        }
    });
});
```

---

## 6. 超时测试

### 6.1 JWT 超时测试

**测试文件**: `tests/timeout/jwt-timeout.test.js`

```javascript
describe('JWT Timeout Tests', () => {
    it('should handle JWT about to expire', async () => {
        const client = createMockClient();
        const identity = await createTestIdentity();
        
        // 设置 JWT 即将过期（5 秒后）
        identity.jwtToken = createJwtWithExpiry(5000);
        
        // 立即调用 - 应该成功
        const result = await authenticatedRpcCall(client, '/rpc', 'test', {}, {
            auth: new DIDWbaAuthHeader(identity),
        });
        expect(result).toBeDefined();
    });

    it('should auto-refresh expired JWT', async () => {
        const client = createMockClient();
        const identity = await createTestIdentity();
        const oldJwt = createJwtWithExpiry(2000);
        identity.jwtToken = oldJwt;
        
        // 等待 JWT 过期
        await sleep(3000);
        
        // 调用 - 应该自动刷新
        const result = await authenticatedRpcCall(client, '/rpc', 'test', {}, {
            auth: new DIDWbaAuthHeader(identity),
        });
        
        expect(result).toBeDefined();
        expect(identity.jwtToken).not.toBe(oldJwt); // JWT 已刷新
    });

    it('should fail when server timeout', async () => {
        const client = createMockClient({ delay: 35000 }); // 35 秒延迟
        const identity = await createTestIdentity();
        
        await expect(
            authenticatedRpcCall(client, '/rpc', 'test', {}, {
                auth: new DIDWbaAuthHeader(identity),
            })
        ).rejects.toThrow('Request timeout');
    });
});
```

### 6.2 E2EE 会话超时测试

**测试文件**: `tests/timeout/e2ee-timeout.test.js`

```javascript
describe('E2EE Session Timeout Tests', () => {
    it('should handle expired session', async () => {
        const alice = new E2eeClient(aliceDid, aliceKeys);
        const bob = new E2eeClient(bobDid, bobKeys);
        
        // 建立会话
        await alice.initiateHandshake(bobDid);
        
        // 模拟会话过期
        alice.keyManager.sessions[0].expiresAt = Date.now() / 1000 - 1000;
        
        // 尝试加密 - 应该失败
        expect(() => {
            alice.encryptMessage(bobDid, 'Test');
        }).toThrow('No active session');
        
        // 确保活跃会话 - 应该重新握手
        const messages = await alice.ensureActiveSession(bobDid);
        expect(messages).toHaveLength(1);
        expect(messages[0][0]).toBe('e2ee_init');
    });

    it('should handle proof expiration', async () => {
        const bob = new E2eeClient(bobDid, bobKeys);
        
        // 创建过期的 proof
        const expiredContent = createExpiredProof(3600); // 1 小时前过期
        
        // 处理应该失败
        const result = await bob.processE2eeMessage('e2ee_init', expiredContent);
        expect(result).toHaveLength(1);
        expect(result[0][0]).toBe('e2ee_error');
        expect(result[0][1].error_code).toBe('proof_expired');
    });
});
```

---

## 7. 测试覆盖率要求

| 模块 | 语句覆盖率 | 分支覆盖率 | 行覆盖率 |
|------|-----------|-----------|---------|
| auth | ≥90% | ≥85% | ≥90% |
| client | ≥85% | ≥80% | ≥85% |
| config | ≥95% | ≥90% | ≥95% |
| e2ee | ≥85% | ≥80% | ≥85% |
| handle | ≥90% | ≥85% | ≥90% |
| identity | ≥90% | ≥85% | ≥90% |
| rpc | ≥90% | ≥85% | ≥90% |
| ws | ≥85% | ≥80% | ≥85% |
| resolve | ≥90% | ≥85% | ≥90% |
| logging | ≥80% | ≥75% | ≥80% |

---

## 8. 测试执行

### 8.1 单元测试

```bash
# 运行所有单元测试
npm test -- tests/unit/

# 运行特定模块测试
npm test -- tests/unit/auth.test.js

# 带覆盖率
npm test -- --coverage
```

### 8.2 集成测试

```bash
# 运行集成测试
npm test -- tests/integration/

# 运行特定流程测试
npm test -- tests/integration/e2ee-flow.test.js
```

### 8.3 交叉测试

```bash
# 启动 Python 测试服务器
python tests/interop/test_server.py &

# 运行交叉测试
npm test -- tests/interop/
```

### 8.4 超时测试

```bash
# 运行超时测试
npm test -- tests/timeout/

# 运行特定超时测试
npm test -- tests/timeout/jwt-timeout.test.js
```

---

## 9. CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm test -- tests/unit/
    
    - name: Run integration tests
      run: npm test -- tests/integration/
    
    - name: Setup Python for interop tests
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'
    
    - name: Install Python dependencies
      run: pip install -r requirements.txt
    
    - name: Start Python test server
      run: python tests/interop/test_server.py &
    
    - name: Run interop tests
      run: npm test -- tests/interop/
    
    - name: Check coverage
      run: npm test -- --coverage --coverageThreshold='{"global":{"branches":80,"functions":80,"lines":80,"statements":80}}'
```

---

## 10. 测试报告

### 10.1 测试执行报告

```
Test Suites: 15 passed, 15 total
Tests:       156 passed, 156 total
Snapshots:   0 total
Time:        45.2 s
Coverage:    89.5%
```

### 10.2 交叉测试报告

```
Python ↔ JS Interop Tests:
  Auth: 4 passed
  E2EE: 8 passed
  HTTP: 6 passed
  WebSocket: 4 passed
Total: 22 passed, 0 failed
```

---

## 11. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Python 测试服务器不稳定 | 高 | 中 | 添加重试机制，使用 mock |
| 交叉测试环境配置复杂 | 中 | 高 | Docker 容器化测试环境 |
| 超时测试时间长 | 中 | 高 | 并行执行，设置超时上限 |
| E2EE 密钥管理复杂 | 高 | 中 | 使用测试密钥，隔离测试数据 |
