/**
 * Migrate legacy flat-file credentials into the indexed directory layout.
 *
 * Node.js implementation based on Python version:
 * python/scripts/migrate_credentials.py
 *
 * [INPUT]: credential_migration
 * [OUTPUT]: JSON migration summary
 * [POS]: Standalone migration CLI for upgrading local credential storage
 */

const { migrate_legacy_credentials } = require('./credential_migration');
const { configureLogging } = require('./utils/logging');

/**
 * CLI entry point.
 * @returns {void}
 */
function main() {
  configureLogging({ consoleLevel: 'INFO', mirrorStdio: true });

  const args = process.argv.slice(2);
  let credentialName = null;

  // Parse --credential argument
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--credential' && i + 1 < args.length) {
      credentialName = args[i + 1];
      break;
    }
  }

  console.error(`migrate_credentials CLI started credential=${credentialName}`);
  
  const result = migrate_legacy_credentials(credentialName);
  console.log(JSON.stringify(result, null, 2));
}

// CLI entry point
if (require.main === module) {
  main();
}

module.exports = {
  main
};
