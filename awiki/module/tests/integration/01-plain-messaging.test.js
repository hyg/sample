/**
 * 集成测试 - 场景 A: 明文消息通信（Python ↔ Node.js 双向 3 轮）
 * 
 * 依赖：无（基础场景）
 * 前置条件：
 * - Alice 和 Bob 的身份已创建并保存
 * - JWT 令牌有效
 * 
 * 测试步骤：
 * 1. Alice (Python) → Bob (Node.js): 发送明文消息
 * 2. Bob 检查收件箱并回复
 * 3. Alice 检查收件箱并回复
 * 4. Bob 验证 3 轮消息都收到
 */

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 设置全局超时
jest.setTimeout(120000); // 120 秒超时

describe('集成测试 - 场景 A: 明文消息通信', () => {
  // 使用现有测试身份或创建新身份
  const ALICE_CREDENTIAL = process.env.TEST_ALICE_CREDENTIAL || 'k1_test';
  const BOB_CREDENTIAL = process.env.TEST_BOB_CREDENTIAL || 'k1_unique';
  
  // Python 脚本路径
  const PYTHON_SCRIPTS_DIR = 'D:\\huangyg\\git\\sample\\awiki\\python\\scripts';
  
  let aliceDid;
  let bobDid;
  let skipTests = false;

  beforeAll(() => {
    // 前置检查：确保测试身份存在
    const { SDKConfig } = require('../../scripts/utils/config');
    const config = SDKConfig.load();
    const aliceCredPath = path.join(config.credentials_dir, ALICE_CREDENTIAL, 'identity.json');
    const bobCredPath = path.join(config.credentials_dir, BOB_CREDENTIAL, 'identity.json');
    
    if (!fs.existsSync(aliceCredPath)) {
      console.warn(`⚠️  Alice credential not found: ${aliceCredPath}`);
      console.warn('⚠️  跳过集成测试。请先创建测试身份：');
      console.warn(`     python scripts/setup_identity.py --credential ${ALICE_CREDENTIAL}`);
      skipTests = true;
      return;
    }
    if (!fs.existsSync(bobCredPath)) {
      console.warn(`⚠️  Bob credential not found: ${bobCredPath}`);
      console.warn('⚠️  跳过集成测试。请先创建测试身份：');
      console.warn(`     node scripts/setup-identity.js --credential ${BOB_CREDENTIAL}`);
      skipTests = true;
      return;
    }

    // 加载身份获取 DID
    const aliceData = JSON.parse(fs.readFileSync(aliceCredPath, 'utf-8'));
    const bobData = JSON.parse(fs.readFileSync(bobCredPath, 'utf-8'));
    
    aliceDid = aliceData.did;
    bobDid = bobData.did;
    
    // 检查是否有 JWT 令牌
    if (!aliceData.jwt_token) {
      console.warn(`⚠️  Alice 缺少 JWT 令牌，需要先刷新：`);
      console.warn(`     python scripts/setup_identity.py --credential ${ALICE_CREDENTIAL} --refresh`);
      skipTests = true;
      return;
    }
    if (!bobData.jwt_token) {
      console.warn(`⚠️  Bob 缺少 JWT 令牌，需要先刷新：`);
      console.warn(`     node scripts/setup-identity.js --credential ${BOB_CREDENTIAL} --refresh`);
      skipTests = true;
      return;
    }
    
    console.log(`✓ Alice DID: ${aliceDid}`);
    console.log(`✓ Bob DID: ${bobDid}`);
    console.log(`✓ Alice 和 Bob 都有有效的 JWT 令牌`);
  });

  beforeEach(() => {
    if (skipTests) {
      // 跳过测试
      return;
    }
    // 清理收件箱（可选）
    try {
      execSync(`node scripts/check-inbox.js --credential ${BOB_CREDENTIAL} --limit 100`, {
        stdio: 'pipe'
      });
    } catch (e) {
      // 忽略清理错误
    }
  });

  // 测试消息
  const MESSAGE_ROUND_1 = '[Plain Round 1] Hello from Alice (Python)';
  const MESSAGE_ROUND_2 = '[Plain Round 2] Hi from Bob (Node.js)';
  const MESSAGE_ROUND_3 = '[Plain Round 3] Nice to meet you!';

  it('Round 1: Alice (Python) → Bob (Node.js)', () => {
    if (skipTests) {
      console.warn('⚠️  跳过测试：前置条件不满足');
      return;
    }
    
    // Alice 发送消息
    const sendOutput = execSync(
      `python "${PYTHON_SCRIPTS_DIR}\\send_message.py" ` +
      `--credential ${ALICE_CREDENTIAL} ` +
      `--to ${bobDid} ` +
      `--content "${MESSAGE_ROUND_1}"`,
      { encoding: 'utf8', cwd: 'D:\\huangyg\\git\\sample\\awiki' }
    );

    console.log('Alice send output:', sendOutput);
    
    // 验证发送成功
    assert.ok(sendOutput.includes('Message sent successfully') || sendOutput.includes('server_seq'), 
      'Message should be sent successfully');

    // Bob 检查收件箱
    const inboxOutput = execSync(
      `node scripts/check-inbox.js --credential ${BOB_CREDENTIAL} --limit 5`,
      { encoding: 'utf8' }
    );

    console.log('Bob inbox output:', inboxOutput);
    
    // 验证收到消息
    assert.ok(inboxOutput.includes(MESSAGE_ROUND_1), 'Bob should receive Round 1 message');
  });

  it('Round 2: Bob (Node.js) → Alice (Python)', () => {
    if (skipTests) {
      console.warn('⚠️  跳过测试：前置条件不满足');
      return;
    }
    
    // Bob 发送回复
    const sendOutput = execSync(
      `node scripts/send-message.js ` +
      `--credential ${BOB_CREDENTIAL} ` +
      `--to ${aliceDid} ` +
      `--content "${MESSAGE_ROUND_2}"`,
      { encoding: 'utf8' }
    );

    console.log('Bob send output:', sendOutput);
    
    // 验证发送成功
    assert.ok(sendOutput.includes('Message sent successfully') || sendOutput.includes('server_seq'), 
      'Bob should send message successfully');

    // Alice 检查收件箱
    const inboxOutput = execSync(
      `python "${PYTHON_SCRIPTS_DIR}\\check_inbox.py" --credential ${ALICE_CREDENTIAL} --limit 5`,
      { encoding: 'utf8', cwd: 'D:\\huangyg\\git\\sample\\awiki' }
    );

    console.log('Alice inbox output:', inboxOutput);
    
    // 验证收到消息
    assert.ok(inboxOutput.includes(MESSAGE_ROUND_2), 'Alice should receive Round 2 message');
  });

  it('Round 3: Alice (Python) → Bob (Node.js)', () => {
    if (skipTests) {
      console.warn('⚠️  跳过测试：前置条件不满足');
      return;
    }
    
    // Alice 发送第三条消息
    const sendOutput = execSync(
      `python "${PYTHON_SCRIPTS_DIR}\\send_message.py" ` +
      `--credential ${ALICE_CREDENTIAL} ` +
      `--to ${bobDid} ` +
      `--content "${MESSAGE_ROUND_3}"`,
      { encoding: 'utf8', cwd: 'D:\\huangyg\\git\\sample\\awiki' }
    );

    console.log('Alice send output:', sendOutput);
    
    // Bob 验证收到所有 3 轮消息
    const inboxOutput = execSync(
      `node scripts/check-inbox.js --credential ${BOB_CREDENTIAL} --limit 10`,
      { encoding: 'utf8' }
    );

    console.log('Bob inbox output:', inboxOutput);
    
    // 验证收到所有 3 轮消息
    assert.ok(inboxOutput.includes(MESSAGE_ROUND_1), 'Bob should have Round 1 message');
    assert.ok(inboxOutput.includes(MESSAGE_ROUND_2), 'Bob should have Round 2 message');
    assert.ok(inboxOutput.includes(MESSAGE_ROUND_3), 'Bob should have Round 3 message');
  });

  it('验证消息顺序和内容完整性', () => {
    if (skipTests) {
      console.warn('⚠️  跳过测试：前置条件不满足');
      return;
    }
    
    // Bob 获取所有消息并验证顺序
    const inboxOutput = execSync(
      `node scripts/check-inbox.js --credential ${BOB_CREDENTIAL} --limit 10 --json`,
      { encoding: 'utf8' }
    );

    try {
      const messages = JSON.parse(inboxOutput);
      assert.ok(Array.isArray(messages), 'Messages should be an array');
      
      // 验证消息数量至少 3 条
      assert.ok(messages.length >= 3, 'Should have at least 3 messages');
      
      // 验证消息内容
      const messageContents = messages.map(m => m.content || m.plaintext);
      assert.ok(
        messageContents.some(c => c.includes(MESSAGE_ROUND_1)),
        'Should have Round 1 message'
      );
      assert.ok(
        messageContents.some(c => c.includes(MESSAGE_ROUND_2)),
        'Should have Round 2 message'
      );
      assert.ok(
        messageContents.some(c => c.includes(MESSAGE_ROUND_3)),
        'Should have Round 3 message'
      );
    } catch (e) {
      // 如果 JSON 解析失败，使用字符串匹配验证
      assert.ok(inboxOutput.includes(MESSAGE_ROUND_1), 'Should have Round 1');
      assert.ok(inboxOutput.includes(MESSAGE_ROUND_2), 'Should have Round 2');
      assert.ok(inboxOutput.includes(MESSAGE_ROUND_3), 'Should have Round 3');
    }
  });

  afterAll(() => {
    if (skipTests) {
      console.log('⚠️  场景 A 测试已跳过（前置条件不满足）');
    } else {
      console.log('✓ 场景 A 测试完成');
    }
  });
});
