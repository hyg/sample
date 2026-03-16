# @awiki/agent-sdk 项目测试计划

## 1. 概述

**项目名称**: @awiki/agent-sdk  
**测试范围**: SDK 的所有 API 函数  
**测试目标**: 确保所有 CLI 命令都有对应的函数接口，功能完整、类型安全

---

## 2. 测试策略

### 2.1 测试层次

```
┌─────────────────────────────────────┐
│      端到端测试 (完整业务流程)       │  ← 模拟开发者使用
├─────────────────────────────────────┤
│      集成测试 (API 组合调用)          │  ← 测试 API 协作
├─────────────────────────────────────┤
│      单元测试 (单个 API 函数)         │  ← 测试每个函数
└─────────────────────────────────────┘
```

### 2.2 测试类型

| 测试类型 | 比例 | 说明 |
|----------|------|------|
| 单元测试 | 60% | 单个 API 函数测试 |
| 集成测试 | 25% | API 组合调用测试 |
| 端到端测试 | 15% | 完整业务流程测试 |

### 2.3 测试环境

```yaml
测试环境:
  - Node.js: 18.x, 20.x
  - TypeScript: 5.x
  - Python: 3.10+ (用于交叉测试)
  - 数据库：SQLite (内存)
  - 网络：mock + 真实 awiki.ai 测试环境
```

---

## 3. API 函数测试

### 3.1 Identity API

**测试文件**: `tests/unit/identity.test.ts`

```typescript
import { AwikiSDK } from '../../src/sdk';

describe('Identity API', () => {
    let sdk: AwikiSDK;

    beforeEach(async () => {
        sdk = new AwikiSDK();
        await sdk.init();
    });

    afterEach(async () => {
        await sdk.destroy();
    });

    describe('sdk.identity.create()', () => {
        it('should create new identity', async () => {
            const identity = await sdk.identity.create({
                name: 'TestAgent',
                displayName: 'Test Agent',
            });

            expect(identity).toHaveProperty('did');
            expect(identity).toHaveProperty('uniqueId');
            expect(identity).toHaveProperty('userId');
            expect(identity).toHaveProperty('jwtToken');
        });

        it('should create agent identity', async () => {
            const identity = await sdk.identity.create({
                name: 'MyAgent',
                isAgent: true,
            });

            expect(identity).toHaveProperty('did');
        });

        it('should handle creation failure', async () => {
            await expect(
                sdk.identity.create({ name: '' }) // 无效名称
            ).rejects.toThrow('Invalid name');
        });
    });

    describe('sdk.identity.load()', () => {
        it('should load existing identity', async () => {
            // 先创建
            await sdk.identity.create({ name: 'TestAgent' });

            // 加载
            const identity = await sdk.identity.load('TestAgent');

            expect(identity).toHaveProperty('did');
        });

        it('should fail to load non-existent identity', async () => {
            await expect(
                sdk.identity.load('NonExistent')
            ).rejects.toThrow('Identity not found');
        });
    });

    describe('sdk.identity.list()', () => {
        it('should list all identities', async () => {
            await sdk.identity.create({ name: 'Agent1' });
            await sdk.identity.create({ name: 'Agent2' });

            const identities = await sdk.identity.list();

            expect(identities).toContain('Agent1');
            expect(identities).toContain('Agent2');
        });
    });

    describe('sdk.identity.delete()', () => {
        it('should delete identity', async () => {
            await sdk.identity.create({ name: 'ToDelete' });

            await sdk.identity.delete('ToDelete');

            const identities = await sdk.identity.list();
            expect(identities).not.toContain('ToDelete');
        });
    });
});
```

---

### 3.2 Handle API

**测试文件**: `tests/unit/handle.test.ts`

```typescript
describe('Handle API', () => {
    let sdk: AwikiSDK;

    beforeEach(async () => {
        sdk = new AwikiSDK();
        await sdk.init();
    });

    describe('sdk.handle.sendOtp()', () => {
        it('should send OTP to phone', async () => {
            const result = await sdk.handle.sendOtp('+8613800138000');

            expect(result).toBeDefined();
        });

        it('should normalize phone number', async () => {
            // 本地格式应自动添加国家代码
            const result = await sdk.handle.sendOtp('13800138000');

            expect(result).toBeDefined();
        });

        it('should reject invalid phone', async () => {
            await expect(
                sdk.handle.sendOtp('12345')
            ).rejects.toThrow('Invalid phone number');
        });
    });

    describe('sdk.handle.register()', () => {
        it('should register handle', async () => {
            const identity = await sdk.handle.register(
                'testuser',
                '+8613800138000',
                '123456'
            );

            expect(identity.handle).toBe('testuser');
            expect(identity).toHaveProperty('did');
        });

        it('should register short handle with invite code', async () => {
            const identity = await sdk.handle.register(
                'bob',
                '+8613800138000',
                '123456',
                { inviteCode: 'ABC123' }
            );

            expect(identity.handle).toBe('bob');
        });
    });

    describe('sdk.handle.recover()', () => {
        it('should recover handle', async () => {
            const identity = await sdk.handle.recover(
                'testuser',
                '+8613800138000',
                '123456'
            );

            expect(identity.handle).toBe('testuser');
        });
    });

    describe('sdk.handle.resolve()', () => {
        it('should resolve handle to DID', async () => {
            const did = await sdk.handle.resolve('alice');

            expect(did).toMatch(/^did:wba:/);
        });

        it('should return DID as-is', async () => {
            const inputDid = 'did:wba:awiki.ai:user:k1_abc123';
            const did = await sdk.handle.resolve(inputDid);

            expect(did).toBe(inputDid);
        });

        it('should reject non-existent handle', async () => {
            await expect(
                sdk.handle.resolve('nonexistent')
            ).rejects.toThrow('Handle not found');
        });
    });
});
```

---

### 3.3 Message API

**测试文件**: `tests/unit/message.test.ts`

```typescript
describe('Message API', () => {
    let sdk: AwikiSDK;

    beforeEach(async () => {
        sdk = new AwikiSDK();
        await sdk.init();
    });

    describe('sdk.message.send()', () => {
        it('should send text message', async () => {
            const result = await sdk.message.send(
                '@alice',
                'Hello!'
            );

            expect(result).toHaveProperty('messageId');
            expect(result).toHaveProperty('serverSeq');
            expect(result).toHaveProperty('clientMsgId');
        });

        it('should send to DID', async () => {
            const result = await sdk.message.send(
                'did:wba:awiki.ai:user:k1_abc123',
                'Hello!'
            );

            expect(result).toHaveProperty('messageId');
        });

        it('should send typed message', async () => {
            const result = await sdk.message.send(
                '@alice',
                '{"event":"invite"}',
                { type: 'event' }
            );

            expect(result).toHaveProperty('messageId');
        });

        it('should send E2EE message by default', async () => {
            const result = await sdk.message.send(
                '@alice',
                'Secret message',
                { e2ee: true }
            );

            expect(result).toHaveProperty('messageId');
        });
    });

    describe('sdk.message.getInbox()', () => {
        it('should get inbox messages', async () => {
            const result = await sdk.message.getInbox({ limit: 10 });

            expect(result).toHaveProperty('messages');
            expect(Array.isArray(result.messages)).toBe(true);
        });

        it('should limit results', async () => {
            const result = await sdk.message.getInbox({ limit: 5 });

            expect(result.messages.length).toBeLessThanOrEqual(5);
        });
    });

    describe('sdk.message.getHistory()', () => {
        it('should get chat history', async () => {
            const result = await sdk.message.getHistory('@alice', {
                limit: 20,
            });

            expect(result).toHaveProperty('messages');
        });
    });

    describe('sdk.message.markRead()', () => {
        it('should mark messages as read', async () => {
            await sdk.message.markRead(['msg1', 'msg2', 'msg3']);

            // 验证已标记
            const inbox = await sdk.message.getInbox();
            inbox.messages.forEach(msg => {
                if (['msg1', 'msg2', 'msg3'].includes(msg.messageId)) {
                    expect(msg.read).toBe(true);
                }
            });
        });
    });
});
```

---

### 3.4 Group API

**测试文件**: `tests/unit/group.test.ts`

```typescript
describe('Group API', () => {
    let sdk: AwikiSDK;

    beforeEach(async () => {
        sdk = new AwikiSDK();
        await sdk.init();
    });

    describe('sdk.group.create()', () => {
        it('should create group', async () => {
            const result = await sdk.group.create(
                'Test Group',
                ['did1', 'did2', 'did3']
            );

            expect(result).toHaveProperty('groupId');
            expect(result).toHaveProperty('joinCode');
        });
    });

    describe('sdk.group.join()', () => {
        it('should join group with code', async () => {
            await sdk.group.join('314159');

            // 验证已加入
            const groups = await sdk.group.list();
            expect(groups.length).toBeGreaterThan(0);
        });
    });

    describe('sdk.group.leave()', () => {
        it('should leave group', async () => {
            const groupId = 'G123';

            await sdk.group.leave(groupId);

            // 验证已离开
            const groups = await sdk.group.list();
            expect(groups.some(g => g.id === groupId)).toBe(false);
        });
    });

    describe('sdk.group.listMembers()', () => {
        it('should list group members', async () => {
            const members = await sdk.group.listMembers('G123');

            expect(Array.isArray(members)).toBe(true);
            expect(members.length).toBeGreaterThan(0);
        });
    });

    describe('sdk.group.sendMessage()', () => {
        it('should send group message', async () => {
            const result = await sdk.group.sendMessage(
                'G123',
                'Hello everyone!'
            );

            expect(result).toHaveProperty('messageId');
        });
    });

    describe('sdk.group.listMessages()', () => {
        it('should list group messages', async () => {
            const messages = await sdk.group.listMessages('G123', {
                limit: 10,
            });

            expect(Array.isArray(messages)).toBe(true);
        });
    });
});
```

---

### 3.5 Relationship API

**测试文件**: `tests/unit/relationship.test.ts`

```typescript
describe('Relationship API', () => {
    let sdk: AwikiSDK;

    beforeEach(async () => {
        sdk = new AwikiSDK();
        await sdk.init();
    });

    describe('sdk.relationship.follow()', () => {
        it('should follow user', async () => {
            await sdk.relationship.follow('@alice');

            // 验证已关注
            const status = await sdk.relationship.getStatus('@alice');
            expect(status.following).toBe(true);
        });
    });

    describe('sdk.relationship.unfollow()', () => {
        it('should unfollow user', async () => {
            await sdk.relationship.follow('@alice');
            await sdk.relationship.unfollow('@alice');

            const status = await sdk.relationship.getStatus('@alice');
            expect(status.following).toBe(false);
        });
    });

    describe('sdk.relationship.getStatus()', () => {
        it('should get relationship status', async () => {
            const status = await sdk.relationship.getStatus('@alice');

            expect(status).toHaveProperty('following');
            expect(status).toHaveProperty('follower');
        });
    });

    describe('sdk.relationship.getFollowing()', () => {
        it('should get following list', async () => {
            const following = await sdk.relationship.getFollowing();

            expect(Array.isArray(following)).toBe(true);
        });
    });

    describe('sdk.relationship.getFollowers()', () => {
        it('should get followers list', async () => {
            const followers = await sdk.relationship.getFollowers();

            expect(Array.isArray(followers)).toBe(true);
        });
    });
});
```

---

## 4. 多轮互动场景测试

### 4.1 完整用户流程

**测试文件**: `tests/scenarios/user-flow.test.ts`

```typescript
describe('Complete User Flow (Multi-round)', () => {
    it('should complete full registration and messaging flow', async () => {
        const sdk = new AwikiSDK();
        await sdk.init();

        // 第 1 轮：创建身份
        const identity = await sdk.identity.create({
            name: 'TestUser',
            displayName: 'Test User',
        });
        expect(identity.did).toBeDefined();

        // 第 2 轮：注册 Handle
        await sdk.handle.sendOtp('+8613800138000');
        const handleIdentity = await sdk.handle.register(
            'testuser',
            '+8613800138000',
            '123456'
        );
        expect(handleIdentity.handle).toBe('testuser');

        // 第 3 轮：更新 Profile
        await sdk.profile.updateMyProfile({
            nickName: 'Test User',
            bio: 'Hello World',
            tags: ['test', 'user'],
        });

        // 第 4 轮：发送消息
        const sendResult = await sdk.message.send(
            '@alice',
            'Hello Alice!'
        );
        expect(sendResult.messageId).toBeDefined();

        // 第 5 轮：查看收件箱
        const inbox = await sdk.message.getInbox({ limit: 10 });
        expect(inbox.messages).toBeDefined();

        // 第 6 轮：标记已读
        const unreadIds = inbox.messages
            .filter(m => !m.read)
            .map(m => m.messageId);
        if (unreadIds.length > 0) {
            await sdk.message.markRead(unreadIds);
        }

        await sdk.destroy();
    });
});
```

### 4.2 E2EE 对话场景

**测试文件**: `tests/scenarios/e2ee-conversation.test.ts`

```typescript
describe('E2EE Conversation (20 rounds)', () => {
    it('should complete 20-round encrypted conversation', async () => {
        const alice = new AwikiSDK('alice_test');
        const bob = new AwikiSDK('bob_test');

        await alice.init();
        await bob.init();

        // 第 1-20 轮：多轮加密对话
        for (let i = 1; i <= 20; i++) {
            const sender = i % 2 === 1 ? alice : bob;
            const receiver = i % 2 === 1 ? bob : alice;
            const message = `Round ${i} encrypted message`;

            // 发送
            const sendResult = await sender.message.send(
                '@' + (i % 2 === 1 ? 'bob' : 'alice'),
                message,
                { e2ee: true }
            );
            expect(sendResult.messageId).toBeDefined();

            // 接收并验证
            const inbox = await receiver.message.getInbox({ limit: 1 });
            const latestMessage = inbox.messages[0];
            expect(latestMessage.content).toBe(message);
        }

        await alice.destroy();
        await bob.destroy();
    });

    it('should handle session expiration mid-conversation', async () => {
        const alice = new AwikiSDK('alice_test');
        const bob = new AwikiSDK('bob_test');

        await alice.init();
        await bob.init();

        // 第 1-5 轮：正常对话
        for (let i = 1; i <= 5; i++) {
            await alice.message.send('@bob', `Message ${i}`, { e2ee: true });
        }

        // 模拟会话过期
        await alice.e2ee.expireSession('bob');

        // 第 6 轮：应该自动重新握手
        const result = await alice.message.send(
            '@bob',
            'After expiry',
            { e2ee: true }
        );
        expect(result.messageId).toBeDefined();

        // 第 7-10 轮：恢复对话
        for (let i = 7; i <= 10; i++) {
            const sendResult = await alice.message.send(
                '@bob',
                `Message ${i}`,
                { e2ee: true }
            );
            expect(sendResult.messageId).toBeDefined();
        }

        await alice.destroy();
        await bob.destroy();
    });
});
```

### 4.3 群组互动场景

**测试文件**: `tests/scenarios/group-interaction.test.ts`

```typescript
describe('Group Interaction (Multi-round)', () => {
    it('should complete group lifecycle', async () => {
        const sdk = new AwikiSDK();
        await sdk.init();

        // 第 1 轮：创建群组
        const group = await sdk.group.create(
            'Test Group',
            ['did1', 'did2', 'did3'],
            { description: 'Test group' }
        );
        expect(group.groupId).toBeDefined();

        // 第 2-11 轮：发送 10 条群消息
        for (let i = 1; i <= 10; i++) {
            const result = await sdk.group.sendMessage(
                group.groupId,
                `Message ${i}`
            );
            expect(result.messageId).toBeDefined();
        }

        // 第 12 轮：列出群消息
        const messages = await sdk.group.listMessages(group.groupId, {
            limit: 10,
        });
        expect(messages.length).toBe(10);

        // 第 13 轮：列出成员
        const members = await sdk.group.listMembers(group.groupId);
        expect(members.length).toBeGreaterThanOrEqual(1);

        // 第 14 轮：离开群组
        await sdk.group.leave(group.groupId);

        await sdk.destroy();
    });
});
```

---

## 5. 超时测试

### 5.1 JWT 超时测试

**测试文件**: `tests/timeout/jwt-timeout.test.ts`

```typescript
describe('JWT Timeout Tests', () => {
    it('should handle JWT about to expire (5 seconds)', async () => {
        const sdk = new AwikiSDK();
        await sdk.init();

        // 设置 JWT 即将过期
        await sdk.auth.setExpiringJwt(5000);

        // 立即调用 - 应该成功
        const result = await sdk.message.send('@alice', 'Test');
        expect(result.messageId).toBeDefined();
    });

    it('should auto-refresh expired JWT', async () => {
        const sdk = new AwikiSDK();
        await sdk.init();

        const oldJwt = await sdk.auth.getJwt();

        // 等待 JWT 过期
        await sleep(6000);

        // 调用 - 应该自动刷新
        const result = await sdk.message.send('@alice', 'Test');
        expect(result.messageId).toBeDefined();

        const newJwt = await sdk.auth.getJwt();
        expect(newJwt).not.toBe(oldJwt);
    });

    it('should fail when server timeout (35 seconds)', async () => {
        const sdk = new AwikiSDK();
        await sdk.init({ timeout: 5000 }); // 5 秒超时

        await sdk.network.simulateDelay(35000); // 模拟 35 秒延迟

        await expect(
            sdk.message.send('@alice', 'Test')
        ).rejects.toThrow('Request timeout');
    });
});
```

### 5.2 E2EE 会话超时测试

**测试文件**: `tests/timeout/e2ee-timeout.test.ts`

```typescript
describe('E2EE Session Timeout Tests', () => {
    it('should handle expired session (5 minutes)', async () => {
        const sdk = new AwikiSDK();
        await sdk.init();

        // 建立会话
        await sdk.message.send('@alice', 'Hello', { e2ee: true });

        // 模拟会话过期
        await sdk.e2ee.expireSession('alice');

        // 尝试发送 - 应该自动重新握手
        const result = await sdk.message.send(
            '@alice',
            'After expiry',
            { e2ee: true }
        );
        expect(result.messageId).toBeDefined();
    });

    it('should handle proof expiration', async () => {
        const sdk = new AwikiSDK();
        await sdk.init();

        // 创建过期 proof
        const expiredContent = sdk.e2ee.createExpiredProof(3600);

        // 处理应该失败
        await expect(
            sdk.e2ee.processMessage('e2ee_init', expiredContent)
        ).rejects.toThrow('proof_expired');
    });
});
```

---

## 6. Python ↔ JS 交叉测试

### 6.1 API 功能对等测试

**测试文件**: `tests/interop/api-interop.test.ts`

```typescript
describe('API Interop (Python ↔ JS)', () => {
    it('should have same behavior for send_message', async () => {
        // Python SDK
        const pySdk = await createPythonSdk();
        const pyResult = await pySdk.message.send('@alice', 'Test');

        // JS SDK
        const jsSdk = new AwikiSDK();
        await jsSdk.init();
        const jsResult = await jsSdk.message.send('@alice', 'Test');

        // 比较结果结构
        expect(pyResult).toHaveProperty('messageId');
        expect(jsResult).toHaveProperty('messageId');
        expect(pyResult).toHaveProperty('serverSeq');
        expect(jsResult).toHaveProperty('serverSeq');
    });

    it('should have same behavior for get_inbox', async () => {
        // Python SDK
        const pySdk = await createPythonSdk();
        const pyInbox = await pySdk.message.getInbox({ limit: 10 });

        // JS SDK
        const jsSdk = new AwikiSDK();
        await jsSdk.init();
        const jsInbox = await jsSdk.message.getInbox({ limit: 10 });

        // 比较结构
        expect(pyInbox).toHaveProperty('messages');
        expect(jsInbox).toHaveProperty('messages');
        expect(Array.isArray(pyInbox.messages)).toBe(true);
        expect(Array.isArray(jsInbox.messages)).toBe(true);
    });
});
```

### 6.2 E2EE 交叉测试

**测试文件**: `tests/interop/e2ee-interop.test.ts`

```typescript
describe('E2EE Interop (Python ↔ JS)', () => {
    it('should decrypt JS-encrypted message in Python', async () => {
        // JS 加密
        const jsSdk = new AwikiSDK();
        await jsSdk.init();
        const encrypted = await jsSdk.e2ee.encrypt('alice', 'From JS');

        // Python 解密
        const pySdk = await createPythonSdk();
        const decrypted = await pySdk.e2ee.decrypt(encrypted, 'alice');

        expect(decrypted).toBe('From JS');
    });

    it('should decrypt Python-encrypted message in JS', async () => {
        // Python 加密
        const pySdk = await createPythonSdk();
        const encrypted = await pySdk.e2ee.encrypt('alice', 'From Python');

        // JS 解密
        const jsSdk = new AwikiSDK();
        await jsSdk.init();
        const decrypted = await jsSdk.e2ee.decrypt(encrypted, 'alice');

        expect(decrypted).toBe('From Python');
    });

    it('should complete 10-round Python↔JS conversation', async () => {
        const pySdk = await createPythonSdk();
        const jsSdk = new AwikiSDK();

        await pySdk.init();
        await jsSdk.init();

        for (let i = 1; i <= 10; i++) {
            const isJsTurn = i % 2 === 1;

            if (isJsTurn) {
                // JS -> Python
                const encrypted = await jsSdk.e2ee.encrypt('alice', `Round ${i} JS`);
                const decrypted = await pySdk.e2ee.decrypt(encrypted, 'alice');
                expect(decrypted).toBe(`Round ${i} JS`);
            } else {
                // Python -> JS
                const encrypted = await pySdk.e2ee.encrypt('alice', `Round ${i} Python`);
                const decrypted = await jsSdk.e2ee.decrypt(encrypted, 'alice');
                expect(decrypted).toBe(`Round ${i} Python`);
            }
        }
    });
});
```

---

## 7. TypeScript 类型测试

### 7.1 类型定义测试

**测试文件**: `tests/types/index.test-d.ts`

```typescript
import { expectType, expectError } from 'tsd';
import { AwikiSDK, Identity, Message, Group } from '../../src';

describe('TypeScript Types', () => {
    it('should have correct SDK type', () => {
        const sdk = new AwikiSDK();
        expectType<AwikiSDK>(sdk);
    });

    it('should have correct identity.create type', async () => {
        const sdk = new AwikiSDK();
        
        // 正确调用
        const identity = await sdk.identity.create({ name: 'Test' });
        expectType<Identity>(identity);
        
        // 错误调用 - 缺少必需参数
        expectError(await sdk.identity.create());
    });

    it('should have correct message.send type', async () => {
        const sdk = new AwikiSDK();
        
        const result = await sdk.message.send('@alice', 'Hello');
        expectType<{ messageId: string; serverSeq: number }>(result);
    });

    it('should have correct group.create type', async () => {
        const sdk = new AwikiSDK();
        
        const result = await sdk.group.create('Name', ['did1']);
        expectType<Group>(result);
    });
});
```

---

## 8. 测试覆盖率要求

| API 类 | 语句覆盖率 | 分支覆盖率 | 行覆盖率 |
|--------|-----------|-----------|---------|
| identity | ≥90% | ≥85% | ≥90% |
| handle | ≥90% | ≥85% | ≥90% |
| message | ≥90% | ≥85% | ≥90% |
| group | ≥85% | ≥80% | ≥85% |
| relationship | ≥85% | ≥80% | ≥85% |
| profile | ≥90% | ≥85% | ≥90% |
| content | ≥85% | ≥80% | ≥85% |
| credits | ≥85% | ≥80% | ≥85% |
| listener | ≥85% | ≥80% | ≥85% |
| e2ee | ≥85% | ≥80% | ≥85% |

---

## 9. 测试执行

### 9.1 单元测试

```bash
# 运行所有单元测试
npm test -- tests/unit/

# 运行特定 API 测试
npm test -- tests/unit/message.test.ts

# 带覆盖率
npm test -- --coverage
```

### 9.2 场景测试

```bash
# 运行所有场景测试
npm test -- tests/scenarios/

# 运行特定场景
npm test -- tests/scenarios/e2ee-conversation.test.ts
```

### 9.3 交叉测试

```bash
# 启动 Python 环境
source venv/bin/activate

# 运行交叉测试
npm test -- tests/interop/
```

### 9.4 类型测试

```bash
# 运行类型测试
npm run test:types
```

---

## 10. CI/CD 集成

```yaml
# .github/workflows/sdk-test.yml
name: SDK Tests

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
    
    - name: Run scenario tests
      run: npm test -- tests/scenarios/
    
    - name: Run type tests
      run: npm run test:types
    
    - name: Check coverage
      run: npm test -- --coverage --coverageThreshold='{"global":{"branches":80,"functions":80,"lines":80,"statements":80}}'
```

---

## 11. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Python/JS 行为不一致 | 高 | 中 | 交叉测试，早期发现 |
| 类型定义不完整 | 中 | 中 | 严格的类型测试 |
| 多轮测试状态管理复杂 | 中 | 高 | 每个测试独立凭证 |
| 超时测试时间长 | 中 | 高 | 并行执行，设置上限 |
