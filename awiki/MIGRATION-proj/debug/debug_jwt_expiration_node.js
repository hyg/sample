#!/usr/bin/env node
/**
 * 调试 JWT 过期和自动刷新 (Node.js 版本)
 * 采集 Node.js 版本的详细执行数据作为基准
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 采集数据的结构
const traceData = {
    timestamp: new Date().toISOString(),
    script: 'debug_jwt_expiration_node.js',
    credential: 'hyg4awiki',
    operations: []
};

/**
 * 记录操作日志
 */
function logOperation(step, operationType, details) {
    const operation = {
        step,
        type: operationType,
        timestamp: new Date().toISOString(),
        details
    };
    traceData.operations.push(operation);
    console.log(`[${step}] ${operationType}: ${JSON.stringify(details, null, 2)}`);
}

/**
 * 主函数
 */
async function main() {
    const credentialName = 'hyg4awiki';

    logOperation(1, 'START', {
        script: 'check_inbox.js',
        credential: credentialName,
        commandLine: `node scripts\\check_inbox.js --credential ${credentialName}`
    });

    // 步骤 1: 加载凭据
    logOperation(2, 'LOAD_CREDENTIAL', {
        credentialName,
        method: 'createAuthenticator'
    });

    try {
        const { createAuthenticator } = await import('./nodejs-client/scripts/utils/credential_store.js');
        const { createSDKConfig } = await import('./nodejs-client/scripts/utils/config.js');

        const config = createSDKConfig();
        console.log(`运行模式: ${config.mode}`);
        console.log(`凭据目录: ${config.credentials_dir}`);

        const authResult = await createAuthenticator(credentialName, config);

        if (authResult) {
            const [auth, identity] = authResult;

            logOperation(3, 'CREDENTIAL_LOADED', {
                did: identity.did,
                userId: identity.userId || identity.user_id,
                jwtTokenExists: identity.jwt_token !== null && identity.jwt_token !== undefined,
                jwtTokenLength: identity.jwt_token ? identity.jwt_token.length : 0,
                mode: config.mode
            });

            // 检查 JWT 过期时间
            if (identity.jwt_token) {
                try {
                    const parts = identity.jwt_token.split('.');
                    if (parts.length === 3) {
                        // 解码 JWT payload
                        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                        const exp = payload.exp;
                        if (exp) {
                            const expTime = new Date(exp * 1000);
                            const now = new Date();
                            const isExpired = now > expTime;

                            logOperation(4, 'JWT_ANALYSIS', {
                                expiresAt: expTime.toISOString(),
                                currentTime: now.toISOString(),
                                isExpired,
                                expiredSecondsAgo: isExpired ? Math.floor((now - expTime) / 1000) : 0
                            });
                        }
                    }
                } catch (error) {
                    logOperation(4, 'JWT_ANALYSIS_ERROR', {
                        error: error.message
                    });
                }
            }

            logOperation(5, 'CREATE_AUTHENTICATOR', {
                method: 'createAuthenticator',
                credential: credentialName,
                mode: config.mode
            });
        } else {
            logOperation(3, 'CREDENTIAL_NOT_FOUND', {
                credentialName
            });
            return;
        }
    } catch (error) {
        logOperation(2, 'CREDENTIAL_LOAD_ERROR', {
            error: error.message
        });
        return;
    }

    // 保存采集的数据
    const outputFile = join(__dirname, 'nodejs_trace_output.json');
    writeFileSync(outputFile, JSON.stringify(traceData, null, 2));

    logOperation(6, 'FINISH', {
        outputFile,
        totalOperations: traceData.operations.length
    });

    console.log(`\nTrace data saved to: ${outputFile}`);
}

main().catch(error => {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});
