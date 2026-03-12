/**
 * 模式配置模块
 * 
 * 管理调试模式和正常模式的开关
 * 
 * 调试模式: 使用本项目文件夹内的路径 (nodejs-client/.credentials)
 * 正常模式: 使用 Python 版本相同的路径 (C:\Users\hyg\.openclaw\credentials\...)
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 检测运行环境
function detectMode() {
    // 检查命令行参数
    const args = process.argv.slice(2);
    if (args.includes('--debug') || args.includes('-d')) {
        return 'debug';
    }
    if (args.includes('--normal') || args.includes('-n')) {
        return 'normal';
    }
    
    // 检查环境变量
    if (process.env.NODE_AWIKI_MODE === 'debug') {
        return 'debug';
    }
    if (process.env.NODE_AWIKI_MODE === 'normal') {
        return 'normal';
    }
    
    // 默认模式: 根据当前目录判断
    const currentDir = process.cwd();
    if (currentDir.includes('nodejs-client')) {
        return 'debug';
    }
    
    return 'normal';
}

// 当前模式
export const MODE = detectMode();

// 路径配置
export const PATHS = {
    debug: {
        credentialsDir: join(__dirname, '..', '..', '.credentials'),
        databaseDir: join(__dirname, '..', '..', '.data'),
        logDir: join(__dirname, '..', '..', '.logs')
    },
    normal: {
        credentialsDir: process.platform === 'win32' 
            ? join('C:', 'Users', process.env.USERNAME || 'hyg', '.openclaw', 'credentials', 'awiki-agent-id-message')
            : join(process.env.HOME || '/home/user', '.openclaw', 'credentials', 'awiki-agent-id-message'),
        databaseDir: process.platform === 'win32'
            ? join('C:', 'Users', process.env.USERNAME || 'hyg', '.openclaw', 'workspace', 'data', 'awiki-agent-id-message', 'database')
            : join(process.env.HOME || '/home/user', '.openclaw', 'workspace', 'data', 'awiki-agent-id-message', 'database'),
        logDir: process.platform === 'win32'
            ? join('C:', 'Users', process.env.USERNAME || 'hyg', '.openclaw', 'workspace', 'data', 'awiki-agent-id-message', 'logs')
            : join(process.env.HOME || '/home/user', '.openclaw', 'workspace', 'data', 'awiki-agent-id-message', 'logs')
    }
};

/**
 * 获取当前模式的路径配置
 * @returns {Object} 路径配置对象
 */
export function getCurrentPaths() {
    return PATHS[MODE];
}

/**
 * 获取凭据目录路径
 * @returns {string} 凭据目录路径
 */
export function getCredentialsDir() {
    return getCurrentPaths().credentialsDir;
}

/**
 * 获取数据库目录路径
 * @returns {string} 数据库目录路径
 */
export function getDatabaseDir() {
    return getCurrentPaths().databaseDir;
}

/**
 * 获取日志目录路径
 * @returns {string} 日志目录路径
 */
export function getLogDir() {
    return getCurrentPaths().logDir;
}

/**
 * 打印当前模式信息
 */
export function printModeInfo() {
    console.log(`运行模式: ${MODE}`);
    console.log(`凭据目录: ${getCredentialsDir()}`);
    console.log(`数据库目录: ${getDatabaseDir()}`);
    console.log(`日志目录: ${getLogDir()}`);
}

export default {
    MODE,
    PATHS,
    getCurrentPaths,
    getCredentialsDir,
    getDatabaseDir,
    getLogDir,
    printModeInfo
};
