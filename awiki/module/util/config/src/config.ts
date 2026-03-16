/**
 * SDK 配置管理
 *
 * [INPUT]: Environment variables, settings.json file
 * [OUTPUT]: SDKConfig class with credentials_dir, data_dir and load() method
 * [POS]: Centralized management of service URLs, domain configuration, credential directory, and data directory
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updates
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { SDKConfigOptions, ISDKConfig } from './types.js';

// Skill name used for path construction
const SKILL_NAME = 'awiki-agent-id-message';

// SKILL_DIR: project root (two levels up from config.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_DIR = path.join(__dirname, '..', '..');

/**
 * 获取默认凭证目录
 *
 * Priority:
 *   ~/.openclaw/credentials/<skill>/
 *
 * @returns 凭证目录路径
 */
function _default_credentials_dir(): string {
  return path.join(os.homedir(), '.openclaw', 'credentials', SKILL_NAME);
}

/**
 * 获取默认数据目录
 *
 * Priority:
 *   1. AWIKI_DATA_DIR env (direct full path override)
 *   2. AWIKI_WORKSPACE env / data / <skill>
 *   3. ~/.openclaw/workspace / data / <skill>
 *
 * @returns 数据目录路径
 */
function _default_data_dir(): string {
  const envData = process.env.AWIKI_DATA_DIR;
  if (envData) {
    return envData;
  }

  const workspace = process.env.AWIKI_WORKSPACE;
  if (workspace) {
    return path.join(workspace, 'data', SKILL_NAME);
  }

  return path.join(os.homedir(), '.openclaw', 'workspace', 'data', SKILL_NAME);
}

/**
 * awiki system service configuration
 *
 * Immutable configuration class (frozen).
 *
 * Priority: environment variables > settings.json > defaults.
 */
export class SDKConfig implements ISDKConfig {
  readonly user_service_url: string;
  readonly molt_message_url: string;
  readonly molt_message_ws_url: string | null;
  readonly did_domain: string;
  readonly credentials_dir: string;
  readonly data_dir: string;

  /**
   * 创建 SDK 配置实例
   *
   * @param options - 配置选项
   */
  constructor(options: SDKConfigOptions = {}) {
    const {
      user_service_url = process.env.E2E_USER_SERVICE_URL ?? 'https://awiki.ai',
      molt_message_url = process.env.E2E_MOLT_MESSAGE_URL ?? 'https://awiki.ai',
      molt_message_ws_url = process.env.E2E_MOLT_MESSAGE_WS_URL ?? null,
      did_domain = process.env.E2E_DID_DOMAIN ?? 'awiki.ai',
      credentials_dir = _default_credentials_dir(),
      data_dir = _default_data_dir(),
    } = options;

    this.user_service_url = user_service_url;
    this.molt_message_url = molt_message_url;
    this.molt_message_ws_url = molt_message_ws_url;
    this.did_domain = did_domain;
    this.credentials_dir = credentials_dir;
    this.data_dir = data_dir;

    // 冻结对象，防止修改 (equivalent to frozen=True in Python dataclass)
    Object.freeze(this);
  }

  /**
   * Load config from <DATA_DIR>/config/settings.json with env var overrides.
   *
   * Priority: environment variables > settings.json > defaults.
   *
   * @returns SDKConfig 实例
   */
  static load(): SDKConfig {
    const credentials_dir = _default_credentials_dir();
    const data_dir = _default_data_dir();
    const settingsPath = path.join(data_dir, 'config', 'settings.json');

    let fileData: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, { encoding: 'utf-8' });
      fileData = JSON.parse(content);
    }

    return new SDKConfig({
      user_service_url: process.env.E2E_USER_SERVICE_URL ??
        (fileData.user_service_url as string | undefined) ??
        'https://awiki.ai',
      molt_message_url: process.env.E2E_MOLT_MESSAGE_URL ??
        (fileData.molt_message_url as string | undefined) ??
        'https://awiki.ai',
      molt_message_ws_url: process.env.E2E_MOLT_MESSAGE_WS_URL ??
        (fileData.molt_message_ws_url as string | null | undefined) ??
        null,
      did_domain: process.env.E2E_DID_DOMAIN ??
        (fileData.did_domain as string | undefined) ??
        'awiki.ai',
      credentials_dir,
      data_dir,
    });
  }
}

// Export constants and helper functions
export { SKILL_NAME, SKILL_DIR, _default_credentials_dir, _default_data_dir };
