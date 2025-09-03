const { createClient } = require("webdav");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Nextcloud 配置
const TAB_URL = process.env.TAB_URL.replace(/\/*$/, '');
const TAB_USER = process.env.TAB_USER;
const TAB_PASS = process.env.TAB_PASS;
const TAB_DRAFT_FOLDER = process.env.TAB_DRAFT_FOLDER || 'draft';

// WebDAV 客户端 (使用 webdav 库)
const webdavClient = createClient(TAB_URL, {
    username: TAB_USER,
    password: TAB_PASS
});

// 1. 初始化：在服务器的draft文件夹创建同名文件，上传本地文件内容
async function initialize(localPath) {
    try {
        // 读取本地文件内容
        const content = fs.readFileSync(localPath, 'utf8');
        const remoteName = path.basename(localPath);
        // 在draft文件夹中创建文件
        const remotePath = `/${TAB_DRAFT_FOLDER}/${remoteName}`;
        
        // 上传文件到Nextcloud
        await webdavClient.putFileContents(remotePath, content);
        console.log(`✓ 文件已初始化: ${remoteName}`);
        
        // WebDAV模块只返回远程文件路径，不返回共享URL
        // 共享URL由HTTP模块创建并返回
        return remotePath;
    } catch (error) {
        console.error(`✗ 初始化文件失败 ${localPath}:`, error.message);
        return null;
    }
}

// 2. 上传：上传本地文件内容到服务器同名文件
async function upload(localPath) {
    try {
        // 读取本地文件内容
        const content = fs.readFileSync(localPath, 'utf8');
        const remoteName = path.basename(localPath);
        const remotePath = `/${TAB_DRAFT_FOLDER}/${remoteName}`;
        
        // 上传文件到Nextcloud
        await webdavClient.putFileContents(remotePath, content);
        console.log(`✓ 文件已上传: ${remoteName}`);
        return true;
    } catch (error) {
        console.error(`✗ 上传文件失败 ${localPath}:`, error.message);
        return false;
    }
}

// 3. 删除：删除服务器同名文件
async function remove(localPath) {
    try {
        const remoteName = path.basename(localPath);
        const remotePath = `/${TAB_DRAFT_FOLDER}/${remoteName}`;
        
        // 删除文件
        await webdavClient.deleteFile(remotePath);
        console.log(`✓ 文件已删除: ${remoteName}`);
        return true;
    } catch (error) {
        console.error(`✗ 删除文件失败 ${localPath}:`, error.message);
        return false;
    }
}

module.exports = {
    initialize,
    upload,
    remove
};