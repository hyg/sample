/**
 * 测试辅助工具
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// PROJECT_ROOT 应该是 skill 目录
const PROJECT_ROOT = join(__dirname, '..', '..');

// Mock 服务器配置
export const MOCK_PORT = 9999;
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;

/**
 * 运行 CLI 命令并捕获输出
 */
export async function run_cli(script, args = [], options = {}) {
  const {
    env = {},
    expect_error = false,
    timeout = 30000,
    use_mock = true,  // 默认使用 Mock 服务器
  } = options;

  return new Promise((resolve, reject) => {
    // 脚本路径
    const full_args = [join(PROJECT_ROOT, 'scripts', script), ...args];
    
    // 设置环境变量，使用 Mock 服务器
    const cli_env = { 
      ...process.env, 
      ...env,
    };
    
    // 如果需要使用 Mock 服务器，设置环境变量
    if (use_mock) {
      cli_env.E2E_USER_SERVICE_URL = MOCK_URL;
      cli_env.E2E_MOLT_MESSAGE_URL = MOCK_URL;
      cli_env.E2E_MOLT_MESSAGE_WS_URL = MOCK_URL;
      cli_env.E2E_DID_DOMAIN = 'localhost';
    }
    
    const proc = spawn('node', full_args, {
      cwd: PROJECT_ROOT,
      env: cli_env,
    });

    let stdout = '';
    let stderr = '';
    let timed_out = false;

    const timer = setTimeout(() => {
      timed_out = true;
      proc.kill();
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (timed_out) {
        resolve({
          success: false,
          code,
          stdout,
          stderr,
          error: new Error('Command timed out'),
          timed_out: true,
        });
        return;
      }

      const success = expect_error ? code !== 0 : code === 0;

      resolve({
        success,
        code,
        stdout,
        stderr,
        error: code !== 0 && !expect_error ? new Error(`Exit code ${code}`) : null,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * 测试用例类
 */
export class TestCase {
  constructor(name, fn) {
    this.name = name;
    this.fn = fn;
    this.passed = false;
    this.error = null;
    this.duration = 0;
  }

  async run() {
    const start = Date.now();
    try {
      await this.fn();
      this.passed = true;
    } catch (error) {
      this.error = error;
    }
    this.duration = Date.now() - start;
    return this;
  }
}

/**
 * 测试套件类
 */
export class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.before_each_fns = [];
    this.after_each_fns = [];
  }

  before_each(fn) {
    this.before_each_fns.push(fn);
  }

  after_each(fn) {
    this.after_each_fns.push(fn);
  }

  test(name, fn) {
    this.tests.push(new TestCase(name, fn));
  }

  async run() {
    const results = [];
    
    for (const test of this.tests) {
      // 运行 before_each
      for (const fn of this.before_each_fns) {
        await fn();
      }

      // 运行测试
      await test.run();
      results.push(test);

      // 运行 after_each
      for (const fn of this.after_each_fns) {
        await fn();
      }
    }

    return results;
  }
}

/**
 * 创建测试套件
 */
export function suite(name) {
  return new TestSuite(name);
}

/**
 * 断言工具
 */
export const assert = {
  equal(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(msg || `Expected ${expected}, got ${actual}`);
    }
  },

  not_equal(actual, unexpected, msg) {
    if (actual === unexpected) {
      throw new Error(msg || `Expected not equal to ${unexpected}`);
    }
  },

  ok(value, msg) {
    if (!value) {
      throw new Error(msg || 'Expected truthy value');
    }
  },

  fail(msg) {
    throw new Error(msg || 'Test failed');
  },

  match(str, regex, msg) {
    if (!regex.test(str)) {
      throw new Error(msg || `Expected ${str} to match ${regex}`);
    }
  },

  includes(arr, item, msg) {
    if (!arr.includes(item)) {
      throw new Error(msg || `Expected ${arr} to include ${item}`);
    }
  },

  has_property(obj, prop, msg) {
    if (!(prop in obj)) {
      throw new Error(msg || `Expected ${obj} to have property ${prop}`);
    }
  },
};

/**
 * 生成测试报告
 */
export function generate_report(suite_results) {
  let total = 0;
  let passed = 0;
  let failed = 0;

  const lines = [
    '# 集成测试报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    '## 总览',
    '',
  ];

  for (const [suite_name, results] of Object.entries(suite_results)) {
    const suite_total = results.length;
    const suite_passed = results.filter(r => r.passed).length;
    const suite_failed = suite_total - suite_passed;

    total += suite_total;
    passed += suite_passed;
    failed += suite_failed;

    lines.push(`### ${suite_name}`);
    lines.push('');
    lines.push(`- 通过：${suite_passed}`);
    lines.push(`- 失败：${suite_failed}`);
    lines.push(`- 总计：${suite_total}`);
    lines.push('');

    if (suite_failed > 0) {
      lines.push('#### 失败的测试');
      lines.push('');
      for (const result of results) {
        if (!result.passed) {
          lines.push(`- ❌ ${result.name}`);
          if (result.error) {
            lines.push(`  - 错误：${result.error.message}`);
          }
        }
      }
      lines.push('');
    }
  }

  lines.push('## 汇总');
  lines.push('');
  lines.push(`- 总测试数：${total}`);
  lines.push(`- 通过：${passed}`);
  lines.push(`- 失败：${failed}`);
  lines.push(`- 通过率：${((passed / total) * 100).toFixed(2)}%`);
  lines.push('');

  return lines.join('\n');
}
