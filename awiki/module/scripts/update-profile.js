/**
 * Update DID Profile (nickname, bio, tags, etc.).
 *
 * Python 源文件：python/scripts/update_profile.py
 * 分析报告：doc/scripts/update_profile.py/py.md
 * 蒸馏数据：doc/scripts/update_profile.py/py.json
 *
 * Usage:
 *   // Update nickname
 *   node scripts/update-profile.js --nick-name "DID Pro"
 *
 *   // Update multiple fields
 *   node scripts/update-profile.js \
 *       --nick-name "DID Pro" \
 *       --bio "Decentralized identity enthusiast" \
 *       --tags "developer,did,agent"
 *
 *   // Update Profile Markdown
 *   node scripts/update-profile.js --profile-md "# About Me\n\nI am an agent."
 *
 * [INPUT]: SDK (RPC calls), credential_store (load identity credentials),
 *          logging_config
 * [OUTPUT]: Updated Profile information
 * [POS]: Profile update script
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const argparse = require('argparse');
const { SDKConfig } = require('./utils/config');
const { create_user_service_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');
const { create_authenticator } = require('./credential-store');
const { configure_logging } = require('./utils/logging');

const PROFILE_RPC = '/user-service/did/profile/rpc';

/**
 * Update own Profile.
 *
 * Python 原型:
 * async def update_profile(
 *     credential_name: str,
 *     nick_name: str | None = None,
 *     bio: str | None = None,
 *     tags: list[str] | None = None,
 *     profile_md: str | None = None,
 * ) -> None:
 *
 * @param {string} credential_name - Credential name
 * @param {string|null} [nick_name=null] - Nickname
 * @param {string|null} [bio=null] - Bio
 * @param {string[]|null} [tags=null] - Tags
 * @param {string|null} [profile_md=null] - Profile Markdown content
 * @returns {Promise<void>}
 */
async function update_profile(
  credential_name,
  nick_name = null,
  bio = null,
  tags = null,
  profile_md = null
) {
  // Build list of fields being updated
  const fields = [];
  if (nick_name !== null) fields.push('nick_name');
  if (bio !== null) fields.push('bio');
  if (tags !== null) fields.push('tags');
  if (profile_md !== null) fields.push('profile_md');

  console.log(`Updating profile credential=${credential_name} fields=${JSON.stringify(fields)}`);

  // Build params dict
  const params = {};
  if (nick_name !== null) {
    params.nick_name = nick_name;
  }
  if (bio !== null) {
    params.bio = bio;
  }
  if (tags !== null) {
    params.tags = tags;
  }
  if (profile_md !== null) {
    params.profile_md = profile_md;
  }

  // Validate at least one field is provided
  if (Object.keys(params).length === 0) {
    console.log('Please specify at least one field to update');
    console.log('Available fields: --nick-name, --bio, --tags, --profile-md');
    process.exit(1);
  }

  // Load SDK configuration
  const config = new SDKConfig();

  // Create authenticator
  const auth_result = create_authenticator(credential_name, config);
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, identity_data] = auth_result;

  // Create user service client and make RPC call
  const client = create_user_service_client(config);

  try {
    const updated = await authenticated_rpc_call(
      client,
      PROFILE_RPC,
      'update_me',
      params,
      1,
      { auth: auth, credentialName: credential_name }
    );

    console.error('Profile updated successfully');
    console.log(JSON.stringify(updated, null, 2));
  } finally {
    // Clean up client if needed (httpx client cleanup handled by GC in Node.js)
  }
}

/**
 * CLI entry point.
 *
 * Python 原型:
 * def main() -> None:
 *
 * @returns {void}
 */
function main() {
  configure_logging({ console_level: null, mirror_stdio: true });

  const parser = new argparse.ArgumentParser({
    description: 'Update DID Profile'
  });

  parser.add_argument('--nick-name', {
    type: 'string',
    help: 'Nickname',
    dest: 'nick_name'
  });

  parser.add_argument('--bio', {
    type: 'string',
    help: 'Bio'
  });

  parser.add_argument('--tags', {
    type: 'string',
    help: 'Tags (comma-separated)'
  });

  parser.add_argument('--profile-md', {
    type: 'string',
    help: 'Profile Markdown content',
    dest: 'profile_md'
  });

  parser.add_argument('--credential', {
    type: 'string',
    default: 'default',
    help: 'Credential name (default: default)'
  });

  const args = parser.parse_args();

  console.log(`update_profile CLI started credential=${args.credential}`);

  // Parse tags
  const tags = args.tags ? args.tags.split(',') : null;

  // Run async update_profile
  update_profile(
    args.credential,
    args.nick_name,
    args.bio,
    tags,
    args.profile_md
  ).catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

// Main entry point
if (require.main === module) {
  main();
}

module.exports = {
  update_profile
};
