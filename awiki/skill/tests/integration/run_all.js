/**
 * 集成测试主运行器
 * 
 * 运行所有集成测试并生成报告
 * 
 * 架构说明：
 * 1. 启动 Mock 服务器（在所有测试之前）
 * 2. 设置环境变量指向 Mock 服务器
 * 3. 运行所有测试
 * 4. 停止 Mock 服务器
 * 5. 生成报告
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 先启动 Mock 服务器并设置环境变量
import { 
  start_mock_server, 
  stop_mock_server,
  MOCK_PORT 
} from './mocks/mock_server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORT_PATH = join(__dirname, 'REPORT.md');
const MOCK_URL = `http://localhost:${MOCK_PORT}`;

// 设置全局环境变量
process.env.E2E_USER_SERVICE_URL = MOCK_URL;
process.env.E2E_MOLT_MESSAGE_URL = MOCK_URL;
process.env.E2E_MOLT_MESSAGE_WS_URL = MOCK_URL;
process.env.E2E_DID_DOMAIN = 'localhost';

console.log('Mock 服务器 URL:', MOCK_URL);
console.log('环境变量已设置:');
console.log('  E2E_USER_SERVICE_URL:', process.env.E2E_USER_SERVICE_URL);
console.log('  E2E_MOLT_MESSAGE_URL:', process.env.E2E_MOLT_MESSAGE_URL);

// 现在导入测试模块（它们会使用已设置的环境变量）
import { run_all_tests as run_cli_tests } from './cli_params.test.js';
import { run_all_tests as run_workflow_tests } from './workflow.test.js';
import { run_all_tests as run_multi_party_tests } from './multi_party.test.js';

/**
 * 生成完整的测试报告
 */
function generate_full_report(cli_results, workflow_results, multi_party_results) {
  const total_tests = cli_results.total + workflow_results.total + multi_party_results.total;
  const total_passed = cli_results.passed + workflow_results.passed + multi_party_results.passed;
  const total_failed = total_tests - total_passed;
  const pass_rate = total_tests > 0 ? ((total_passed / total_tests) * 100).toFixed(2) : 0;

  // CLI 命令覆盖率计算
  const cli_commands = [
    'check_status.js',
    'setup_identity.js',
    'register_handle.js',
    'send_message.js',
    'check_inbox.js',
    'e2ee_messaging.js',
    'manage_group.js',
  ];
  
  const cli_params = {
    'check_status.js': ['无参数', '--upgrade-only'],
    'setup_identity.js': ['--name', '缺少 --name'],
    'register_handle.js': ['--handle + --phone', '--handle + --otp-code', '缺少 --handle', '缺少 --phone/--otp-code'],
    'send_message.js': ['--to + --content', '--to + --content + --e2ee', '缺少 --to', '缺少 --content', '无身份'],
    'check_inbox.js': ['无参数', '--limit', '--history', '无身份'],
    'e2ee_messaging.js': ['--send + --content', '--process + --peer', '--retry', '缺少参数', '--process 缺少 --peer'],
    'manage_group.js': ['--create + --name + --description', '--join + --join-code', '--post-message + --group-id + --content', '--list', '缺少 --name', '缺少 --join-code', '缺少参数', '无身份'],
  };

  let total_params = 0;
  let covered_params = 0;
  
  for (const cmd of cli_commands) {
    const params = cli_params[cmd] || [];
    total_params += params.length;
    // 根据测试结果计算覆盖率
    const cmd_results = cli_results.results.filter(r => r.name.includes(cmd.split('.')[0]));
    const covered = cmd_results.filter(r => r.passed).length;
    covered_params += Math.min(covered, params.length);
  }

  const cli_coverage = total_params > 0 ? ((covered_params / total_params) * 100).toFixed(2) : 0;

  // 业务场景通过率
  const workflow_pass_rate = workflow_results.total > 0 
    ? ((workflow_results.passed / workflow_results.total) * 100).toFixed(2) 
    : 0;
  
  const multi_party_pass_rate = multi_party_results.total > 0 
    ? ((multi_party_results.passed / multi_party_results.total) * 100).toFixed(2) 
    : 0;

  // 收集主要问题
  const issues = [];
  
  for (const result of [...cli_results.results, ...workflow_results.results, ...multi_party_results.results]) {
    if (!result.passed && result.error) {
      issues.push({
        test: result.name,
        error: result.error.message,
      });
    }
  }

  // 生成报告
  const report = `# 集成测试报告

**生成时间**: ${new Date().toISOString()}

**测试文件位置**: \`skill/tests/integration/\`

---

## 执行摘要

| 指标 | 数值 |
|------|------|
| 总测试用例数 | ${total_tests} |
| 通过 | ${total_passed} |
| 失败 | ${total_failed} |
| **通过率** | **${pass_rate}%** |
| CLI 命令覆盖率 | ${cli_coverage}% |
| 业务场景通过率 | ${workflow_pass_rate}% |
| 多方场景通过率 | ${multi_party_pass_rate}% |

---

## 1. CLI 命令参数覆盖测试

### 1.1 测试结果

| 指标 | 数值 |
|------|------|
| 测试用例数 | ${cli_results.total} |
| 通过 | ${cli_results.passed} |
| 失败 | ${cli_results.failed} |
| 通过率 | ${((cli_results.passed / cli_results.total) * 100).toFixed(2)}% |

### 1.2 命令覆盖详情

| 命令 | 参数组合数 | 覆盖数 | 覆盖率 |
|------|-----------|--------|--------|
${Object.entries(cli_params).map(([cmd, params]) => {
  const cmd_results = cli_results.results.filter(r => r.name.includes(cmd.split('.')[0]));
  const covered = cmd_results.filter(r => r.passed).length;
  const rate = params.length > 0 ? ((covered / params.length) * 100).toFixed(0) : 0;
  return `| ${cmd} | ${params.length} | ${covered} | ${rate}% |`;
}).join('\n')}

### 1.3 失败的测试

${cli_results.failed > 0 ? cli_results.results.filter(r => !r.passed).map(r => `
- ❌ **${r.name}**
  - 错误：${r.error?.message || '未知错误'}
`).join('\n') : '✅ 所有测试通过'}

---

## 2. 业务流程测试

### 2.1 测试结果

| 指标 | 数值 |
|------|------|
| 测试用例数 | ${workflow_results.total} |
| 通过 | ${workflow_results.passed} |
| 失败 | ${workflow_results.failed} |
| 通过率 | ${workflow_pass_rate}% |

### 2.2 测试场景

| 场景 | 描述 | 状态 |
|------|------|------|
| 完整身份创建流程 | 创建 DID → 验证 → 检查状态 | ${workflow_results.results[0]?.passed ? '✅' : '❌'} |
| 完整 Handle 注册流程 | 发送 OTP → 完成注册 → 验证 | ${workflow_results.results[1]?.passed ? '✅' : '❌'} |
| 完整消息发送流程 | 发送普通消息 → E2EE → 查看收件箱 | ${workflow_results.results[2]?.passed ? '✅' : '❌'} |
| 群组创建和加入流程 | 创建群组 → 加入 → 发送消息 | ${workflow_results.results[3]?.passed ? '✅' : '❌'} |
| 社交关系流程 | 关注 → 查看列表 → 搜索 | ${workflow_results.results[4]?.passed ? '✅' : '❌'} |
| 错误恢复流程 | 重复创建/注册/无效 OTP | ${workflow_results.results.slice(5, 9).every(r => r?.passed) ? '✅' : '❌'} |
| 连续操作流程 | 完整连续操作 | ${workflow_results.results[9]?.passed ? '✅' : '❌'} |

### 2.3 失败的测试

${workflow_results.failed > 0 ? workflow_results.results.filter(r => !r.passed).map(r => `
- ❌ **${r.name}**
  - 错误：${r.error?.message || '未知错误'}
`).join('\n') : '✅ 所有测试通过'}

---

## 3. 多方多轮业务场景测试

### 3.1 测试结果

| 指标 | 数值 |
|------|------|
| 测试用例数 | ${multi_party_results.total} |
| 通过 | ${multi_party_results.passed} |
| 失败 | ${multi_party_results.failed} |
| 通过率 | ${multi_party_pass_rate}% |

### 3.2 场景详情

#### 场景 1: Alice 和 Bob 的对话

| 步骤 | 操作 | 状态 |
|------|------|------|
| 1 | Alice 创建身份 | ${multi_party_results.results[0]?.passed ? '✅' : '❌'} |
| 2 | Bob 创建身份 | ${multi_party_results.results[1]?.passed ? '✅' : '❌'} |
| 3 | Alice 发送消息给 Bob | ${multi_party_results.results[2]?.passed ? '✅' : '❌'} |
| 4 | Bob 查看收件箱 | ${multi_party_results.results[3]?.passed ? '✅' : '❌'} |
| 5 | Bob 回复消息给 Alice | ${multi_party_results.results[4]?.passed ? '✅' : '❌'} |
| 6 | Alice 查看收件箱 | ${multi_party_results.results[5]?.passed ? '✅' : '❌'} |
| 7 | Alice 发送 E2EE 加密消息 | ${multi_party_results.results[6]?.passed ? '✅' : '❌'} |
| 8 | Bob 处理 E2EE 消息 | ${multi_party_results.results[7]?.passed ? '✅' : '❌'} |

#### 场景 2: 群组对话

| 步骤 | 操作 | 状态 |
|------|------|------|
| 1 | Alice 创建群组 | ${multi_party_results.results[8]?.passed ? '✅' : '❌'} |
| 2 | Bob 加入群组 | ${multi_party_results.results[9]?.passed ? '✅' : '❌'} |
| 3 | Charlie 加入群组 | ${multi_party_results.results[10]?.passed ? '✅' : '❌'} |
| 4 | Alice 发送群消息 | ${multi_party_results.results[11]?.passed ? '✅' : '❌'} |
| 5 | Bob 发送群消息 | ${multi_party_results.results[12]?.passed ? '✅' : '❌'} |
| 6 | Charlie 发送群消息 | ${multi_party_results.results[13]?.passed ? '✅' : '❌'} |

#### 场景 3: 社交关系

| 步骤 | 操作 | 状态 |
|------|------|------|
| 1 | Alice 关注 Bob | ${multi_party_results.results[14]?.passed ? '✅' : '❌'} |
| 2 | Bob 关注 Alice | ${multi_party_results.results[15]?.passed ? '✅' : '❌'} |
| 3 | Alice 查看关注列表 | ${multi_party_results.results[16]?.passed ? '✅' : '❌'} |
| 4 | Alice 查看粉丝列表 | ${multi_party_results.results[17]?.passed ? '✅' : '❌'} |
| 5 | 搜索用户 | ${multi_party_results.results[18]?.passed ? '✅' : '❌'} |

#### 场景 4: 完整连续操作

| 操作 | 状态 |
|------|------|
| 完整流程 | ${multi_party_results.results[19]?.passed ? '✅' : '❌'} |

### 3.3 失败的测试

${multi_party_results.failed > 0 ? multi_party_results.results.filter(r => !r.passed).map(r => `
- ❌ **${r.name}**
  - 错误：${r.error?.message || '未知错误'}
`).join('\n') : '✅ 所有测试通过'}

---

## 4. 发现的主要问题

${issues.length > 0 ? issues.map((issue, i) => `
### ${i + 1}. ${issue.test}
- **错误**: ${issue.error}
`).join('\n') : '✅ 未发现主要问题'}

---

## 5. 测试环境

| 组件 | 版本/配置 |
|------|----------|
| Node.js | ${process.version} |
| 操作系统 | ${process.platform} ${process.arch} |
| Mock 服务器端口 | ${MOCK_PORT} |
| Mock 服务器 URL | ${MOCK_URL} |
| 测试框架 | Node.js native test runner |

---

## 6. 测试文件清单

| 文件 | 描述 |
|------|------|
| mocks/mock_server.js | Mock 服务器，模拟 awiki.ai 服务 |
| test_utils.js | 测试辅助工具（CLI 运行、断言等） |
| cli_params.test.js | CLI 命令参数覆盖测试 |
| workflow.test.js | 业务流程测试 |
| multi_party.test.js | 多方多轮业务场景测试 |
| run_all.js | 主测试运行器 |

---

## 7. 如何运行测试

\`\`\`bash
# 运行所有测试
node tests/integration/run_all.js

# 运行单个测试文件
node tests/integration/cli_params.test.js
node tests/integration/workflow.test.js
node tests/integration/multi_party.test.js
\`\`\`

---

## 8. 结论

本次集成测试覆盖了：

1. **CLI 命令参数**: 7 个命令，${total_params} 个参数组合，覆盖率 ${cli_coverage}%
2. **业务流程**: 7 个完整流程，通过率 ${workflow_pass_rate}%
3. **多方场景**: 4 个场景，${multi_party_results.total} 个测试用例，通过率 ${multi_party_pass_rate}%

**总体通过率**: ${pass_rate}%

${total_failed === 0 ? '✅ 所有测试通过！' : `⚠️ 有 ${total_failed} 个测试失败，需要修复。`}
`;

  return report;
}

/**
 * 运行所有测试
 */
async function run_all() {
  console.log('='.repeat(60));
  console.log('awiki skill 项目集成测试');
  console.log('='.repeat(60));
  console.log('');
  
  // 启动 Mock 服务器
  console.log('启动 Mock 服务器...');
  const mock_server = await start_mock_server(MOCK_PORT);
  console.log(`Mock 服务器运行在端口 ${MOCK_PORT}`);
  console.log('');
  
  const start_time = Date.now();
  
  try {
    // 运行 CLI 参数测试
    console.log('[1/3] 运行 CLI 命令参数覆盖测试...\n');
    const cli_results = await run_cli_tests();
    
    // 运行业务流程测试
    console.log('\n[2/3] 运行业务流程测试...\n');
    const workflow_results = await run_workflow_tests();
    
    // 运行多方多轮测试
    console.log('\n[3/3] 运行多方多轮业务场景测试...\n');
    const multi_party_results = await run_multi_party_tests();
    
    const end_time = Date.now();
    const duration = ((end_time - start_time) / 1000).toFixed(2);
    
    // 生成报告
    console.log('\n生成测试报告...');
    const report = generate_full_report(cli_results, workflow_results, multi_party_results);
    
    // 保存报告
    writeFileSync(REPORT_PATH, report, 'utf-8');
    console.log(`报告已保存到：${REPORT_PATH}`);
    
    // 输出摘要
    const total = cli_results.total + workflow_results.total + multi_party_results.total;
    const passed = cli_results.passed + workflow_results.passed + multi_party_results.passed;
    const failed = total - passed;
    
    console.log('\n' + '='.repeat(60));
    console.log('测试完成摘要');
    console.log('='.repeat(60));
    console.log(`总测试用例数：${total}`);
    console.log(`通过：${passed}`);
    console.log(`失败：${failed}`);
    console.log(`通过率：${((passed / total) * 100).toFixed(2)}%`);
    console.log(`执行时间：${duration}秒`);
    console.log('='.repeat(60));
    
    // 停止 Mock 服务器
    console.log('\n停止 Mock 服务器...');
    await stop_mock_server(mock_server);
    
    return {
      success: failed === 0,
      total,
      passed,
      failed,
      cli_results,
      workflow_results,
      multi_party_results,
      duration,
    };
  } catch (error) {
    console.error('测试运行失败:', error);
    
    // 停止 Mock 服务器
    console.log('\n停止 Mock 服务器...');
    await stop_mock_server(mock_server);
    
    return {
      success: false,
      error: error.message,
    };
  }
}

// 主入口
run_all().then(result => {
  process.exit(result.success ? 0 : 1);
}).catch(err => {
  console.error('未捕获的错误:', err);
  process.exit(1);
});
