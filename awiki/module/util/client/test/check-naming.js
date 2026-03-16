/**
 * 命名规范检查工具
 *
 * 验证 TypeScript 代码符合命名规范：
 * - 函数名：camelCase（与 Python snake_case 对应）
 * - 变量名：camelCase
 * - 常量：UPPER_CASE
 * - 配置属性：snake_case（与 Python 保持一致）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 检查 snake_case 格式
 */
function isSnakeCase(str) {
    return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(str);
}

/**
 * 检查 camelCase 格式
 */
function isCamelCase(str) {
    return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

/**
 * 检查 UPPER_CASE 格式
 */
function isUpperCase(str) {
    return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(str);
}

/**
 * 检查 PascalCase 格式（类名）
 */
function isPascalCase(str) {
    return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

/**
 * 提取源代码中的标识符
 */
function extractIdentifiers(sourceCode) {
    const results = {
        functions: [],
        variables: [],
        constants: [],
        classes: [],
        configProps: [],
    };

    // 提取函数名（function 关键字和箭头函数）
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)/g;
    let match;
    while ((match = functionRegex.exec(sourceCode)) !== null) {
        const funcName = match[1] || match[2];
        if (funcName && !funcName.startsWith('_')) {
            results.functions.push(funcName);
        }
    }

    // 提取 const 常量
    const constRegex = /const\s+([A-Z_][A-Z0-9_]*)\s*=/g;
    while ((match = constRegex.exec(sourceCode)) !== null) {
        results.constants.push(match[1]);
    }

    // 提取变量名
    const varRegex = /(?:let|const|var)\s+([a-z][a-zA-Z0-9]*)\s*=/g;
    while ((match = varRegex.exec(sourceCode)) !== null) {
        const varName = match[1];
        if (!isUpperCase(varName)) {
            results.variables.push(varName);
        }
    }

    // 提取类名
    const classRegex = /class\s+([A-Z][a-zA-Z0-9]*)/g;
    while ((match = classRegex.exec(sourceCode)) !== null) {
        results.classes.push(match[1]);
    }

    // 提取接口属性（snake_case）
    const propRegex = /(\w+_+\w+)\s*:\s*/g;
    while ((match = propRegex.exec(sourceCode)) !== null) {
        if (isSnakeCase(match[1])) {
            results.configProps.push(match[1]);
        }
    }

    return results;
}

/**
 * 执行命名规范检查
 */
function checkNamingConvention() {
    const sourcePath = join(__dirname, '..', 'src', 'client.ts');
    const typesPath = join(__dirname, '..', 'src', 'types.ts');
    
    console.log('='.repeat(60));
    console.log('命名规范检查报告');
    console.log('='.repeat(60));
    console.log();

    let allPassed = true;
    const results = [];

    // 读取源代码
    const clientSource = readFileSync(sourcePath, 'utf-8');
    const typesSource = readFileSync(typesPath, 'utf-8');

    // 检查函数名（camelCase，与 Python snake_case 对应）
    console.log('1. 函数名检查 (camelCase，对应 Python snake_case)');
    console.log('-'.repeat(50));
    
    const expectedFunctions = [
        { ts: '_resolveVerify', py: '_resolve_verify' },
        { ts: 'createUserServiceClient', py: 'create_user_service_client' },
        { ts: 'createMoltMessageClient', py: 'create_molt_message_client' },
    ];

    for (const { ts, py } of expectedFunctions) {
        const exists = clientSource.includes(ts);
        const status = exists ? '✓' : '✗';
        console.log(`   ${status} ${ts} (Python: ${py})`);
        if (!exists) allPassed = false;
    }
    console.log();

    // 检查配置属性（snake_case，与 Python 一致）
    console.log('2. 配置属性检查 (snake_case，与 Python 一致)');
    console.log('-'.repeat(50));
    
    const expectedProps = [
        'user_service_url',
        'molt_message_url',
        'molt_message_ws_url',
        'did_domain',
        'credentials_dir',
        'data_dir',
    ];

    for (const prop of expectedProps) {
        const exists = typesSource.includes(prop);
        const status = exists ? '✓' : '✗';
        console.log(`   ${status} ${prop}`);
        if (!exists) allPassed = false;
    }
    console.log();

    // 检查常量（UPPER_CASE）
    console.log('3. 常量检查 (UPPER_CASE)');
    console.log('-'.repeat(50));
    
    // 检查测试文件中的常量
    const testPath = join(__dirname, 'client.comprehensive.test.js');
    const testSource = readFileSync(testPath, 'utf-8');
    
    const expectedConstants = [
        'TEST_CA_CONTENT',
        'DEFAULT_TIMEOUT',
        'DEFAULT_TRUST_ENV',
    ];

    for (const constant of expectedConstants) {
        const exists = testSource.includes(constant);
        const status = exists ? '✓' : '✗';
        console.log(`   ${status} ${constant}`);
        if (!exists) allPassed = false;
    }
    console.log();

    // 检查变量命名（camelCase）
    console.log('4. 变量命名检查 (camelCase)');
    console.log('-'.repeat(50));
    
    const camelCaseVars = [
        'testCaPath',
        'originalEnv',
        'saved',
        'config',
        'client',
        'userClient',
        'messageClient',
    ];

    for (const variable of camelCaseVars) {
        const exists = testSource.includes(variable);
        const status = exists ? '✓' : '✗';
        console.log(`   ${status} ${variable}`);
        if (!exists) allPassed = false;
    }
    console.log();

    // 检查类名（PascalCase）
    console.log('5. 类名检查 (PascalCase)');
    console.log('-'.repeat(50));
    
    const expectedClasses = [
        'HttpClientImpl',
    ];

    for (const className of expectedClasses) {
        const exists = clientSource.includes(`class ${className}`);
        const status = exists ? '✓' : '✗';
        console.log(`   ${status} ${className}`);
        if (!exists) allPassed = false;
    }
    console.log();

    // 总结
    console.log('='.repeat(60));
    console.log(`检查结果：${allPassed ? '✓ 全部通过' : '✗ 存在不符合项'}`);
    console.log('='.repeat(60));

    return allPassed;
}

// 执行检查
const passed = checkNamingConvention();
process.exit(passed ? 0 : 1);
