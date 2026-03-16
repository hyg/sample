# awiki-agent-id-message Skill 项目测试计划

## 1. 概述

**项目名称**: awiki-agent-id-message-skill  
**测试范围**: Skill Package 的所有 CLI 脚本和功能  
**测试目标**: 确保与 Python 版本功能对等、符合 agentskills.io 规范

---

## 2. 测试策略

### 2.1 测试层次

```
┌─────────────────────────────────────┐
│      端到端测试 (完整用户流程)       │  ← 模拟真实用户
├─────────────────────────────────────┤
│      场景测试 (多轮互动)             │  ← 测试复杂场景
├─────────────────────────────────────┤
│      CLI 测试 (命令行脚本)           │  ← 测试每个脚本
└─────────────────────────────────────┘
```

### 2.2 测试类型

| 测试类型 | 比例 | 说明 |
|----------|------|------|
| CLI 测试 | 50% | 命令行脚本测试 |
| 场景测试 | 30% | 多轮互动场景 |
| 端到端测试 | 20% | 完整用户流程 |

### 2.3 测试环境

```yaml
测试环境:
  - Node.js: 18.x, 20.x
  - Python: 3.10+ (用于交叉测试)
  - 数据库：SQLite (内存)
  - 网络：mock + 真实 awiki.ai 测试环境
  - SKILL.md: 符合 agentskills.io 规范验证
```

---

## 3. CLI 脚本测试

### 3.1 check_status.js

**测试文件**: `tests/cli/check_status.test.js`

```javascript
describe('check_status.js CLI', () => {
    it('should show status dashboard', async () => {
        const { stdout, stderr, exitCode } = await runCli(
            'node scripts/check_status.js'
        );
        
        expect(exitCode).toBe(0);
        
        const status = JSON.parse(stdout);
        expect(status).toHaveProperty('version');
        expect(status).toHaveProperty('identity');
        expect(status).toHaveProperty('inbox');
        expect(status).toHaveProperty('e2ee');
    });

    it('should run upgrade-only mode', async () => {
        const { stdout, stderr, exitCode } = await runCli(
            'node scripts/check_status.js --upgrade-only'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Upgrade completed');
    });

    it('should detect missing identity', async () => {
        // 清理测试凭证
        await cleanupCredentials();
        
        const { stdout, exitCode } = await runCli(
            'node scripts/check_status.js'
        );
        
        const status = JSON.parse(stdout);
        expect(status.identity.status).toBe('no_identity');
    });
});
```

### 3.2 setup_identity.js

**测试文件**: `tests/cli/setup_identity.test.js`

```javascript
describe('setup_identity.js CLI', () => {
    beforeEach(async () => {
        await cleanupCredentials();
    });

    it('should create new identity', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/setup_identity.js --name TestAgent'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('DID:');
        expect(stdout).toContain('user_id:');
        expect(stdout).toContain('JWT token:');
    });

    it('should load existing identity', async () => {
        // 先创建身份
        await runCli('node scripts/setup_identity.js --name TestAgent');
        
        // 加载身份
        const { stdout, exitCode } = await runCli(
            'node scripts/setup_identity.js --load TestAgent'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Identity loaded');
    });

    it('should list all identities', async () => {
        await runCli('node scripts/setup_identity.js --name Agent1');
        await runCli('node scripts/setup_identity.js --name Agent2');
        
        const { stdout, exitCode } = await runCli(
            'node scripts/setup_identity.js --list'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Agent1');
        expect(stdout).toContain('Agent2');
    });

    it('should delete identity', async () => {
        await runCli('node scripts/setup_identity.js --name TestAgent');
        
        const { exitCode } = await runCli(
            'node scripts/setup_identity.js --delete TestAgent'
        );
        
        expect(exitCode).toBe(0);
        
        // 验证已删除
        const { stdout } = await runCli(
            'node scripts/setup_identity.js --list'
        );
        expect(stdout).not.toContain('TestAgent');
    });
});
```

### 3.3 register_handle.js

**测试文件**: `tests/cli/register_handle.test.js`

```javascript
describe('register_handle.js CLI', () => {
    beforeEach(async () => {
        await cleanupCredentials();
    });

    it('should send OTP and wait for code', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/register_handle.js --handle testuser --phone +8613800138000'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Sending OTP');
        expect(stdout).toContain('Enter OTP code');
    });

    it('should register handle with OTP', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/register_handle.js --handle testuser --phone +8613800138000 --otp-code 123456'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Handle:');
        expect(stdout).toContain('DID:');
        expect(stdout).toContain('user_id:');
    });

    it('should handle short handle with invite code', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/register_handle.js --handle bob --phone +8613800138000 --otp-code 123456 --invite-code ABC123'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Handle: bob');
    });

    it('should reject invalid phone number', async () => {
        const { stderr, exitCode } = await runCli(
            'node scripts/register_handle.js --handle testuser --phone 12345'
        );
        
        expect(exitCode).not.toBe(0);
        expect(stderr).toContain('Invalid phone number');
    });
});
```

### 3.4 send_message.js

**测试文件**: `tests/cli/send_message.test.js`

```javascript
describe('send_message.js CLI', () => {
    it('should send message by Handle', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/send_message.js --to alice --content "Hello!"'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Message sent');
        expect(stdout).toContain('Message ID:');
    });

    it('should send message by DID', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/send_message.js --to "did:wba:awiki.ai:user:k1_abc123" --content "Hello!"'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Message sent');
    });

    it('should send typed message', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/send_message.js --to alice --content \'{"event":"invite"}\' --type event'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Message sent');
    });

    it('should handle non-existent recipient', async () => {
        const { stderr, exitCode } = await runCli(
            'node scripts/send_message.js --to nonexistent --content "Hello!"'
        );
        
        expect(exitCode).not.toBe(0);
        expect(stderr).toContain('Handle not found');
    });
});
```

### 3.5 check_inbox.js

**测试文件**: `tests/cli/check_inbox.test.js`

```javascript
describe('check_inbox.js CLI', () => {
    it('should show inbox messages', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/check_inbox.js --limit 10'
        );
        
        expect(exitCode).toBe(0);
        
        const messages = JSON.parse(stdout);
        expect(Array.isArray(messages)).toBe(true);
    });

    it('should show chat history', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/check_inbox.js --history alice'
        );
        
        expect(exitCode).toBe(0);
        
        const messages = JSON.parse(stdout);
        expect(Array.isArray(messages)).toBe(true);
    });

    it('should mark messages as read', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/check_inbox.js --mark-read msg1,msg2,msg3'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Marked as read');
    });

    it('should filter by scope', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/check_inbox.js --scope group'
        );
        
        expect(exitCode).toBe(0);
        
        const messages = JSON.parse(stdout);
        messages.forEach(msg => {
            expect(msg.thread_id).toMatch(/^group:/);
        });
    });
});
```

### 3.6 e2ee_messaging.js

**测试文件**: `tests/cli/e2ee_messaging.test.js`

```javascript
describe('e2ee_messaging.js CLI', () => {
    it('should send encrypted message', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/e2ee_messaging.js --send alice --content "Secret message"'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Encrypted message sent');
    });

    it('should process E2EE messages', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/e2ee_messaging.js --process --peer alice'
        );
        
        expect(exitCode).toBe(0);
        
        if (stdout.includes('Decrypted')) {
            expect(stdout).toContain('Decrypted messages:');
        }
    });

    it('should list failed sends', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/e2ee_messaging.js --list-failed'
        );
        
        expect(exitCode).toBe(0);
        
        if (stdout.includes('Failed sends')) {
            expect(stdout).toMatch(/outbox_id|message/);
        }
    });

    it('should retry failed send', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/e2ee_messaging.js --retry outbox_123'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Retry successful');
    });
});
```

### 3.7 manage_group.js

**测试文件**: `tests/cli/manage_group.test.js`

```javascript
describe('manage_group.js CLI', () => {
    it('should create group', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_group.js --create --name "Test Group" --members "did1,did2"'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Group created');
        expect(stdout).toContain('group_id:');
    });

    it('should join group with code', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_group.js --join --join-code 314159'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Joined group');
    });

    it('should post group message', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_group.js --post-message --group-id G123 --content "Hello everyone"'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Message sent');
    });

    it('should list members', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_group.js --members --group-id G123'
        );
        
        expect(exitCode).toBe(0);
        
        const members = JSON.parse(stdout);
        expect(Array.isArray(members)).toBe(true);
    });

    it('should leave group', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_group.js --leave --group-id G123'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Left group');
    });
});
```

### 3.8 manage_relationship.js

**测试文件**: `tests/cli/manage_relationship.test.js`

```javascript
describe('manage_relationship.js CLI', () => {
    it('should follow user', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_relationship.js --follow alice'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Followed');
    });

    it('should unfollow user', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_relationship.js --unfollow alice'
        );
        
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Unfollowed');
    });

    it('should check relationship status', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_relationship.js --status alice'
        );
        
        expect(exitCode).toBe(0);
        
        const status = JSON.parse(stdout);
        expect(status).toHaveProperty('following');
        expect(status).toHaveProperty('follower');
    });

    it('should list following', async () => {
        const { stdout, exitCode } = await runCli(
            'node scripts/manage_relationship.js --following'
        );
        
        expect(exitCode).toBe(0);
        
        const following = JSON.parse(stdout);
        expect(Array.isArray(following)).toBe(true);
    });
});
```

---

## 4. 多轮互动场景测试

### 4.1 完整用户注册流程

**测试文件**: `tests/scenarios/registration-flow.test.js`

```javascript
describe('User Registration Flow (Multi-round)', () => {
    it('should complete full registration flow', async () => {
        // 第 1 轮：创建身份
        const { stdout: createOutput } = await runCli(
            'node scripts/setup_identity.js --name TestUser'
        );
        expect(createOutput).toContain('DID:');
        
        const did = extractDid(createOutput);
        
        // 第 2 轮：注册 Handle
        const { stdout: handleOutput } = await runCli(
            `node scripts/register_handle.js --handle testuser --phone +8613800138000 --otp-code 123456`
        );
        expect(handleOutput).toContain('Handle: testuser');
        
        // 第 3 轮：更新 Profile
        const { stdout: profileOutput } = await runCli(
            'node scripts/update_profile.js --nick-name "Test User" --bio "Hello" --tags "test,user"'
        );
        expect(profileOutput).toContain('Profile updated');
        
        // 第 4 轮：验证状态
        const { stdout: statusOutput } = await runCli(
            'node scripts/check_status.js'
        );
        const status = JSON.parse(statusOutput);
        expect(status.identity.status).toBe('ok');
        expect(status.identity.handle).toBe('testuser');
    });
});
```

### 4.2 E2EE 对话场景

**测试文件**: `tests/scenarios/e2ee-conversation.test.js`

```javascript
describe('E2EE Conversation Scenario (Multi-round)', () => {
    it('should complete 20-round encrypted conversation', async () => {
        const aliceCredential = 'alice_test';
        const bobCredential = 'bob_test';
        
        // 准备：创建两个用户
        await runCli(`node scripts/setup_identity.js --name ${aliceCredential}`);
        await runCli(`node scripts/setup_identity.js --name ${bobCredential}`);
        
        // 第 1-20 轮：多轮加密对话
        for (let i = 1; i <= 20; i++) {
            const sender = i % 2 === 1 ? aliceCredential : bobCredential;
            const receiver = i % 2 === 1 ? 'bob' : 'alice';
            const message = `Round ${i} message from ${sender}`;
            
            // 发送加密消息
            const { stdout: sendOutput } = await runCli(
                `node scripts/e2ee_messaging.js --credential ${sender} --send ${receiver} --content "${message}"`
            );
            expect(sendOutput).toContain('Encrypted message sent');
            
            // 接收并解密
            const { stdout: receiveOutput } = await runCli(
                `node scripts/e2ee_messaging.js --credential ${receiver} --process --peer ${sender}`
            );
            expect(receiveOutput).toContain('Decrypted');
        }
    });

    it('should handle session expiration mid-conversation', async () => {
        // 创建两个用户
        await runCli('node scripts/setup_identity.js --name Alice');
        await runCli('node scripts/setup_identity.js --name Bob');
        
        // 第 1-5 轮：正常对话
        for (let i = 1; i <= 5; i++) {
            await runCli(
                `node scripts/e2ee_messaging.js --credential Alice --send bob --content "Message ${i}"`
            );
        }
        
        // 模拟会话过期（修改 E2EE 状态文件）
        await expireE2eeSession('Alice');
        
        // 第 6 轮：应该触发重新握手
        const { stdout } = await runCli(
            'node scripts/e2ee_messaging.js --credential Alice --send bob --content "After expiry"'
        );
        expect(stdout).toContain('Re-handshake initiated');
        
        // 第 7-10 轮：恢复对话
        for (let i = 7; i <= 10; i++) {
            const { stdout: sendOutput } = await runCli(
                `node scripts/e2ee_messaging.js --credential Alice --send bob --content "Message ${i}"`
            );
            expect(sendOutput).toContain('Encrypted message sent');
        }
    });
});
```

### 4.3 群组互动场景

**测试文件**: `tests/scenarios/group-interaction.test.js`

```javascript
describe('Group Interaction Scenario (Multi-round)', () => {
    it('should complete group creation and multi-message conversation', async () => {
        // 第 1 轮：创建群组
        const { stdout: createOutput } = await runCli(
            'node scripts/manage_group.js --create --name "Test Group" --description "Test" --members "did1,did2,did3"'
        );
        expect(createOutput).toContain('Group created');
        
        const groupId = extractGroupId(createOutput);
        
        // 第 2-11 轮：发送 10 条群消息
        for (let i = 1; i <= 10; i++) {
            const { stdout } = await runCli(
                `node scripts/manage_group.js --post-message --group-id ${groupId} --content "Message ${i}"`
            );
            expect(stdout).toContain('Message sent');
        }
        
        // 第 12 轮：列出群消息
        const { stdout: listOutput } = await runCli(
            `node scripts/manage_group.js --list-messages --group-id ${groupId} --limit 10`
        );
        const messages = JSON.parse(listOutput);
        expect(messages.length).toBe(10);
        
        // 第 13 轮：列出成员
        const { stdout: membersOutput } = await runCli(
            `node scripts/manage_group.js --members --group-id ${groupId}`
        );
        const members = JSON.parse(membersOutput);
        expect(members.length).toBeGreaterThanOrEqual(1);
        
        // 第 14 轮：离开群组
        const { stdout: leaveOutput } = await runCli(
            `node scripts/manage_group.js --leave --group-id ${groupId}`
        );
        expect(leaveOutput).toContain('Left group');
    });
});
```

### 4.4 社交关系场景

**测试文件**: `tests/scenarios/relationship-flow.test.js`

```javascript
describe('Relationship Flow Scenario', () => {
    it('should complete follow/unfollow cycle', async () => {
        // 第 1 轮：关注用户
        const { stdout: followOutput } = await runCli(
            'node scripts/manage_relationship.js --follow alice'
        );
        expect(followOutput).toContain('Followed');
        
        // 第 2 轮：检查状态
        const { stdout: statusOutput } = await runCli(
            'node scripts/manage_relationship.js --status alice'
        );
        const status = JSON.parse(statusOutput);
        expect(status.following).toBe(true);
        
        // 第 3 轮：列出关注
        const { stdout: followingOutput } = await runCli(
            'node scripts/manage_relationship.js --following'
        );
        const following = JSON.parse(followingOutput);
        expect(following.some(u => u.handle === 'alice')).toBe(true);
        
        // 第 4 轮：取消关注
        const { stdout: unfollowOutput } = await runCli(
            'node scripts/manage_relationship.js --unfollow alice'
        );
        expect(unfollowOutput).toContain('Unfollowed');
        
        // 第 5 轮：再次检查状态
        const { stdout: status2Output } = await runCli(
            'node scripts/manage_relationship.js --status alice'
        );
        const status2 = JSON.parse(status2Output);
        expect(status2.following).toBe(false);
    });
});
```

---

## 5. 超时测试

### 5.1 JWT 超时测试

**测试文件**: `tests/timeout/jwt-timeout.test.js`

```javascript
describe('JWT Timeout Tests', () => {
    it('should handle JWT about to expire (5 seconds)', async () => {
        // 创建 JWT 即将过期的身份
        const identity = await createExpiringIdentity(5000);
        await saveIdentity(identity);
        
        // 立即调用 - 应该成功
        const { stdout, exitCode } = await runCli(
            'node scripts/check_status.js'
        );
        
        expect(exitCode).toBe(0);
    });

    it('should auto-refresh expired JWT', async () => {
        // 创建已过期的身份
        const identity = await createExpiringIdentity(2000);
        await saveIdentity(identity);
        
        // 等待 JWT 过期
        await sleep(3000);
        
        // 调用 - 应该自动刷新
        const { stdout, exitCode } = await runCli(
            'node scripts/check_status.js'
        );
        
        expect(exitCode).toBe(0);
        
        // 验证 JWT 已刷新
        const refreshedIdentity = await loadIdentity();
        expect(refreshedIdentity.jwtToken).not.toBe(identity.jwtToken);
    });

    it('should fail when server timeout (30+ seconds)', async () => {
        // 配置慢速服务器
        await configureSlowServer(35000);
        
        const { stderr, exitCode } = await runCli(
            'node scripts/send_message.js --to alice --content "Test"'
        );
        
        expect(exitCode).not.toBe(0);
        expect(stderr).toContain('timeout');
    });
});
```

### 5.2 E2EE 会话超时测试

**测试文件**: `tests/timeout/e2ee-session-timeout.test.js`

```javascript
describe('E2EE Session Timeout Tests', () => {
    it('should handle expired E2EE session (5 minutes)', async () => {
        // 创建两个用户并建立会话
        await runCli('node scripts/setup_identity.js --name Alice');
        await runCli('node scripts/setup_identity.js --name Bob');
        
        // 发送一条消息建立会话
        await runCli('node scripts/e2ee_messaging.js --credential Alice --send bob --content "Hello"');
        
        // 模拟会话过期（5 分钟后）
        await expireE2eeSession('Alice');
        
        // 尝试发送 - 应该自动重新握手
        const { stdout } = await runCli(
            'node scripts/e2ee_messaging.js --credential Alice --send bob --content "After expiry"'
        );
        
        expect(stdout).toContain('Re-handshake');
    });

    it('should handle proof expiration (1 hour)', async () => {
        // 创建过期的 proof
        const expiredContent = createExpiredProof(3600);
        
        // 处理应该返回错误
        const { stderr } = await runCli(
            `node scripts/e2ee_messaging.js --process-expired '${JSON.stringify(expiredContent)}'`
        );
        
        expect(stderr).toContain('proof_expired');
    });
});
```

---

## 6. Python ↔ JS 交叉测试

### 6.1 CLI 功能对等测试

**测试文件**: `tests/interop/cli-interop.test.js`

```javascript
describe('CLI Interop (Python ↔ JS)', () => {
    it('should produce same output for check_status', async () => {
        // Python 版本
        const { stdout: pyStdout } = await runCli(
            'python scripts/check_status.py'
        );
        
        // JS 版本
        const { stdout: jsStdout } = await runCli(
            'node scripts/check_status.js'
        );
        
        // 比较关键字段
        const pyStatus = JSON.parse(pyStdout);
        const jsStatus = JSON.parse(jsStdout);
        
        expect(pyStatus.version).toBeDefined();
        expect(jsStatus.version).toBeDefined();
        expect(pyStatus.identity.status).toBe(jsStatus.identity.status);
    });

    it('should produce same output for send_message', async () => {
        // Python 版本
        const { stdout: pyStdout } = await runCli(
            'python scripts/send_message.py --to alice --content "Test"'
        );
        
        // JS 版本
        const { stdout: jsStdout } = await runCli(
            'node scripts/send_message.js --to alice --content "Test"'
        );
        
        // 比较输出结构
        const pyResult = parseSendOutput(pyStdout);
        const jsResult = parseSendOutput(jsStdout);
        
        expect(pyResult).toHaveProperty('messageId');
        expect(jsResult).toHaveProperty('messageId');
    });
});
```

### 6.2 E2EE 交叉测试

**测试文件**: `tests/interop/e2ee-interop.test.js`

```javascript
describe('E2EE Interop (Python ↔ JS)', () => {
    it('should decrypt JS-encrypted message in Python', async () => {
        // JS 加密
        const { stdout: jsOutput } = await runCli(
            'node scripts/e2ee_messaging.js --send alice --content "From JS" --export-encrypted'
        );
        const encryptedContent = JSON.parse(jsOutput);
        
        // Python 解密
        const { stdout: pyOutput } = await runCli(
            `python scripts/e2ee_messaging.py --decrypt '${JSON.stringify(encryptedContent)}'`
        );
        
        expect(pyOutput).toContain('From JS');
    });

    it('should decrypt Python-encrypted message in JS', async () => {
        // Python 加密
        const { stdout: pyOutput } = await runCli(
            'python scripts/e2ee_messaging.py --send alice --content "From Python" --export-encrypted'
        );
        const encryptedContent = JSON.parse(pyOutput);
        
        // JS 解密
        const { stdout: jsOutput } = await runCli(
            `node scripts/e2ee_messaging.js --decrypt '${JSON.stringify(encryptedContent)}'`
        );
        
        expect(jsOutput).toContain('From Python');
    });

    it('should complete 10-round Python↔JS conversation', async () => {
        for (let i = 1; i <= 10; i++) {
            const isJsTurn = i % 2 === 1;
            
            if (isJsTurn) {
                // JS -> Python
                const { stdout: jsOutput } = await runCli(
                    `node scripts/e2ee_messaging.js --send alice --content "Round ${i} JS" --export-encrypted`
                );
                const encrypted = JSON.parse(jsOutput);
                
                const { stdout: pyOutput } = await runCli(
                    `python scripts/e2ee_messaging.py --decrypt '${JSON.stringify(encrypted)}'`
                );
                expect(pyOutput).toContain(`Round ${i} JS`);
            } else {
                // Python -> JS
                const { stdout: pyOutput } = await runCli(
                    `python scripts/e2ee_messaging.py --send alice --content "Round ${i} Python" --export-encrypted`
                );
                const encrypted = JSON.parse(pyOutput);
                
                const { stdout: jsOutput } = await runCli(
                    `node scripts/e2ee_messaging.js --decrypt '${JSON.stringify(encrypted)}'`
                );
                expect(jsOutput).toContain(`Round ${i} Python`);
            }
        }
    });
});
```

---

## 7. SKILL.md 规范验证

### 7.1 YAML Frontmatter 验证

**测试文件**: `tests/spec/skill-md.test.js`

```javascript
describe('SKILL.md Specification', () => {
    it('should have valid YAML frontmatter', () => {
        const skillMd = fs.readFileSync('SKILL.md', 'utf-8');
        const frontmatter = extractFrontmatter(skillMd);
        
        expect(frontmatter).toBeDefined();
        expect(frontmatter.name).toBeDefined();
        expect(frontmatter.description).toBeDefined();
    });

    it('should have valid name format', () => {
        const skillMd = fs.readFileSync('SKILL.md', 'utf-8');
        const frontmatter = extractFrontmatter(skillMd);
        
        // 1-64 字符
        expect(frontmatter.name.length).toBeGreaterThanOrEqual(1);
        expect(frontmatter.name.length).toBeLessThanOrEqual(64);
        
        // 仅小写字母、数字、连字符
        expect(frontmatter.name).toMatch(/^[a-z0-9-]+$/);
        
        // 不以连字符开头或结尾
        expect(frontmatter.name).not.toMatch(/^-/);
        expect(frontmatter.name).not.toMatch(/-$/);
        
        // 无连续连字符
        expect(frontmatter.name).not.toMatch(/--/);
    });

    it('should have valid description', () => {
        const skillMd = fs.readFileSync('SKILL.md', 'utf-8');
        const frontmatter = extractFrontmatter(skillMd);
        
        // 1-1024 字符
        expect(frontmatter.description.length).toBeGreaterThanOrEqual(1);
        expect(frontmatter.description.length).toBeLessThanOrEqual(1024);
    });

    it('should use skills-ref validate', async () => {
        const { stdout, exitCode } = await runCli(
            'skills-ref validate .'
        );
        
        expect(exitCode).toBe(0);
    });
});
```

---

## 8. 测试覆盖率要求

| 脚本类型 | 语句覆盖率 | 分支覆盖率 | 行覆盖率 |
|----------|-----------|-----------|---------|
| CLI 脚本 | ≥85% | ≥80% | ≥85% |
| 场景测试 | ≥80% | ≥75% | ≥80% |
| 交叉测试 | ≥90% | ≥85% | ≥90% |

---

## 9. 测试执行

### 9.1 CLI 测试

```bash
# 运行所有 CLI 测试
npm test -- tests/cli/

# 运行特定脚本测试
npm test -- tests/cli/send_message.test.js
```

### 9.2 场景测试

```bash
# 运行所有场景测试
npm test -- tests/scenarios/

# 运行特定场景
npm test -- tests/scenarios/e2ee-conversation.test.js
```

### 9.3 交叉测试

```bash
# 启动 Python 环境
source venv/bin/activate

# 运行交叉测试
npm test -- tests/interop/
```

### 9.4 超时测试

```bash
# 运行超时测试
npm test -- tests/timeout/

# 运行特定超时测试
npm test -- tests/timeout/jwt-timeout.test.js
```

---

## 10. CI/CD 集成

```yaml
# .github/workflows/skill-test.yml
name: Skill Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        python-version: ['3.10', '3.11']
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install Node dependencies
      run: npm ci
    
    - name: Install Python dependencies
      run: pip install -r requirements.txt
    
    - name: Run CLI tests
      run: npm test -- tests/cli/
    
    - name: Run scenario tests
      run: npm test -- tests/scenarios/
    
    - name: Run interop tests
      run: npm test -- tests/interop/
    
    - name: Validate SKILL.md
      run: npx skills-ref validate .
    
    - name: Check coverage
      run: npm test -- --coverage
```

---

## 11. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Python/JS 环境不一致 | 高 | 中 | Docker 容器化测试环境 |
| 交叉测试时间长 | 高 | 高 | 并行执行，设置超时 |
| awiki.ai 服务不稳定 | 高 | 中 | 使用 mock + 真实服务混合 |
| 多轮测试状态管理复杂 | 中 | 高 | 每个测试独立凭证 |
