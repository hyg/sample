/**
 * client 模块导出
 * 
 * 移植自：python/scripts/utils/client.py
 * 
 * 提供：
 * - createUserServiceClient(): 创建 user-service HTTP 客户端
 * - createMoltMessageClient(): 创建 molt-message HTTP 客户端
 */

import {
    _resolveVerify,
    createUserServiceClient,
    createMoltMessageClient,
    HttpClientImpl,
} from './client.js';

export {
    _resolveVerify,
    createUserServiceClient,
    createMoltMessageClient,
    HttpClientImpl,
};

export type {
    SDKConfig,
    VerifyConfig,
    AsyncClient,
    RequestOptions,
    ClientFactory,
} from './types.js';

export default {
    createUserServiceClient,
    createMoltMessageClient,
};
