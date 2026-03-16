# config 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/config.py`  
**JavaScript 目标文件**: `module/src/config.js`  
**功能**: SDK 配置管理，服务 URL、凭证目录和数据目录解析

---

## 2. 依赖关系

### 2.1 Python 依赖

```python
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
```

### 2.2 JavaScript 依赖

```javascript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
```

---

## 3. 接口设计

### 3.1 常量

**Python**:
```python
_SKILL_NAME = "awiki-agent-id-message"
_SKILL_DIR = Path(__file__).resolve().parent.parent.parent
```

**JavaScript**:
```javascript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SKILL_NAME = 'awiki-agent-id-message';
const SKILL_DIR = join(__dirname, '..', '..');
```

---

### 3.2 `_default_credentials_dir` 函数

**Python**:
```python
def _default_credentials_dir() -> Path:
    return Path.home() / ".openclaw" / "credentials" / _SKILL_NAME
```

**JavaScript**:
```javascript
/**
 * 获取默认凭证目录
 * @returns {string} 凭证目录路径
 */
function _defaultCredentialsDir() {
    return path.join(os.homedir(), '.openclaw', 'credentials', SKILL_NAME);
}
```

---

### 3.3 `_default_data_dir` 函数

**Python**:
```python
def _default_data_dir() -> Path:
    env_data = os.environ.get("AWIKI_DATA_DIR")
    if env_data:
        return Path(env_data)
    workspace = os.environ.get("AWIKI_WORKSPACE")
    if workspace:
        return Path(workspace) / "data" / _SKILL_NAME
    return Path.home() / ".openclaw" / "workspace" / "data" / _SKILL_NAME
```

**JavaScript**:
```javascript
/**
 * 获取默认数据目录
 * @returns {string} 数据目录路径
 */
function _defaultDataDir() {
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
```

---

### 3.4 `SDKConfig` 类

**Python**:
```python
@dataclass(frozen=True, slots=True)
class SDKConfig:
    user_service_url: str = field(default_factory=lambda: ...)
    molt_message_url: str = field(default_factory=lambda: ...)
    # ...
```

**JavaScript**:
```javascript
/**
 * SDK 配置类
 */
class SDKConfig {
    /**
     * @param {Object} options - 配置选项
     * @param {string} [options.userServiceUrl] - user-service URL
     * @param {string} [options.moltMessageUrl] - molt-message URL
     * @param {string} [options.moltMessageWsUrl] - WebSocket URL
     * @param {string} [options.didDomain] - DID 域名
     * @param {string} [options.credentialsDir] - 凭证目录
     * @param {string} [options.dataDir] - 数据目录
     */
    constructor(options = {}) {
        const {
            userServiceUrl = process.env.E2E_USER_SERVICE_URL || 'https://awiki.ai',
            moltMessageUrl = process.env.E2E_MOLT_MESSAGE_URL || 'https://awiki.ai',
            moltMessageWsUrl = process.env.E2E_MOLT_MESSAGE_WS_URL || null,
            didDomain = process.env.E2E_DID_DOMAIN || 'awiki.ai',
            credentialsDir = _defaultCredentialsDir(),
            dataDir = _defaultDataDir(),
        } = options;

        this._userServiceUrl = userServiceUrl;
        this._moltMessageUrl = moltMessageUrl;
        this._moltMessageWsUrl = moltMessageWsUrl;
        this._didDomain = didDomain;
        this._credentialsDir = credentialsDir;
        this._dataDir = dataDir;

        // 冻结对象，防止修改
        Object.freeze(this);
    }

    get userServiceUrl() { return this._userServiceUrl; }
    get moltMessageUrl() { return this._moltMessageUrl; }
    get moltMessageWsUrl() { return this._moltMessageWsUrl; }
    get didDomain() { return this._didDomain; }
    get credentialsDir() { return this._credentialsDir; }
    get dataDir() { return this._dataDir; }

    /**
     * 从配置文件加载
     * @returns {SDKConfig}
     */
    static load() {
        const dataDir = _defaultDataDir();
        const settingsPath = path.join(dataDir, 'config', 'settings.json');

        let fileData = {};
        if (fs.existsSync(settingsPath)) {
            fileData = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }

        return new SDKConfig({
            userServiceUrl: process.env.E2E_USER_SERVICE_URL || fileData.user_service_url || 'https://awiki.ai',
            moltMessageUrl: process.env.E2E_MOLT_MESSAGE_URL || fileData.molt_message_url || 'https://awiki.ai',
            moltMessageWsUrl: process.env.E2E_MOLT_MESSAGE_WS_URL || fileData.molt_message_ws_url || null,
            didDomain: process.env.E2E_DID_DOMAIN || fileData.did_domain || 'awiki.ai',
            credentialsDir: _defaultCredentialsDir(),
            dataDir,
        });
    }
}
```

---

## 4. 导出接口

```javascript
// config.js
export {
    SKILL_NAME,
    SKILL_DIR,
    SDKConfig,
    _defaultCredentialsDir,
    _defaultDataDir,
};

export default SDKConfig;
```

---

## 5. 类型定义

```typescript
// types/config.d.ts
export interface SDKConfigOptions {
    userServiceUrl?: string;
    moltMessageUrl?: string;
    moltMessageWsUrl?: string | null;
    didDomain?: string;
    credentialsDir?: string;
    dataDir?: string;
}

export class SDKConfig {
    constructor(options?: SDKConfigOptions);
    
    readonly userServiceUrl: string;
    readonly moltMessageUrl: string;
    readonly moltMessageWsUrl: string | null;
    readonly didDomain: string;
    readonly credentialsDir: string;
    readonly dataDir: string;

    static load(): SDKConfig;
}

export const SKILL_NAME: string;
export const SKILL_DIR: string;
export function _defaultCredentialsDir(): string;
export function _defaultDataDir(): string;
```

---

## 6. 环境变量

| 环境变量 | 覆盖属性 | 默认值 |
|----------|----------|--------|
| `E2E_USER_SERVICE_URL` | `userServiceUrl` | `https://awiki.ai` |
| `E2E_MOLT_MESSAGE_URL` | `moltMessageUrl` | `https://awiki.ai` |
| `E2E_MOLT_MESSAGE_WS_URL` | `moltMessageWsUrl` | `null` |
| `E2E_DID_DOMAIN` | `didDomain` | `awiki.ai` |
| `AWIKI_DATA_DIR` | `dataDir` | `~/.openclaw/workspace/data/...` |
| `AWIKI_WORKSPACE` | `dataDir` (部分) | `~/.openclaw/workspace` |

---

## 7. 使用示例

```javascript
import { SDKConfig } from './config.js';

// 使用默认配置
const config = new SDKConfig();
console.log(config.userServiceUrl);  // https://awiki.ai

// 自定义配置
const customConfig = new SDKConfig({
    userServiceUrl: 'https://custom.api.com',
    didDomain: 'custom.ai',
});

// 从配置文件加载
const loadedConfig = SDKConfig.load();

// 使用配置
import { createUserServiceClient } from './client.js';
const client = createUserServiceClient(config);
```

---

## 8. 迁移检查清单

- [ ] 实现 `SDKConfig` 类
- [ ] 实现 `_defaultCredentialsDir` 函数
- [ ] 实现 `_defaultDataDir` 函数
- [ ] 添加环境变量支持
- [ ] 添加配置文件加载
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 更新文档
