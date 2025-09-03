const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const yaml = require('js-yaml');
require('dotenv').config();

// 根据需要选择使用 webdav 或 http 模块
// 使用 WebDAV 模块处理文件操作
// const nextcloud = require('./nextcloud-webdav.js');
// 使用 HTTP 模块处理共享操作
const nextcloud = require('./nextcloud-http.js');

// 文件映射对象（由main.js维护，不暴露给其他模块）
let filemap = {};

// Nextcloud 配置
const TAB_DRAFT_FOLDER = process.env.TAB_DRAFT_FOLDER || 'draft';
const LOCAL_DRAFT_DIR = path.resolve(process.env.LOCAL_DRAFT_DIR || '.');
const LOCAL_DAY_DIR = process.env.LOCAL_DAY_DIR || '.';
const LOCAL_LOG_DIR = process.env.LOCAL_LOG_DIR || '.';

// 获取日期字符串
function getdatestr(diff = 0) {
    var theDate = new Date();
    theDate.setDate(theDate.getDate() + diff);

    var year = theDate.getFullYear();
    var month = theDate.getMonth() + 1 < 10 ? "0" + (theDate.getMonth() + 1) : theDate.getMonth() + 1;
    var day = theDate.getDate() < 10 ? "0" + theDate.getDate() : theDate.getDate();
    var dateStr = year + "" + month + "" + day;

    return dateStr;
}

// 获取日小结文件名
function getDayFilename(diff = 0) {
    var datestr = getdatestr(diff);
    return path.join(LOCAL_DAY_DIR, `d.${datestr}.yaml`);
}

// 加载日计划对象
function loaddayobj(diff = 0) {
    var dayobj;
    var datestr = getdatestr(diff);
    var year = datestr.slice(0, 4);
    var dayfilename = getDayFilename(diff);
    
    try {
        if (fs.existsSync(dayfilename)) {
            dayobj = yaml.load(fs.readFileSync(dayfilename, 'utf8', { schema: yaml.FAILSAFE_SCHEMA }));
        } else {
            console.log("日计划文件不存在:", dayfilename);
        }
    } catch (e) {
        console.log("读取日计划文件错误:" + e);
    }
    return dayobj;
}

// 初始化并启动监控 (合并 makefilemap 和 initialSync)
// 使用单个 watcher 实例来管理所有路径
async function init(diff = 0) {
    const filemap = {};
    // 创建一个空的 watcher 实例
    const mainWatcher = chokidar.watch([]);
    
    var dayobj = loaddayobj(diff);
    
    if (!dayobj || !dayobj.time) {
        console.log("日计划数据无效");
        // 即使没有文件，也返回 watcher 实例
        return { filemap, watcher: mainWatcher };
    }

    // 为所有路径设置统一的事件监听器
    mainWatcher
        .on('add', (localPath) => {
            console.log('文件添加:', localPath);
            nextcloud.upload(localPath).catch(err => {
                console.error(`✗ 上传文件失败 ${localPath}:`, err.message);
            });
        })
        .on('change', (localPath) => {
            console.log('文件变更:', localPath);
            nextcloud.upload(localPath).catch(err => {
                console.error(`✗ 上传文件失败 ${localPath}:`, err.message);
            });
        })
        .on('unlink', (localPath) => {
            console.log('本地文件已删除:', localPath);
            // 调用 nextcloud.remove 删除远程文件
            nextcloud.remove(localPath).catch(err => {
                console.error(`✗ 删除远程文件失败 ${localPath}:`, err.message);
            });
        });
    
    for (var i in dayobj.time) {
        var timeperiod = dayobj.time[i];
        
        if ((timeperiod.type == "check") || (timeperiod.type == "work")) {
            // 当前版本，日计划文件的output带有相对路径
            var draftlocalPath = timeperiod.output.split('/').join(path.sep);
            const draftname = path.basename(draftlocalPath);
            
            // 调用 nextcloud 模块的 initialize 方法，获取初始化结果对象
            const initResult = await nextcloud.initialize(draftlocalPath);
            
            // 存储共享信息
            filemap[draftname] = {
                url: initResult.url,
                shareId: initResult.shareId
            };
            
            // 使用 add() 方法添加路径到监控
            if (fs.existsSync(draftlocalPath)) {
                console.log('🚀 添加监控路径:', draftlocalPath);
                mainWatcher.add(draftlocalPath);
            }
        }
    }
    console.log("文件映射:", filemap);
    // 返回 filemap 和单个 watcher 实例
    return { filemap, watcher: mainWatcher };
}

// 删除Nextcloud上的共享和文件

// 删除Nextcloud上的共享和文件
async function deleteShareAndFile(localPath) {
    try {
        // 取消共享 (使用 http 模块)
        const shareId = filemap[localPath].shareId;
        if (shareId) {
            const http = require('./nextcloud-http.js');
            await http.unshare(shareId);
        }
        
        // 删除文件 (使用 webdav 模块)
        const webdav = require('./nextcloud-webdav.js');
        await webdav.remove(localPath);
    } catch (error) {
        console.error(`✗ 删除文件或共享失败 ${localPath}:`, error.message);
    }
}

// 生成日小结文件 (现在命名为 logfile)
function generateDailyLog() {
    const diff = 0;
    var datestr = getdatestr(diff);
    var logfilename = "d."+datestr+".md";
    const LOCAL_DIR = path.resolve(process.env.LOCAL_DIR || './notes');
    const logfile = path.join(LOCAL_DIR, logfilename);
    let logfileContent = `# ${logfilename}\n\n`;
    
    // 收集所有本地文件内容
    for (const localPath in filemap) {
        if (fs.existsSync(localPath)) {
            const content = fs.readFileSync(localPath, 'utf8');
            const filename = path.basename(localPath);
            logfileContent += `## ${filename}\n\n${content}\n\n`;
        }
    }
    
    // 写入本地
    fs.writeFileSync(logfile, logfileContent);
    console.log(`✓ 日小结已生成: ${logfile}`);
    
    return logfile;
}

// 优雅退出处理
async function gracefulShutdown(mainWatcher) {
    console.log('\n正在执行清理操作...');
    
    // 关闭文件监控
    if (mainWatcher) {
        mainWatcher.close();
        console.log('✓ 文件监控已关闭');
    }
    
    // 删除所有共享和文件
    for (const localPath in filemap) {
        await deleteShareAndFile(localPath);
    }
    
    // 生成日小结
    const logPath = generateDailyLog();
    
    // 上传日小结并创建共享
    // 使用 nextcloud.initialize() 代替 uploadLogAndShareFiles()
    const logResult = await nextcloud.initialize(logPath);
    if (logResult && logResult.url) {
        console.log(`日小结共享链接: ${logResult.url}`);
    }
    
    console.log('清理完成，程序退出。');
    process.exit(0);
}

// 主函数
async function main() {
    // 检查必要环境变量
    if (!process.env.TAB_URL || !process.env.TAB_USER || !process.env.TAB_PASS) {
        console.error('缺少必要的环境变量配置');
        process.exit(1);
    }
    
    // 初始化并启动监控
    const { filemap: newFilemap, watcher } = await init();
    // 更新全局 filemap
    filemap = newFilemap;
    
    // 注册退出处理
    const shutdownHandler = () => gracefulShutdown(watcher);
    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    
    console.log('应用已启动，按 Ctrl+C 退出');
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
    main().catch(console.error);
}