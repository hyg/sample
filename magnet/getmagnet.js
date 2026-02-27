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
        const result = await searchMagnetWithSite(browser, code, site);
        if (result.magnet) {
            console.log('    -> [' + result.site + '] 找到磁链');
            return result.magnet;
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
                '--disable-software-rasterizer'
            ]
        });
        
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
}

main();
