const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Nextcloud 配置
const TAB_URL = process.env.TAB_URL.replace(/\/*$/, '');
const TAB_USER = process.env.TAB_USER;
const TAB_PASS = process.env.TAB_PASS;

// Axios 配置 (直接访问 HTTP API)
const axiosConfig = {
    auth: {
        username: TAB_USER,
        password: TAB_PASS
    },
    headers: {
        'OCS-APIRequest': 'true'
    }
};

// Nextcloud 服务器地址 (用于 API 调用)
const NEXTCLOUD_BASE_URL = TAB_URL.replace('/remote.php/dav/files/hyg', '');

// 1. 初始化：设置只读共享，返回共享url和shareId
// 修改：接收 localPath，自己生成 remotePath
async function initialize(localPath) {
    try {
        // 从环境变量获取 draft 文件夹名称
        const TAB_DRAFT_FOLDER = process.env.TAB_DRAFT_FOLDER || 'draft';
        // 根据 localPath 生成 remotePath
        const remoteName = path.basename(localPath);
        const remotePath = `/${TAB_DRAFT_FOLDER}/${remoteName}`;
        
        // 创建只读共享
        const shareUrl = `${NEXTCLOUD_BASE_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`;
        const shareData = new URLSearchParams();
        shareData.append('path', remotePath);
        shareData.append('shareType', 3); // 3 = 公开链接共享
        
        const response = await axios.post(shareUrl, shareData, axiosConfig);
        
        const shareInfo = response.data.ocs.data;
        console.log(`✓ 共享已创建: ${path.basename(remotePath)} -> ${shareInfo.url}`);
        // HTTP模块返回共享URL和shareId，供main.js维护到filemap中
        return {
            url: shareInfo.url,
            shareId: shareInfo.id
        };
    } catch (error) {
        console.error(`✗ 创建共享失败 ${localPath}:`, error.message);
        return null;
    }
}

// 2. 上传：上传本地文件内容到服务器同名文件
async function upload(localPath) {
    try {
        const content = fs.readFileSync(localPath, 'utf8');
        const remoteName = path.basename(localPath);
        const remotePath = `/${remoteName}`;
        
        // 上传文件到Nextcloud
        const uploadUrl = `${TAB_URL}${remotePath}`;
        await axios.put(uploadUrl, content, {
            ...axiosConfig,
            headers: {
                'Content-Type': 'text/markdown'
            }
        });
        
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
        const remotePath = `/${remoteName}`;
        
        // 删除文件
        const deleteUrl = `${TAB_URL}${remotePath}`;
        await axios.delete(deleteUrl, axiosConfig);
        
        console.log(`✓ 文件已删除: ${remoteName}`);
        return true;
    } catch (error) {
        console.error(`✗ 删除文件失败 ${localPath}:`, error.message);
        return false;
    }
}

// 4. 取消共享
async function unshare(shareId) {
    try {
        // 删除共享
        if (shareId) {
            const shareUrl = `${NEXTCLOUD_BASE_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares/${shareId}`;
            await axios.delete(shareUrl, axiosConfig);
            console.log(`✓ 共享已取消`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`✗ 取消共享失败 (ID: ${shareId}):`, error.message);
        return false;
    }
}

module.exports = {
    initialize,
    upload,
    remove,
    unshare
};