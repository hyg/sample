/**
 * scripts/register_handle.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/register_handle.py
 *
 * Handle 注册 (人类可读的 DID 别名)
 *
 * 用法:
 *     # 先发送 OTP，然后用手机号注册
 *     node send-verification-code.js --phone +8613800138000
 *     node register-handle.js --handle alice --phone +8613800138000 --otp-code 123456
 *
 *     # 使用邮箱注册 (纯非交互式流程)
 *     node register-handle.js --handle alice --email user@example.com
 *     node register-handle.js --handle alice --email user@example.com --wait-for-email-verification
 *
 *     # 使用邀请码 (用于短 handle <= 4 字符)
 *     node register-handle.js --handle bob --phone +8613800138000 --otp-code 123456 --invite-code ABC123
 *
 *     # 指定凭证名称
 *     node register-handle.js --handle alice --phone +8613800138000 --otp-code 123456 --credential myhandle
 *
 * [INPUT]: SDK (handle registration, OTP, email verification), credential_store (save identity),
 *          logging_config
 * [OUTPUT]: Register Handle + DID identity and save credentials
 * [POS]: Pure non-interactive CLI for Handle registration (phone OTP or email activation link)
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const { SDKConfig } = require('./utils/config.js');
const { create_user_service_client } = require('./utils/client.js');
const {
  register_handle,
  register_handle_with_email,
  ensure_email_verification
} = require('./utils/handle.js');
const { configureLogging } = require('./utils/logging.js');
const { exit_with_cli_error } = require('./utils/cli-errors.js');
const { save_identity } = require('./credential-store.js');

// ==================== 常量 ====================

const PENDING_VERIFICATION_EXIT_CODE = 3;

/**
 * 注册 Handle 的主函数 (纯非交互式流程)
 *
 * @param {Object} options - 选项
 * @param {string} options.handle - Handle 本地部分 (如 "alice")
 * @param {string|null} [options.phone=null] - 手机号
 * @param {string|null} [options.email=null] - 邮箱
 * @param {string|null} [options.otp_code=null] - OTP 验证码
 * @param {string|null} [options.invite_code=null] - 邀请码
 * @param {string|null} [options.name=null] - 显示名称
 * @param {string} [options.credential_name='default'] - 凭证存储名称
 * @param {boolean} [options.wait_for_email_verification=false] - 是否等待邮箱验证
 * @param {number} [options.email_verification_timeout=300] - 邮箱验证超时 (秒)
 * @param {number} [options.email_poll_interval=5.0] - 邮箱轮询间隔 (秒)
 * @returns {Promise<boolean>} 是否完成注册
 */
async function do_register({
  handle,
  phone = null,
  email = null,
  otp_code = null,
  invite_code = null,
  name = null,
  credential_name = 'default',
  wait_for_email_verification = false,
  email_verification_timeout = 300,
  email_poll_interval = 5.0
}) {
  const config = SDKConfig.load();

  console.log(`Registering handle handle=${handle} credential=${credential_name} phone=${!!phone} email=${!!email} invite_code_present=${!!invite_code} wait_for_email_verification=${wait_for_email_verification}`);
  console.log(`Using service configuration user_service=${config.user_service_url} did_domain=${config.did_domain}`);

  // 在邮箱模式下，即使提供了 OTP 也会被忽略
  if (email && otp_code) {
    console.log('Warning: --otp-code is ignored in email registration mode.');
  }

  const client = create_user_service_client(config);

  let identity;
  try {
    if (email) {
      identity = await _register_with_email(
        client,
        config,
        handle,
        email,
        invite_code,
        name,
        {
          wait_for_verification: wait_for_email_verification,
          verification_timeout: email_verification_timeout,
          poll_interval: email_poll_interval
        }
      );
    } else if (phone) {
      identity = await _register_with_phone(
        client,
        config,
        handle,
        phone,
        otp_code,
        invite_code,
        name
      );
    } else {
      console.error('Error: either --phone or --email is required.');
      process.exit(1);
    }

    if (identity === null) {
      return false;
    }

    console.log(`  Handle    : ${handle}.${config.did_domain}`);
    console.log(`  DID       : ${identity.did}`);
    console.log(`  unique_id : ${identity.unique_id}`);
    console.log(`  user_id   : ${identity.user_id}`);
    console.log(`  JWT token : ${identity.jwt_token.slice(0, 50)}...`);

    // 保存凭证
    const path = save_identity({
      did: identity.did,
      unique_id: identity.unique_id,
      user_id: identity.user_id,
      private_key_pem: identity.private_key_pem,
      public_key_pem: identity.public_key_pem,
      jwt_token: identity.jwt_token,
      display_name: name || handle,
      handle: handle,
      name: credential_name,
      did_document: identity.did_document,
      e2ee_signing_private_pem: identity.e2ee_signing_private_pem,
      e2ee_agreement_private_pem: identity.e2ee_agreement_private_pem
    });
    console.log(`\nCredential saved to: ${path}`);
    console.log(`Credential name: ${credential_name}`);
    return true;
  } finally {
    // 清理客户端资源 (如果需要)
  }
}

/**
 * 基于手机号的注册 (使用预发的 OTP 验证码)
 *
 * @param {Object} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {string} handle - Handle 本地部分
 * @param {string} phone - 手机号
 * @param {string|null} otp_code - OTP 验证码
 * @param {string|null} invite_code - 邀请码
 * @param {string|null} name - 显示名称
 * @returns {Promise<DIDIdentity>} DID 身份
 * @throws {Error} OTP 代码为 null 时抛出
 */
async function _register_with_phone(client, config, handle, phone, otp_code, invite_code, name) {
  if (otp_code === null) {
    throw new Error('OTP code is required for phone registration.');
  }

  console.log(`Registering handle via phone handle=${handle} phone=${phone}`);
  return await register_handle(
    client,
    config,
    phone,
    otp_code,
    handle,
    invite_code,
    name || handle,
    true // is_public
  );
}

/**
 * 基于邮箱的注册 (可选轮询)
 *
 * @param {Object} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {string} handle - Handle 本地部分
 * @param {string} email - 邮箱地址
 * @param {string|null} invite_code - 邀请码
 * @param {string|null} name - 显示名称
 * @param {Object} options - 可选参数
 * @param {boolean} options.wait_for_verification - 是否等待验证
 * @param {number} options.verification_timeout - 验证超时 (秒)
 * @param {number} options.poll_interval - 轮询间隔 (秒)
 * @returns {Promise<DIDIdentity|null>} DID 身份，验证失败返回 null
 */
async function _register_with_email(
  client,
  config,
  handle,
  email,
  invite_code,
  name,
  { wait_for_verification, verification_timeout, poll_interval }
) {
  const verification_result = await ensure_email_verification(
    client,
    email,
    null, // send_fn
    {
      wait: wait_for_verification,
      timeout: verification_timeout,
      poll_interval: poll_interval
    }
  );

  if (!verification_result.verified) {
    if (wait_for_verification) {
      console.log(
        'Email verification timed out. Click the activation link and rerun ' +
        'the same command, or increase --email-verification-timeout.'
      );
    } else {
      console.log(
        'Email verification pending. Click the activation link, then rerun ' +
        'the same command. Or pass --wait-for-email-verification to poll ' +
        'automatically.'
      );
    }
    return null;
  }

  console.log(`Registering handle via email handle=${handle} email=${email}`);
  return await register_handle_with_email(
    client,
    config,
    email,
    handle,
    invite_code,
    name || handle,
    true // is_public
  );
}

/**
 * 简单的命令行参数解析器
 */
class ArgParser {
  constructor() {
    this.values = {};
    this.help = false;
  }

  /**
   * 解析命令行参数
   *
   * @param {string[]} args - 参数数组
   */
  parse(args) {
    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg === '--handle') {
        if (i + 1 >= args.length) {
          throw new Error('--handle requires a value');
        }
        this.values.handle = args[i + 1];
        i += 2;
      } else if (arg === '--phone') {
        if (i + 1 >= args.length) {
          throw new Error('--phone requires a value');
        }
        this.values.phone = args[i + 1];
        i += 2;
      } else if (arg === '--email') {
        if (i + 1 >= args.length) {
          throw new Error('--email requires a value');
        }
        this.values.email = args[i + 1];
        i += 2;
      } else if (arg === '--otp-code') {
        if (i + 1 >= args.length) {
          throw new Error('--otp-code requires a value');
        }
        this.values.otp_code = args[i + 1];
        i += 2;
      } else if (arg === '--invite-code') {
        if (i + 1 >= args.length) {
          throw new Error('--invite-code requires a value');
        }
        this.values.invite_code = args[i + 1];
        i += 2;
      } else if (arg === '--name') {
        if (i + 1 >= args.length) {
          throw new Error('--name requires a value');
        }
        this.values.name = args[i + 1];
        i += 2;
      } else if (arg === '--credential') {
        if (i + 1 >= args.length) {
          throw new Error('--credential requires a value');
        }
        this.values.credential = args[i + 1];
        i += 2;
      } else if (arg === '--wait-for-email-verification') {
        this.values.wait_for_email_verification = true;
        i += 1;
      } else if (arg === '--email-verification-timeout') {
        if (i + 1 >= args.length) {
          throw new Error('--email-verification-timeout requires a value');
        }
        this.values.email_verification_timeout = parseInt(args[i + 1], 10);
        i += 2;
      } else if (arg === '--email-poll-interval') {
        if (i + 1 >= args.length) {
          throw new Error('--email-poll-interval requires a value');
        }
        this.values.email_poll_interval = parseFloat(args[i + 1]);
        i += 2;
      } else if (arg === '--help' || arg === '-h') {
        this.help = true;
        i += 1;
      } else {
        i += 1;
      }
    }
  }

  /**
   * 获取值
   *
   * @param {string} key - 键
   * @param {any} [defaultValue=null] - 默认值
   * @returns {any} 值
   */
  getValue(key, defaultValue = null) {
    return this.values[key] !== undefined ? this.values[key] : defaultValue;
  }

  /**
   * 打印帮助信息
   */
  printHelp() {
    console.log(`
Register a Handle (human-readable DID alias)

Usage:
  node register-handle.js --handle <handle> (--phone <phone> --otp-code <code> | --email <email>) [options]

Options:
  --handle <handle>                 Handle local-part (e.g., alice)
  --phone <phone>                   Phone number in international format with country code
                                    (e.g., +8613800138000 for China, +14155552671 for US).
                                    China local 11-digit numbers are auto-prefixed with +86.
  --email <email>                   Email address (will send activation link if not yet verified)
  --otp-code <code>                 Pre-issued OTP code (phone mode only; required for non-interactive use)
  --invite-code <code>              Invite code (required for short handles <= 4 chars)
  --name <name>                     Display name (defaults to handle)
  --credential <name>               Credential storage name (default: default)
  --wait-for-email-verification     Poll until the activation link is clicked instead of exiting immediately
  --email-verification-timeout <s>  Seconds to wait when --wait-for-email-verification is set (default: 300)
  --email-poll-interval <s>         Polling interval in seconds for email verification (default: 5.0)
  --help, -h                        Show this help message

Examples:
  # Send OTP first, then register with phone
  node send-verification-code.js --phone +8613800138000
  node register-handle.js --handle alice --phone +8613800138000 --otp-code 123456

  # Register with email (pure non-interactive flow)
  node register-handle.js --handle alice --email user@example.com
  node register-handle.js --handle alice --email user@example.com --wait-for-email-verification

  # With invite code (for short handles <= 4 chars)
  node register-handle.js --handle bob --phone +8613800138000 --otp-code 123456 --invite-code ABC123

  # Specify credential name
  node register-handle.js --handle alice --phone +8613800138000 --otp-code 123456 --credential myhandle
`);
  }
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

  if (parser.help) {
    parser.printHelp();
    process.exit(0);
  }

  const handle = parser.getValue('handle');
  const phone = parser.getValue('phone');
  const email = parser.getValue('email');
  const otp_code = parser.getValue('otp_code');
  const invite_code = parser.getValue('invite_code');
  const name = parser.getValue('name');
  const credential = parser.getValue('credential', 'default');
  const wait_for_email_verification = parser.getValue('wait_for_email_verification', false);
  const email_verification_timeout = parser.getValue('email_verification_timeout', 300);
  const email_poll_interval = parser.getValue('email_poll_interval', 5.0);

  if (!handle) {
    console.error('Error: --handle argument is required');
    parser.printHelp();
    process.exit(1);
  }

  // 验证手机号或邮箱至少提供一个
  if (!phone && !email) {
    console.error('Error: either --phone or --email is required');
    parser.printHelp();
    process.exit(1);
  }

  // 验证手机号和邮箱不能同时提供
  if (phone && email) {
    console.error('Error: --phone and --email are mutually exclusive');
    parser.printHelp();
    process.exit(1);
  }

  try {
    const completed = await do_register({
      handle: handle,
      phone: phone,
      email: email,
      otp_code: otp_code,
      invite_code: invite_code,
      name: name,
      credential_name: credential,
      wait_for_email_verification: wait_for_email_verification,
      email_verification_timeout: email_verification_timeout,
      email_poll_interval: email_poll_interval
    });

    if (!completed) {
      process.exit(PENDING_VERIFICATION_EXIT_CODE);
    }
  } catch (exc) {
    exit_with_cli_error({
      exc: exc,
      logger: console,
      context: 'register_handle CLI validation failed',
      exit_code: 2,
      log_traceback: false
    });
  }
}

// 导出函数
module.exports = {
  do_register,
  main,
  PENDING_VERIFICATION_EXIT_CODE
};

// CLI 入口
if (require.main === module) {
  main().catch((err) => {
    if (err._isSystemExit) {
      process.exit(err.code || 1);
    }
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
