const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const puppeteer = require('puppeteer');

const {
    getMagnetSites,
    formatString,
    initEncoding,
    PROFILE_DIR
} = require('./common');

process.env.CHROME_PATH = '';
process.env.DISABLE_DEV_SHM_USAGE = '1';

initEncoding();

const CONCURRENCY = 4;
const SEARCH_DELAY = 2000;

// DDCL 专用配置
const DDCL_CONCURRENCY = 1; // DDCL 只能单线程访问
const DDCL_REAL_DOMAIN_CACHE = {
    domain: null,
    updatedAt: null,
    isRefreshing: false,
    refreshFailures: 0
};
const DDCL_MAX_REFRESH_FAILURES = 3; // 最多允许刷新失败次数

let collectedMagnets = [];
let profileData = null;
let profileFile = null;
let browser = null;

function outputMagnets() {
    console.log('');
    console.log('========================================');
    console.log('执行结果');
    console.log('========================================');
    if (collectedMagnets.length > 0) {
        console.log('[*] 收集到 ' + collectedMagnets.length + ' 个磁链 (Tixati导入格式):\n');
        for (const { magnet } of collectedMagnets) {
            console.log(magnet);
        }
    } else {
        console.log('[*] 未收集到新的磁链');
    }
}

function saveCache() {
    if (profileData && profileFile && collectedMagnets.length > 0) {
        const magnetLines = collectedMagnets.map(m => m.magnet).filter(m => m && m.trim()).join('\n');
        profileData.cache = {
            updated_at: new Date().toISOString(),
            magnets: magnetLines
        };
        fs.writeFileSync(profileFile, yaml.dump(profileData, { 
            allowUnicode: true, 
            lineWidth: -1, 
            noRefs: true,
            styles: {
                '!!str': '|' 
            }
        }));
    }
}

function cleanup() {
    console.log('');
    console.log('[*] 正在清理...');
    saveCache();
    if (browser) {
        try {
            browser.close();
        } catch (e) {
        }
    }
    outputMagnets();
    setTimeout(() => process.exit(0), 100);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function refreshDdclDomain(browser) {
    // 防止并发刷新
    if (DDCL_REAL_DOMAIN_CACHE.isRefreshing) {
        // 等待刷新完成
        while (DDCL_REAL_DOMAIN_CACHE.isRefreshing) {
            await new Promise(r => setTimeout(r, 500));
        }
        return DDCL_REAL_DOMAIN_CACHE.domain !== null;
    }

    DDCL_REAL_DOMAIN_CACHE.isRefreshing = true;
    console.log('    [DDCL] 检测到域名可能已变更，正在获取新域名...');

    let page = null;
    try {
        page = await browser.newPage();
        page.setDefaultTimeout(60000);
        page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto('http://ddcl.me', { waitUntil: 'load', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));
        const currentUrl = page.url();
        const urlObj = new URL(currentUrl);
        const newDomain = urlObj.protocol + '//' + urlObj.hostname;

        DDCL_REAL_DOMAIN_CACHE.domain = newDomain;
        DDCL_REAL_DOMAIN_CACHE.updatedAt = new Date();
        DDCL_REAL_DOMAIN_CACHE.refreshFailures = 0;
        console.log('    [DDCL] 获取到新域名：' + newDomain);

        await page.close();
        DDCL_REAL_DOMAIN_CACHE.isRefreshing = false;
        return true;
    } catch (e) {
        DDCL_REAL_DOMAIN_CACHE.refreshFailures++;
        console.error('    [DDCL] 获取新域名失败：' + e.message + ' (失败次数：' + DDCL_REAL_DOMAIN_CACHE.refreshFailures + '/' + DDCL_MAX_REFRESH_FAILURES + ')');
        if (page) await page.close().catch(() => {});
        DDCL_REAL_DOMAIN_CACHE.isRefreshing = false;
        return false;
    }
}

async function isDdclDomainValid(browser, testUrl) {
    // 测试当前域名是否有效：访问搜索页，检查是否能正常返回
    let page = null;
    try {
        page = await browser.newPage();
        page.setDefaultTimeout(30000);
        page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 访问首页测试连通性
        await page.goto(testUrl, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        // 检查页面是否包含 DDCL 的特征（比如搜索框或 footer）
        const isValid = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            // 检查是否包含 DDCL 的特征文本
            const hasDdclFeature = bodyText.includes('DDCL') || 
                                   bodyText.includes('搜索') || 
                                   bodyText.includes('Search') ||
                                   document.querySelector('table') !== null;
            // 检查是否是错误页面
            const isErrorPage = bodyText.includes('无法访问') || 
                               bodyText.includes('Error') ||
                               bodyText.includes('404') ||
                               bodyText.includes('502') ||
                               bodyText.includes('503');
            return hasDdclFeature && !isErrorPage;
        });

        await page.close();
        return isValid;
    } catch (e) {
        if (page) await page.close().catch(() => {});
        return false;
    }
}

async function searchDdcl(browser, code) {
    const siteConfig = {
        name: 'DDCL (ddcl.me)',
        realDomain: DDCL_REAL_DOMAIN_CACHE.domain,
        pageLoadWait: 3000,
        detailPageLoadWait: 3000,
        pageDelay: 2000
    };

    // 如果没有真实域名，尝试刷新
    if (!siteConfig.realDomain) {
        const refreshed = await refreshDdclDomain(browser);
        if (!refreshed) {
            console.log('    [DDCL] 真实域名不可用，跳过搜索');
            return { site: siteConfig.name, magnet: null };
        }
        siteConfig.realDomain = DDCL_REAL_DOMAIN_CACHE.domain;
    }

    let page = null;
    let domainRefreshed = false; // 标记是否已刷新过域名

    try {
        page = await browser.newPage();
        page.setDefaultTimeout(60000);

        // 设置随机 User-Agent
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);

        // 逐页搜索，直到找到文件名含番号的页面
        let found = false;
        let magnet = null;
        let pageNum = 1;
        const maxPages = 10; // 最多搜索 10 页

        // 规范化番号：转为大写，移除连字符，用于模糊匹配
        const normalizedCode = code.toUpperCase().replace(/-/g, '');
        console.log('    [DDCL] 搜索 ' + code);

        while (!found && pageNum <= maxPages) {
            // 构建搜索 URL: https://realDomain/search/SSIS-471_click_1.html
            const searchUrl = siteConfig.realDomain + '/search/' + code + '_click_' + pageNum + '.html';

            await page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
            await new Promise(r => setTimeout(r, siteConfig.pageLoadWait));

            // 检查页面是否有效（域名是否已切换）
            const pageValid = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                // 检查是否是错误页面或重定向页面
                const isErrorPage = bodyText.includes('无法访问') || 
                                   bodyText.includes('Error') ||
                                   bodyText.includes('404') ||
                                   bodyText.includes('502') ||
                                   bodyText.includes('503') ||
                                   bodyText.includes('504') ||
                                   bodyText.includes('Bad Gateway') ||
                                   bodyText.includes('Service Unavailable');
                return !isErrorPage;
            });

            // 如果页面无效且尚未刷新过域名，尝试刷新
            if (!pageValid && !domainRefreshed && DDCL_REAL_DOMAIN_CACHE.refreshFailures < DDCL_MAX_REFRESH_FAILURES) {
                console.log('    [DDCL] 当前域名可能已失效，尝试刷新域名...');
                const refreshed = await refreshDdclDomain(browser);
                if (refreshed) {
                    siteConfig.realDomain = DDCL_REAL_DOMAIN_CACHE.domain;
                    domainRefreshed = true;
                    console.log('    [DDCL] 使用新域名继续搜索：' + siteConfig.realDomain);
                    // 刷新后重新加载当前搜索页
                    await page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
                    await new Promise(r => setTimeout(r, siteConfig.pageLoadWait));
                } else {
                    console.log('    [DDCL] 刷新域名失败，使用旧域名继续尝试');
                }
            }

            // 检查是否有搜索结果 - 通过表格数量判断
            // 有结果的页面会有多个表格（每个结果项一个表格），无结果的页面表格数为 0
            const tableCount = await page.evaluate(() => {
                return document.querySelectorAll('table').length;
            });

            // 检查是否显示"没有找到"提示（辅助判断）
            const noResultsMessage = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                if (bodyText.includes('抱歉') && bodyText.includes('没有找到')) {
                    const match = bodyText.match(/抱歉 [，,]?没有找到 [^"'<>\n]*/i);
                    return match ? match[0] : '没有找到相关结果';
                }
                return null;
            });

            if (noResultsMessage) {
                console.log('    [DDCL] ' + noResultsMessage);
                break;
            }

            // 如果没有表格，说明没有搜索结果
            if (tableCount === 0) {
                break;
            }

            // 获取搜索结果条目列表
            // 根据分析，每个结果项是 div.panel.panel-default，链接在 h5.item-title a 中
            const items = await page.evaluate(() => {
                const result = [];
                const panels = document.querySelectorAll('div.panel.panel-default');
                
                for (const panel of panels) {
                    const linkEl = panel.querySelector('h5.item-title a');
                    if (linkEl) {
                        const name = linkEl.textContent ? linkEl.textContent.trim() : '';
                        const link = linkEl.href || '';
                        if (name && link) {
                            result.push({ name, link });
                        }
                    }
                }
                
                return result;
            });

            console.log('    [DDCL] 第 ' + pageNum + ' 页找到 ' + items.length + ' 个条目');

            // 逐个条目进入详情页，检查文件列表
            for (const item of items) {
                // 点击进入详情页
                await page.goto(item.link, { waitUntil: 'load', timeout: 60000 });
                await new Promise(r => setTimeout(r, siteConfig.detailPageLoadWait));

                // 获取文件列表 - 使用正确的选择器：table.table-striped tr
                const files = await page.evaluate(() => {
                    const table = document.querySelector('table.table-striped');
                    if (!table) return [];

                    const rows = table.querySelectorAll('tbody tr');
                    const result = [];
                    for (const row of rows) {
                        const td = row.querySelector('td');
                        if (td) {
                            result.push(td.textContent.trim());
                        }
                    }
                    return result;
                });

                // 检查文件列表中是否有文件名包含番号
                for (const fileName of files) {
                    const normalizedFileName = fileName.toUpperCase().replace(/[-.]/g, '');

                    if (normalizedFileName.includes(normalizedCode)) {
                        // 在当前详情页提取磁链
                        magnet = await page.$('textarea#MagnetLink')
                            .then(el => el ? el.evaluate(e => e.value) : null)
                            .catch(() => null);

                        if (!magnet) {
                            magnet = await page.$('a[href^="magnet:"]')
                                .then(el => el ? el.evaluate(e => e.href) : null)
                                .catch(() => null);
                        }

                        if (magnet) {
                            console.log('    [DDCL] 找到磁链');
                            found = true;
                            break;
                        }
                    }
                }

                if (found) break;

                // 返回搜索结果页继续检查下一个条目
                await page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
                await new Promise(r => setTimeout(r, siteConfig.pageLoadWait));
            }

            if (!found) {
                // 等待后进入下一页
                await new Promise(r => setTimeout(r, siteConfig.pageDelay));
                pageNum++;
            }
        }

        await page.close();
        return { site: siteConfig.name, magnet };

    } catch (e) {
        console.error('    [DDCL] 失败：' + e.message);
        if (page) await page.close().catch(() => {});
        return { site: siteConfig.name, magnet: null };
    }
}

async function searchMagnetWithSite(browser, code, site) {
    const siteConfig = site;
    const searchConfig = siteConfig.search;
    const resultConfig = siteConfig.result;
    const detailConfig = siteConfig.detail;
    const pageLoadWait = siteConfig.pageLoadWait || 3000;
    const detailPageLoadWait = siteConfig.detailPageLoadWait || 3000;
    
    let page;
    try {
        page = await browser.newPage();
        page.setDefaultTimeout(60000);
        
        const searchUrl = formatString(siteConfig.searchCodeUrl, {
            baseUrl: siteConfig.baseUrl,
            code: code
        });
        
        await page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
        await new Promise(r => setTimeout(r, pageLoadWait));
        
        let result;
        
        if (resultConfig.linkPattern) {
            result = await page.evaluate((searchCfg, resultCfg, code) => {
                const items = document.querySelectorAll(searchCfg.itemSelector);
                const data = [];
                const maxResults = searchCfg.maxResults || 3;
                const linkPattern = new RegExp(resultCfg.linkPattern);
                
                for (let i = 0; i < Math.min(maxResults, items.length); i++) {
                    const linkEl = items[i].querySelector(resultCfg.linkSelector);
                    if (!linkEl) continue;
                    const href = linkEl.href || linkEl.getAttribute('href') || '';
                    if (!href) continue;
                    const match = href.match(linkPattern);
                    if (match) {
                        const fullUrl = href.startsWith('http') ? href : 'https://www.torrentdownload.info' + href;
                        data.push({ title: linkEl.textContent || '', link: fullUrl });
                    }
                }
                return data;
            }, searchConfig, resultConfig, code);
        } else {
            result = await page.evaluate((searchCfg, resultCfg) => {
                const items = document.querySelectorAll(searchCfg.itemSelector);
                const data = [];
                const maxResults = searchCfg.maxResults || 3;
                for (let i = 0; i < Math.min(maxResults, items.length); i++) {
                    const title = items[i].querySelector(resultCfg.titleSelector)?.textContent || '';
                    const link = items[i].querySelector(resultCfg.linkSelector)?.href || '';
                    data.push({ title, link });
                }
                return data;
            }, searchConfig, resultConfig);
        }
        
        if (result.length === 0) {
            await page.close();
            return { site: siteConfig.name, magnet: null };
        }
        
        for (let i = 0; i < result.length; i++) {
            const { title, link } = result[i];
            
            if (title.toUpperCase().includes(code.toUpperCase())) {
                await page.goto(link, { waitUntil: 'load', timeout: 60000 });
                await new Promise(r => setTimeout(r, detailPageLoadWait));
                
                let magnet = null;
                if (detailConfig.magnetInputSelector) {
                    magnet = await page.$(detailConfig.magnetInputSelector)
                        .then(el => el ? el.evaluate(e => e.value) : null)
                        .catch(() => null);
                } else if (detailConfig.magnetLinkSelector) {
                    magnet = await page.$(detailConfig.magnetLinkSelector)
                        .then(el => el ? el.evaluate(e => e.href) : null)
                        .catch(() => null);
                }
                
                await page.close();
                return { site: siteConfig.name, magnet };
            }
        }
        
        for (let i = 0; i < result.length; i++) {
            const { link } = result[i];
            await page.goto(link, { waitUntil: 'load', timeout: 60000 });
            await new Promise(r => setTimeout(r, detailPageLoadWait));
            
            if (detailConfig.filesSelector) {
                const files = await page.evaluate((selector) => {
                    const rows = document.querySelectorAll(selector);
                    return Array.from(rows).map(row => row.textContent.trim());
                }, detailConfig.filesSelector).catch(() => []);
                
                const hasCodeInFiles = files.some(f => f.toUpperCase().includes(code.toUpperCase()));
                
                if (hasCodeInFiles) {
                    let magnet = null;
                    if (detailConfig.magnetInputSelector) {
                        magnet = await page.$(detailConfig.magnetInputSelector)
                            .then(el => el ? el.evaluate(e => e.value) : null)
                            .catch(() => null);
                    } else if (detailConfig.magnetLinkSelector) {
                        magnet = await page.$(detailConfig.magnetLinkSelector)
                            .then(el => el ? el.evaluate(e => e.href) : null)
                            .catch(() => null);
                    }
                    await page.close();
                    return { site: siteConfig.name, magnet };
                }
            }
        }
        
        await page.close();
        return { site: siteConfig.name, magnet: null };
    } catch (e) {
        console.error('    [' + siteConfig.name + '] 失败: ' + e.message);
        if (page) await page.close().catch(() => {});
        return { site: siteConfig.name, magnet: null };
    }
}

async function searchMagnet(browser, code) {
    const sites = getMagnetSites();

    for (const site of sites) {
        console.log('    -> [' + site.name + '] 搜索 ' + code);
        
        // DDCL 使用专门的搜索函数
        if (site.name && site.name.includes('DDCL')) {
            const result = await searchDdcl(browser, code);
            if (result.magnet) {
                console.log('    -> [' + result.site + '] 找到磁链');
                return result.magnet;
            }
        } else {
            const result = await searchMagnetWithSite(browser, code, site);
            if (result.magnet) {
                console.log('    -> [' + result.site + '] 找到磁链');
                return result.magnet;
            }
        }
    }

    return null;
}

async function processWork(work, browser, profileData, profileFile, newMagnets) {
    console.log('[' + work.index + '/' + work.total + '] 搜索: ' + work.code);
    
    const magnet = await searchMagnet(browser, work.code);
    if (magnet) {
        work.data.magnet = magnet;
        work.data.magnet_updated_at = new Date().toISOString();
        newMagnets.push({ code: work.code, magnet });
        console.log('[' + work.index + '/' + work.total + '] ' + work.code + ' -> Found');
        
        const magnetLines = newMagnets.map(m => m.magnet).filter(m => m && m.trim()).join('\n');
        profileData.cache = {
            updated_at: new Date().toISOString(),
            magnets: magnetLines
        };
        fs.writeFileSync(profileFile, yaml.dump(profileData, { 
            allowUnicode: true, 
            lineWidth: -1, 
            noRefs: true,
            styles: {
                '!!str': '|'
            }
        }));
    } else {
        console.log('[' + work.index + '/' + work.total + '] ' + work.code + ' -> Not found');
    }
    
    await new Promise(r => setTimeout(r, SEARCH_DELAY));
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.log('用法: node getmagnet.js <演员中文名>');
        console.log('示例: node getmagnet.js 三宫椿');
        process.exit(1);
    }
    
    const sites = getMagnetSites();
    console.log('[*] 已加载 ' + sites.length + ' 个磁链搜索网站: ' + sites.map(s => s.name).join(', ') + '\n');
    
    const name = args[0];
    profileFile = path.join(PROFILE_DIR, name + '.yaml');
    
    if (!fs.existsSync(profileFile)) {
        console.error('[-] 不存在演员 ' + name + ' 的profile文件');
        console.error('    请先运行: node getcode.js ' + name);
        process.exit(1);
    }
    
    console.log('========================================');
    console.log('演员: ' + name);
    console.log('并发数: ' + CONCURRENCY);
    console.log('========================================\n');
    
    profileData = yaml.load(fs.readFileSync(profileFile, 'utf-8'));
    delete profileData.cache;
    
    if (!profileData.works || profileData.works.length === 0) {
        console.log('[-] 该演员没有作品记录');
        console.log('    请先运行: node getcode.js ' + name + ' <日期>');
        process.exit(1);
    }
    
    const worksWithoutMagnet = profileData.works
        .filter(w => !w.magnet)
        .map((w, i) => ({ data: w, code: w.code, index: i + 1 }));
    
    console.log('[*] 共 ' + profileData.works.length + ' 部作品，其中 ' + worksWithoutMagnet.length + ' 部没有磁链\n');
    
    if (worksWithoutMagnet.length === 0) {
        console.log('[*] 所有作品都已存在磁链');
        saveCache();
        process.exit(0);
    }
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            dumpio: false,
            env: {
                ...process.env,
                PUPPETEER_SKIP_DOWNLOAD: 'true',
                PUPPETEER_NO_SANDBOX: '1',
                PUPPETEER_DISABLE_SETUID_SANDBOX: '1'
            },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-logging',
                '--log-level=3',
                '--silent',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-features=HttpsFirstBalancedModeAutoEnable'
            ]
        });

        // 预先获取 DDCL 真实域名（避免并发访问导致被阻止）
        console.log('[*] 正在获取 DDCL 真实域名...');
        const initPage = await browser.newPage();
        initPage.setDefaultTimeout(60000);
        initPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        try {
            await initPage.goto('http://ddcl.me', { waitUntil: 'load', timeout: 60000 });
            await new Promise(r => setTimeout(r, 3000));
            const currentUrl = initPage.url();
            const urlObj = new URL(currentUrl);
            DDCL_REAL_DOMAIN_CACHE.domain = urlObj.protocol + '//' + urlObj.hostname;
            DDCL_REAL_DOMAIN_CACHE.updatedAt = new Date();
            console.log('[*] DDCL 真实域名：' + DDCL_REAL_DOMAIN_CACHE.domain);
        } catch (e) {
            console.error('[*] 获取 DDCL 真实域名失败：' + e.message);
        } finally {
            await initPage.close().catch(() => {});
        }

        const total = worksWithoutMagnet.length;
        let workIndex = 0;
        const running = [];
        
        const runWork = async (work) => {
            await processWork(work, browser, profileData, profileFile, collectedMagnets);
        };
        
        while (workIndex < worksWithoutMagnet.length || running.length > 0) {
            while (workIndex < worksWithoutMagnet.length && running.length < CONCURRENCY) {
                const work = { ...worksWithoutMagnet[workIndex], total };
                workIndex++;
                const p = runWork(work);
                running.push(p);
                p.then(() => {
                    const idx = running.indexOf(p);
                    if (idx > -1) running.splice(idx, 1);
                });
            }
            if (running.length > 0) {
                await Promise.any(running);
            }
        }
        
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
            }
        }
    }

    saveCache();
    outputMagnets();
    process.exit(0);
}

main();
