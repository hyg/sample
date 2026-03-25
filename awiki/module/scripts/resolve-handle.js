/**
 * scripts/resolve_handle.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/resolve_handle.py
 * 分析报告：doc/scripts/resolve_handle.py/py.md
 * 蒸馏数据：doc/scripts/resolve_handle.py/py.json
 *
 * 解析 Handle 到 DID 或通过 DID 查找 Handle 的 CLI 工具
 */

const readline = require('readline');
const { SDKConfig, create_user_service_client } = require('./utils/config');
const { resolve_handle, lookup_handle } = require('./utils/handle');
const { configure_logging } = require('./utils/logging');

const logger = {
  info: (msg, ...args) => {
    const formatted = args.length > 0 ? msg.replace(/%s/g, () => args.shift()) : msg;
    console.log(`[INFO] ${formatted}`);
  }
};

/**
 * 解析 Handle 或通过 DID 查找
 *
 * @param {string|null} handle - 要解析的 Handle
 * @param {string|null} did - 要查找 handle 的 DID
 */
async function do_resolve(handle, did) {
  logger.info('Resolving identifier handle=%s did=%s', handle, did);
  const config = SDKConfig.load();

  const client = create_user_service_client(config);
  try {
    if (handle) {
      logger.info('Resolving handle handle=%s', handle);
      const result = await resolve_handle(client, handle);
      console.log(JSON.stringify(result, null, 2));
    } else if (did) {
      logger.info('Looking up handle for DID did=%s', did);
      const result = await lookup_handle(client, did);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Either --handle or --did is required.');
      process.exit(1);
    }
  } finally {
    // 清理客户端资源（如果需要）
  }
}

/**
 * 解析命令行参数
 *
 * @returns {Promise<{handle: string|null, did: string|null}>}
 */
async function parseArgs() {
  const args = process.argv.slice(2);
  let handle = null;
  let did = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--handle' && i + 1 < args.length) {
      handle = args[i + 1];
      i++;
    } else if (args[i] === '--did' && i + 1 < args.length) {
      did = args[i + 1];
      i++;
    }
  }

  // 验证参数
  if (!handle && !did) {
    console.error('Error: Either --handle or --did is required.');
    console.error('Usage: node resolve-handle.js --handle <handle> | --did <did>');
    process.exit(1);
  }

  return { handle, did };
}

/**
 * CLI 入口点
 */
async function main() {
  configure_logging({
    level: 'INFO',
    consoleLevel: 'INFO',
    force: false,
    config: null,
    prefix: 'awiki-agent',
    mirrorStdio: false
  });

  const { handle, did } = await parseArgs();
  logger.info('resolve_handle CLI started mode=%s', handle ? 'handle' : 'did');

  try {
    await do_resolve(handle, did);
  } catch (exc) {
    console.error('resolve_handle CLI failed:', exc.message);
    process.exit(1);
  }
}

// 模块导出
module.exports = {
  do_resolve,
  parseArgs,
  main,
  resolve_handle,
  lookup_handle
};

// CLI 入口
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
