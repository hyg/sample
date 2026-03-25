/**
 * scripts/send_verification_code.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/send_verification_code.py
 * 分析报告：doc/scripts/send_verification_code.py/py.md
 * 蒸馏数据：doc/scripts/send_verification_code.py/py.json
 *
 * 发送 Handle OTP 验证码
 *
 * [INPUT]: SDK (handle OTP send), logging_config
 * [OUTPUT]: Sends one OTP code and prints the next-step guidance for
 *           register_handle.js / recover_handle.js
 * [POS]: Non-interactive CLI for pre-issuing Handle OTP codes
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const { SDKConfig } = require('./utils/config.js');
const { create_user_service_client } = require('./utils/client.js');
const { send_otp } = require('./utils/handle.js');
const { configureLogging } = require('./utils/logging.js');
const { exit_with_cli_error } = require('./utils/cli-errors.js');

/**
 * 发送 OTP 验证码到指定的手机号
 *
 * @param {string} phone - 国际格式手机号（如 +8613800138000）
 * @returns {Promise<void>}
 */
async function do_send(phone) {
  const config = new SDKConfig();
  console.log(`Sending handle OTP phone=${phone}`);

  const client = create_user_service_client(config);
  try {
    await send_otp(client, phone);
  } finally {
    // 清理客户端资源（如果需要）
  }

  console.log('Verification code sent successfully.');
  console.log(`Phone      : ${phone}`);
  console.log('Next step  : rerun register_handle.js or recover_handle.js with --otp-code <received_code>');
}

/**
 * CLI 入口点
 *
 * @returns {Promise<void>}
 */
async function main() {
  // 配置日志
  configureLogging({ mirrorStdio: true });

  // 解析命令行参数
  const args = process.argv.slice(2);
  const parser = new ArgParser();
  parser.parse(args);

  const phone = parser.getValue('phone');

  if (!phone) {
    console.error('Error: --phone argument is required');
    console.error('Usage: node send-verification-code.js --phone <phone_number>');
    process.exit(1);
  }

  try {
    await do_send(phone);
  } catch (exc) {
    exit_with_cli_error({
      exc: exc,
      logger: console,
      context: 'send_verification_code CLI failed',
      log_traceback: false
    });
  }
}

/**
 * 简单的命令行参数解析器
 */
class ArgParser {
  constructor() {
    this.values = {};
  }

  parse(args) {
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      if (arg === '--phone') {
        if (i + 1 >= args.length) {
          throw new Error('--phone requires a value');
        }
        this.values.phone = args[i + 1];
        i += 2;
      } else if (arg === '--help' || arg === '-h') {
        this.printHelp();
        process.exit(0);
      } else {
        i++;
      }
    }
  }

  getValue(key) {
    return this.values[key] || null;
  }

  printHelp() {
    console.log(`
Send a Handle OTP verification code

Usage:
  node send-verification-code.js --phone <phone_number>

Options:
  --phone <phone_number>  Phone number in international format with country code
                          (e.g., +8613800138000 for China, +14155552671 for US).
                          China local 11-digit numbers are auto-prefixed with +86.
                          Non-mainland China numbers MUST include the country code.
  --help, -h              Show this help message

Examples:
  node send-verification-code.js --phone +8613800138000
  node send-verification-code.js --phone +14155552671
`);
  }
}

// 导出函数
module.exports = {
  do_send,
  main
};

// CLI 入口
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
