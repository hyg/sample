/**
 * CLI 命令参数覆盖测试
 * 
 * 测试所有 CLI 命令的所有参数组合
 * 
 * 注意：Mock 服务器由 run_all.js 统一启动和停止
 */

import { suite, run_cli, assert } from './test_utils.js';
import { clear_storage, get_storage } from './mocks/mock_server.js';

// 测试套件
const cli_tests = suite('CLI 命令参数测试');

// 在每个测试前清理存储
cli_tests.before_each(() => {
  clear_storage();
});

// 在每个测试后清理
cli_tests.after_each(() => {
  clear_storage();
});

// ============================================
// check_status.js 测试
// ============================================

cli_tests.test('check_status: 基本调用（无参数）', async () => {
  const result = await run_cli('check_status.js', []);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Checking awiki status/);
  assert.match(result.stdout, /Configuration:/);
  assert.match(result.stdout, /DID Domain:/);
  assert.match(result.stdout, /Identity:/);
  assert.match(result.stdout, /Clients:/);
});

cli_tests.test('check_status: --upgrade-only 参数', async () => {
  const result = await run_cli('check_status.js', ['--upgrade-only']);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Checking awiki status/);
  assert.match(result.stdout, /Upgrade check completed/);
});

// ============================================
// setup_identity.js 测试
// ============================================

cli_tests.test('setup_identity: --name 参数（必需）', async () => {
  const result = await run_cli('setup_identity.js', ['--name', 'Alice']);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Creating identity for: Alice/);
  assert.match(result.stdout, /✅ Identity created successfully/);
  assert.match(result.stdout, /DID: did:wba:/);
  assert.match(result.stdout, /Unique ID:/);
});

cli_tests.test('setup_identity: 缺少 --name 的错误处理', async () => {
  const result = await run_cli('setup_identity.js', []);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--name/);
});

// ============================================
// register_handle.js 测试
// ============================================

cli_tests.test('register_handle: --handle + --phone（步骤 1：发送 OTP）', async () => {
  // 先创建身份
  await run_cli('setup_identity.js', ['--name', 'Bob']);
  
  const result = await run_cli('register_handle.js', [
    '--handle', 'bob',
    '--phone', '+8613800138000'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Registering Handle: @bob/);
  assert.match(result.stdout, /Sending OTP to:/);
  assert.match(result.stdout, /✅ OTP sent successfully/);
});

cli_tests.test('register_handle: --handle + --otp-code（步骤 2：完成注册）', async () => {
  // 先创建身份并发送 OTP
  await run_cli('setup_identity.js', ['--name', 'Charlie']);
  await run_cli('register_handle.js', [
    '--handle', 'charlie',
    '--phone', '+8613900139000'
  ]);
  
  // 从 Mock 服务器获取 OTP
  const storage = get_storage();
  const otp_code = storage.otp_codes.get('+8613900139000');
  
  const result = await run_cli('register_handle.js', [
    '--handle', 'charlie',
    '--otp-code', otp_code
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Completing Handle registration: @charlie/);
  assert.match(result.stdout, /✅ Handle registered successfully/);
  assert.match(result.stdout, /Handle: @charlie/);
});

cli_tests.test('register_handle: 缺少 --handle 的错误处理', async () => {
  const result = await run_cli('register_handle.js', [
    '--phone', '+8613800138000'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--handle/);
});

cli_tests.test('register_handle: 缺少 --phone 和 --otp-code 的错误处理', async () => {
  const result = await run_cli('register_handle.js', [
    '--handle', 'test'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: Either --phone or --otp-code must be provided/);
});

// ============================================
// send_message.js 测试
// ============================================

cli_tests.test('send_message: --to + --content（基本消息）', async () => {
  // 先创建身份
  await run_cli('setup_identity.js', ['--name', 'David']);
  
  // 创建接收者
  await run_cli('setup_identity.js', ['--name', 'Eve']);
  const eve_result = await run_cli('register_handle.js', [
    '--handle', 'eve',
    '--phone', '+8614000140000'
  ]);
  const storage = get_storage();
  const otp = storage.otp_codes.get('+8614000140000');
  await run_cli('register_handle.js', [
    '--handle', 'eve',
    '--otp-code', otp
  ]);
  
  const result = await run_cli('send_message.js', [
    '--to', 'eve',
    '--content', 'Hello Eve!'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Sending message to: eve/);
  assert.match(result.stdout, /Content: Hello Eve!/);
  assert.match(result.stdout, /✅ Message sent successfully/);
  assert.match(result.stdout, /Message ID:/);
});

cli_tests.test('send_message: --to + --content + --e2ee（加密消息）', async () => {
  // 先创建身份
  await run_cli('setup_identity.js', ['--name', 'Frank']);
  
  // 创建接收者
  await run_cli('setup_identity.js', ['--name', 'Grace']);
  const grace_result = await run_cli('register_handle.js', [
    '--handle', 'grace',
    '--phone', '+8614100141000'
  ]);
  const storage = get_storage();
  const otp = storage.otp_codes.get('+8614100141000');
  await run_cli('register_handle.js', [
    '--handle', 'grace',
    '--otp-code', otp
  ]);
  
  const result = await run_cli('send_message.js', [
    '--to', 'grace',
    '--content', 'Secret message',
    '--e2ee'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Sending message to: grace/);
  assert.match(result.stdout, /Encryption: E2EE enabled/);
  assert.match(result.stdout, /Sending E2EE encrypted message/);
});

cli_tests.test('send_message: 缺少 --to 的错误处理', async () => {
  await run_cli('setup_identity.js', ['--name', 'Test']);
  
  const result = await run_cli('send_message.js', [
    '--content', 'Hello'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--to/);
});

cli_tests.test('send_message: 缺少 --content 的错误处理', async () => {
  await run_cli('setup_identity.js', ['--name', 'Test']);
  
  const result = await run_cli('send_message.js', [
    '--to', 'someone'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--content/);
});

cli_tests.test('send_message: 无身份时的错误处理', async () => {
  // 不创建身份直接发送
  const result = await run_cli('send_message.js', [
    '--to', 'someone',
    '--content', 'Hello'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: No identity found/);
});

// ============================================
// check_inbox.js 测试
// ============================================

cli_tests.test('check_inbox: 基本调用（无参数）', async () => {
  await run_cli('setup_identity.js', ['--name', 'InboxUser']);
  
  const result = await run_cli('check_inbox.js', []);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Checking inbox/);
  assert.match(result.stdout, /Limit: 10/);
});

cli_tests.test('check_inbox: --limit 参数', async () => {
  await run_cli('setup_identity.js', ['--name', 'InboxUser2']);
  
  const result = await run_cli('check_inbox.js', ['--limit', '20']);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Limit: 20/);
});

cli_tests.test('check_inbox: --history 参数', async () => {
  await run_cli('setup_identity.js', ['--name', 'InboxUser3']);
  
  const result = await run_cli('check_inbox.js', [
    '--history', 'alice'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Checking chat history with: alice/);
});

cli_tests.test('check_inbox: 无身份时的错误处理', async () => {
  const result = await run_cli('check_inbox.js', []);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: No identity found/);
});

// ============================================
// e2ee_messaging.js 测试
// ============================================

cli_tests.test('e2ee_messaging: --send + --content（发送加密消息）', async () => {
  await run_cli('setup_identity.js', ['--name', 'E2EESender']);
  
  // 创建接收者
  await run_cli('setup_identity.js', ['--name', 'E2EEReceiver']);
  const recv_result = await run_cli('register_handle.js', [
    '--handle', 'e2eerecv',
    '--phone', '+8614200142000'
  ]);
  const storage = get_storage();
  const otp = storage.otp_codes.get('+8614200142000');
  await run_cli('register_handle.js', [
    '--handle', 'e2eerecv',
    '--otp-code', otp
  ]);
  
  const result = await run_cli('e2ee_messaging.js', [
    '--send', 'e2eerecv',
    '--content', 'Encrypted message'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Sending E2EE encrypted message to: e2eerecv/);
  assert.match(result.stdout, /Content: Encrypted message/);
  assert.match(result.stdout, /✅ E2EE message sent successfully/);
});

cli_tests.test('e2ee_messaging: --process + --peer（处理加密消息）', async () => {
  await run_cli('setup_identity.js', ['--name', 'Processor']);
  
  const result = await run_cli('e2ee_messaging.js', [
    '--process',
    '--peer', 'someone'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Processing E2EE messages from: someone/);
});

cli_tests.test('e2ee_messaging: --retry（重试失败消息）', async () => {
  await run_cli('setup_identity.js', ['--name', 'Retrier']);
  
  const result = await run_cli('e2ee_messaging.js', [
    '--retry', 'outbox_123'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Retrying failed message: outbox_123/);
});

cli_tests.test('e2ee_messaging: 缺少必需参数的错误处理', async () => {
  await run_cli('setup_identity.js', ['--name', 'Test']);
  
  const result = await run_cli('e2ee_messaging.js', []);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--send/);
  assert.match(result.stdout, /--process/);
  assert.match(result.stdout, /--retry/);
});

cli_tests.test('e2ee_messaging: --process 缺少 --peer 的错误处理', async () => {
  await run_cli('setup_identity.js', ['--name', 'Test']);
  
  const result = await run_cli('e2ee_messaging.js', [
    '--process'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: --peer is required/);
});

// ============================================
// manage_group.js 测试
// ============================================

cli_tests.test('manage_group: --create + --name + --description（创建群组）', async () => {
  await run_cli('setup_identity.js', ['--name', 'GroupCreator']);
  
  const result = await run_cli('manage_group.js', [
    '--create',
    '--name', 'Test Group',
    '--description', 'A test group'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Creating group: Test Group/);
  assert.match(result.stdout, /Description: A test group/);
  assert.match(result.stdout, /✅ Group created successfully/);
  assert.match(result.stdout, /Group ID:/);
  assert.match(result.stdout, /Join Code:/);
});

cli_tests.test('manage_group: --join + --join-code（加入群组）', async () => {
  // 先创建群组
  await run_cli('setup_identity.js', ['--name', 'Joiner']);
  
  // 创建另一个用户来创建群组
  await run_cli('setup_identity.js', ['--name', 'GroupOwner']);
  const owner_result = await run_cli('manage_group.js', [
    '--create',
    '--name', 'Joinable Group',
    '--description', 'Can join'
  ]);
  
  // 提取 Join Code
  const join_code_match = owner_result.stdout.match(/Join Code: (\d+)/);
  assert.ok(join_code_match, '应该包含 Join Code');
  const join_code = join_code_match[1];
  
  // 加入群组
  const result = await run_cli('manage_group.js', [
    '--join',
    '--join-code', join_code
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Joining group with code: ${join_code}/);
  assert.match(result.stdout, /✅ Joined group successfully/);
  assert.match(result.stdout, /Group ID:/);
  assert.match(result.stdout, /Group Name:/);
});

cli_tests.test('manage_group: --post-message + --group-id + --content（发送群消息）', async () => {
  // 先创建群组
  await run_cli('setup_identity.js', ['--name', 'GroupMember']);
  
  const create_result = await run_cli('manage_group.js', [
    '--create',
    '--name', 'Message Group',
    '--description', 'For messages'
  ]);
  
  // 提取 Group ID
  const group_id_match = create_result.stdout.match(/Group ID: (group_\d+)/);
  assert.ok(group_id_match, '应该包含 Group ID');
  const group_id = group_id_match[1];
  
  // 发送群消息
  const result = await run_cli('manage_group.js', [
    '--post-message',
    '--group-id', group_id,
    '--content', 'Hello group!'
  ]);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Posting message to group: ${group_id}/);
  assert.match(result.stdout, /Content: Hello group!/);
  assert.match(result.stdout, /✅ Message posted successfully/);
  assert.match(result.stdout, /Message ID:/);
});

cli_tests.test('manage_group: --list（列出群组）', async () => {
  await run_cli('setup_identity.js', ['--name', 'GroupLister']);
  
  const result = await run_cli('manage_group.js', ['--list']);
  
  assert.ok(result.success, `命令执行失败：${result.stderr}`);
  assert.match(result.stdout, /Listing your groups/);
});

cli_tests.test('manage_group: --create 缺少 --name 的错误处理', async () => {
  await run_cli('setup_identity.js', ['--name', 'Test']);
  
  const result = await run_cli('manage_group.js', [
    '--create',
    '--description', 'No name'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: --name is required/);
});

cli_tests.test('manage_group: --join 缺少 --join-code 的错误处理', async () => {
  await run_cli('setup_identity.js', ['--name', 'Test']);
  
  const result = await run_cli('manage_group.js', ['--join']);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: --join-code is required/);
});

cli_tests.test('manage_group: --post-message 缺少参数的错误处理', async () => {
  await run_cli('setup_identity.js', ['--name', 'Test']);
  
  const result = await run_cli('manage_group.js', [
    '--post-message',
    '--group-id', 'group_1'
  ]);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: --group-id and --content are required/);
});

cli_tests.test('manage_group: 无身份时的错误处理', async () => {
  const result = await run_cli('manage_group.js', ['--list']);
  
  assert.ok(!result.success, '应该失败但没有失败');
  assert.match(result.stdout, /Error: No identity found/);
});

// ============================================
// 运行所有测试
// ============================================

async function run_all_tests() {
  console.log('开始运行 CLI 命令参数覆盖测试...\n');
  
  const results = await cli_tests.run();
  
  // 统计结果
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  
  console.log('\n========================================');
  console.log('CLI 命令参数覆盖测试结果');
  console.log('========================================');
  console.log(`总测试数：${total}`);
  console.log(`通过：${passed}`);
  console.log(`失败：${failed}`);
  console.log(`通过率：${((passed / total) * 100).toFixed(2)}%`);
  console.log('========================================\n');
  
  // 输出失败的测试
  if (failed > 0) {
    console.log('失败的测试:\n');
    for (const result of results) {
      if (!result.passed) {
        console.log(`❌ ${result.name}`);
        if (result.error) {
          console.log(`   错误：${result.error.message}`);
        }
      }
    }
    console.log('');
  }
  
  return {
    total,
    passed,
    failed,
    results,
  };
}

// 导出
export { run_all_tests, cli_tests };

// 如果直接运行
if (process.argv[1]?.includes('cli_params.test.js')) {
  console.error('此测试文件应该通过 run_all.js 运行，而不是直接运行');
  process.exit(1);
}
