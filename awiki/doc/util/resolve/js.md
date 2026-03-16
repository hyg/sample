# resolve 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/resolve.py`  
**JavaScript 目标文件**: `module/src/resolve.js`  
**功能**: Handle 到 DID 的解析

---

## 2. 接口设计

### 2.1 `resolveToDid` 函数

**Python**:
```python
async def resolve_to_did(
    identifier: str,
    config: SDKConfig | None = None,
) -> str:
```

**JavaScript**:
```javascript
/**
 * 解析 DID 或 Handle 为 DID
 * @param {string} identifier - DID 或 Handle
 * @param {SDKConfig} [config] - SDK 配置
 * @returns {Promise<string>} DID
 */
async function resolveToDid(identifier, config = null) {
    // 已是 DID，直接返回
    if (identifier.startsWith('did:')) {
        return identifier;
    }

    if (config === null) {
        config = new SDKConfig();
    }

    // 移除已知的 awiki 域名后缀
    const stripDomains = ['awiki.ai', 'awiki.test'];
    if (config.didDomain) {
        stripDomains.push(config.didDomain);
    }

    for (const domain of stripDomains) {
        if (identifier.endsWith(`.${domain}`)) {
            identifier = identifier.slice(0, -(domain.length + 1));
            break;
        }
    }

    // 调用 .well-known/handle 端点
    const url = `${config.userServiceUrl}/user-service/.well-known/handle/${identifier}`;
    
    const response = await fetch(url);
    
    if (response.status === 404) {
        throw new Error(`Handle '${identifier}' not found`);
    }
    
    if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    const status = data.status || '';
    
    if (status !== 'active') {
        throw new Error(`Handle '${identifier}' is not active (status: ${status})`);
    }

    const did = data.did || '';
    if (!did) {
        throw new Error(`Handle '${identifier}' has no DID binding`);
    }

    return did;
}
```

---

## 3. 导出接口

```javascript
export {
    resolveToDid,
};
```

---

## 4. 使用示例

```javascript
import { resolveToDid } from './resolve.js';

// 解析 Handle
const did = await resolveToDid('alice');
console.log(`@alice -> ${did}`);

// 解析完整 Handle
const did2 = await resolveToDid('alice.awiki.ai');
console.log(`alice.awiki.ai -> ${did2}`);

// DID 直接返回
const did3 = await resolveToDid('did:wba:...');
console.log(did3);  // did:wba:...
```

---

## 5. 迁移检查清单

- [ ] 实现 `resolveToDid` 函数
- [ ] 添加域名后缀处理
- [ ] 添加错误处理
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 更新文档
