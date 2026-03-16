# client 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/client.py`  
**JavaScript 目标文件**: `module/src/client.js`  
**功能**: httpx AsyncClient 工厂，创建预配置的 HTTP 客户端

---

## 2. 依赖关系

### 2.1 Python 依赖

```python
import httpx
import ssl
import os
from pathlib import Path
from urllib.parse import urlparse
```

### 2.2 JavaScript 依赖

```javascript
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
// 或使用第三方库
import axios from 'axios';
// 或
import fetch from 'node-fetch';
```

### 2.3 本地依赖

```javascript
import { SDKConfig } from './config.js';
```

---

## 3. 接口设计

### 3.1 `_resolve_verify` 函数

**Python**:
```python
def _resolve_verify(base_url: str) -> bool | ssl.SSLContext:
```

**JavaScript**:
```javascript
/**
 * 解析 TLS 验证设置
 * @param {string} baseUrl - 服务基础 URL
 * @returns {boolean|https.Agent} SSL 验证配置
 */
function _resolveVerify(baseUrl) {
    const { hostname } = new URL(baseUrl);
    
    // 1. 检查环境变量指定的 CA bundle
    const envVars = ['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE'];
    for (const envVar of envVars) {
        const candidate = process.env[envVar]?.trim();
        if (candidate && fs.existsSync(candidate)) {
            return new https.Agent({
                ca: fs.readFileSync(candidate),
            });
        }
    }

    // 2. 检查是否为本地 *.test 域名
    if (hostname.endsWith('.test') || hostname === 'localhost') {
        const mkcertRoot = path.join(
            process.env.HOME,
            'Library',
            'Application Support',
            'mkcert',
            'rootCA.pem'
        );
        if (fs.existsSync(mkcertRoot)) {
            return new https.Agent({
                ca: fs.readFileSync(mkcertRoot),
            });
        }
    }

    // 3. 使用默认验证
    return true;
}
```

---

### 3.2 `create_user_service_client` 函数

**Python**:
```python
def create_user_service_client(config: SDKConfig) -> httpx.AsyncClient:
```

**JavaScript**:
```javascript
/**
 * 创建 user-service 异步 HTTP 客户端
 * @param {SDKConfig} config - SDK 配置对象
 * @returns {AsyncClient} 配置好的 HTTP 客户端
 */
function createUserServiceClient(config) {
    const agent = _resolveVerify(config.userServiceUrl);
    
    return {
        baseURL: config.userServiceUrl,
        timeout: 30000,
        httpsAgent: agent instanceof https.Agent ? agent : undefined,
        // 或使用 fetch 包装器
        post: async (endpoint, data, options = {}) => {
            const response = await fetch(config.userServiceUrl + endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                body: JSON.stringify(data),
            });
            return response.json();
        },
        // ... 其他方法
    };
}
```

---

### 3.3 `create_molt_message_client` 函数

**Python**:
```python
def create_molt_message_client(config: SDKConfig) -> httpx.AsyncClient:
```

**JavaScript**:
```javascript
/**
 * 创建 molt-message 异步 HTTP 客户端
 * @param {SDKConfig} config - SDK 配置对象
 * @returns {AsyncClient} 配置好的 HTTP 客户端
 */
function createMoltMessageClient(config) {
    const agent = _resolveVerify(config.moltMessageUrl);
    
    return {
        baseURL: config.moltMessageUrl,
        timeout: 30000,
        httpsAgent: agent instanceof https.Agent ? agent : undefined,
        post: async (endpoint, data, options = {}) => {
            const response = await fetch(config.moltMessageUrl + endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                body: JSON.stringify(data),
            });
            return response.json();
        },
    };
}
```

---

## 4. 导出接口

```javascript
// client.js
export {
    _resolveVerify,
    createUserServiceClient,
    createMoltMessageClient,
};

export default {
    createUserServiceClient,
    createMoltMessageClient,
};
```

---

## 5. 类型定义

```typescript
// types/client.d.ts
import { SDKConfig } from './config.js';
import * as https from 'https';

export interface AsyncClient {
    baseURL: string;
    timeout: number;
    httpsAgent?: https.Agent;
    post(endpoint: string, data: any, options?: RequestOptions): Promise<any>;
    get(endpoint: string, options?: RequestOptions): Promise<any>;
    put(endpoint: string, data: any, options?: RequestOptions): Promise<any>;
    delete(endpoint: string, options?: RequestOptions): Promise<any>;
}

export interface RequestOptions {
    headers?: Record<string, string>;
    params?: Record<string, any>;
}

export function _resolveVerify(baseUrl: string): boolean | https.Agent;
export function createUserServiceClient(config: SDKConfig): AsyncClient;
export function createMoltMessageClient(config: SDKConfig): AsyncClient;
```

---

## 6. 实现注意事项

### 6.1 HTTP 客户端选择

**选项 1: 原生 fetch (Node.js 18+)**
```javascript
const response = await fetch(url, options);
```

**选项 2: axios**
```javascript
import axios from 'axios';
const client = axios.create({ baseURL, timeout });
```

**选项 3: 移植 httpx**
```javascript
import httpx from '@awiki/httpx';
const client = httpx.AsyncClient.create({ baseURL, timeout });
```

### 6.2 SSL/TLS 配置

JavaScript 使用 `https.Agent` 配置 SSL：
```javascript
const agent = new https.Agent({
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: true,
});
```

### 6.3 超时处理

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

const response = await fetch(url, {
    signal: controller.signal,
});

clearTimeout(timeoutId);
```

---

## 7. 测试用例

```javascript
// tests/client.test.js
import { describe, it, expect } from '@jest/globals';
import { createUserServiceClient } from '../src/client.js';
import { SDKConfig } from '../src/config.js';

describe('client module', () => {
    it('should create user service client', () => {
        const config = new SDKConfig();
        const client = createUserServiceClient(config);
        expect(client.baseURL).toBe(config.userServiceUrl);
        expect(client.timeout).toBe(30000);
    });

    it('should resolve verify for localhost', () => {
        const result = _resolveVerify('http://localhost:8080');
        expect(result).toBe(true);
    });
});
```

---

## 8. 迁移检查清单

- [ ] 实现 `_resolveVerify` 函数
- [ ] 实现 `createUserServiceClient` 函数
- [ ] 实现 `createMoltMessageClient` 函数
- [ ] 选择 HTTP 客户端库
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 更新文档
