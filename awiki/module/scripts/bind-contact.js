/**
 * Bind additional contact info (email or phone) to an existing account.
 *
 * Node.js implementation based on Python version:
 * python/scripts/bind_contact.py
 *
 * [INPUT]: SDK (binding functions, email verification), credential_store (load identity)
 * [OUTPUT]: Bind email or phone to existing account
 * [POS]: Pure non-interactive CLI for post-registration identity binding
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const { SDKConfig } = require('./utils/config');
const { configureLogging } = require('./utils/logging');
const { create_user_service_client } = require('./utils/client');
const {
  bind_email_send,
  bind_phone_send_otp,
  bind_phone_verify,
  ensure_email_verification,
} = require('./utils/handle');
const { load_identity } = require('./credential_store');

// Exit code for pending verification
const PENDING_VERIFICATION_EXIT_CODE = 3;

/**
 * Execute the binding flow.
 *
 * @param {Object} options - Options object
 * @param {string|null} [options.bind_email=null] - Email address to bind
 * @param {string|null} [options.bind_phone=null] - Phone number to bind
 * @param {string|null} [options.otp_code=null] - Pre-issued OTP code for phone binding
 * @param {boolean} [options.send_phone_otp=false] - Send phone bind OTP without completing bind
 * @param {string} [options.credential_name='default'] - Credential storage name
 * @param {boolean} [options.wait_for_email_verification=false] - Poll until email activation link is clicked
 * @param {number} [options.email_verification_timeout=300] - Seconds to wait when wait_for_email_verification is set
 * @param {number} [options.email_poll_interval=5.0] - Polling interval in seconds for email verification
 * @returns {Promise<boolean>} True if binding completed successfully
 * @throws {Error} Validation errors or binding failures
 */
async function do_bind({
  bind_email = null,
  bind_phone = null,
  otp_code = null,
  send_phone_otp = false,
  credential_name = 'default',
  wait_for_email_verification = false,
  email_verification_timeout = 300,
  email_poll_interval = 5.0,
} = {}) {
  const config = SDKConfig.load();

  // Load existing identity (must have JWT)
  const identity = load_identity(credential_name);
  if (identity === null) {
    throw new Error(`No credential found for '${credential_name}'. Register first.`);
  }
  const jwt_token = identity.jwt_token;
  if (!jwt_token) {
    throw new Error('No JWT token found. Refresh the identity first.');
  }

  const client = create_user_service_client(config);
  try {
    if (bind_email) {
      if (!bind_email.includes('@')) {
        throw new Error(`Invalid email format: ${bind_email}`);
      }
      return await _bind_email(
        client,
        bind_email,
        jwt_token,
        {
          wait_for_verification: wait_for_email_verification,
          verification_timeout: email_verification_timeout,
          poll_interval: email_poll_interval,
        }
      );
    } else if (bind_phone) {
      await _bind_phone(
        client,
        bind_phone,
        jwt_token,
        {
          otp_code: otp_code,
          send_phone_otp: send_phone_otp,
        }
      );
      return true;
    }
  } finally {
    // Client cleanup (no explicit close needed for this client)
  }

  return true;
}

/**
 * Bind email to an existing account via a pure non-interactive flow.
 *
 * @param {Object} client - HTTP client
 * @param {string} email - Email address
 * @param {string} jwt_token - JWT token
 * @param {Object} options - Options object
 * @param {boolean} options.wait_for_verification - Whether to wait for verification
 * @param {number} options.verification_timeout - Timeout in seconds
 * @param {number} options.poll_interval - Poll interval in seconds
 * @returns {Promise<boolean>} True if email bound successfully
 * @private
 */
async function _bind_email(
  client,
  email,
  jwt_token,
  { wait_for_verification, verification_timeout, poll_interval }
) {
  const verification_result = await ensure_email_verification(
    client,
    email,
    () => bind_email_send(client, email, jwt_token),
    {
      wait: wait_for_verification,
      timeout: verification_timeout,
      poll_interval: poll_interval,
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
    return false;
  }

  console.log(`Email ${email} bound successfully.`);
  return true;
}

/**
 * Bind phone to an existing account via explicit non-interactive steps.
 *
 * @param {Object} client - HTTP client
 * @param {string} phone - Phone number
 * @param {string} jwt_token - JWT token
 * @param {Object} options - Options object
 * @param {string|null} options.otp_code - OTP code
 * @param {boolean} options.send_phone_otp - Whether to send OTP
 * @returns {Promise<void>}
 * @throws {Error} Validation errors or binding failures
 * @private
 */
async function _bind_phone(
  client,
  phone,
  jwt_token,
  { otp_code, send_phone_otp }
) {
  if (send_phone_otp) {
    console.log(`Sending phone bind OTP phone=${phone}`);
    await bind_phone_send_otp(client, phone, jwt_token);
    console.log('OTP sent.');
    console.log(
      `Next step  : rerun bind_contact.js with ` +
      `--bind-phone ${phone} --otp-code <received_code>`
    );
    return;
  }

  if (otp_code === null) {
    throw new Error('OTP code is required for phone binding.');
  }

  const result = await bind_phone_verify(client, phone, otp_code, jwt_token);
  if (result.success) {
    console.log(`Phone ${result.phone || phone} bound successfully.`);
    return;
  }
  throw new Error('Binding failed.');
}

/**
 * Parse command line arguments.
 *
 * @param {string[]} argv - Command line arguments (default: process.argv)
 * @returns {Object} Parsed arguments
 * @private
 */
function _parse_args(argv = process.argv) {
  const args = {
    bind_email: null,
    bind_phone: null,
    otp_code: null,
    send_phone_otp: false,
    wait_for_email_verification: false,
    email_verification_timeout: 300,
    email_poll_interval: 5.0,
    credential: 'default',
  };

  // Skip node and script path
  const rawArgs = argv.slice(2);
  let i = 0;

  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === '--bind-email' && i + 1 < rawArgs.length) {
      args.bind_email = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--bind-phone' && i + 1 < rawArgs.length) {
      args.bind_phone = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--otp-code' && i + 1 < rawArgs.length) {
      args.otp_code = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--send-phone-otp') {
      args.send_phone_otp = true;
      i += 1;
    } else if (arg === '--wait-for-email-verification') {
      args.wait_for_email_verification = true;
      i += 1;
    } else if (arg === '--email-verification-timeout' && i + 1 < rawArgs.length) {
      args.email_verification_timeout = parseInt(rawArgs[i + 1], 10);
      i += 2;
    } else if (arg === '--email-poll-interval' && i + 1 < rawArgs.length) {
      args.email_poll_interval = parseFloat(rawArgs[i + 1]);
      i += 2;
    } else if (arg === '--credential' && i + 1 < rawArgs.length) {
      args.credential = rawArgs[i + 1];
      i += 2;
    } else {
      i += 1;
    }
  }

  return args;
}

/**
 * CLI entry point.
 *
 * @param {string[]} [argv] - Command line arguments (default: process.argv)
 * @returns {void}
 */
function main(argv = process.argv) {
  configureLogging({ console_level: null, mirror_stdio: true });

  const args = _parse_args(argv);

  // Validate mutually exclusive options
  if (args.bind_email && (args.otp_code !== null || args.send_phone_otp)) {
    console.error('--otp-code and --send-phone-otp can only be used with --bind-phone.');
    process.exit(1);
  }
  if (args.bind_phone && args.wait_for_email_verification) {
    console.error('--wait-for-email-verification can only be used with --bind-email.');
    process.exit(1);
  }

  console.log(
    `bind_contact CLI started email=${args.bind_email} phone=${args.bind_phone} credential=${args.credential}`
  );

  do_bind({
    bind_email: args.bind_email,
    bind_phone: args.bind_phone,
    otp_code: args.otp_code,
    send_phone_otp: args.send_phone_otp,
    credential_name: args.credential,
    wait_for_email_verification: args.wait_for_email_verification,
    email_verification_timeout: args.email_verification_timeout,
    email_poll_interval: args.email_poll_interval,
  })
    .then((completed) => {
      if (!completed) {
        process.exit(PENDING_VERIFICATION_EXIT_CODE);
      }
    })
    .catch((exc) => {
      let context = 'bind_contact CLI failed';
      if (exc instanceof Error && exc.message.includes('validation')) {
        context = 'bind_contact CLI validation failed';
      }
      console.error(`${context}: ${exc.message}`);
      process.exit(1);
    });
}

module.exports = {
  do_bind,
  main,
  PENDING_VERIFICATION_EXIT_CODE,
};
