const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const puppeteer = require('puppeteer');

const PROFILE_DIR = './profile';
const CONCURRENCY = 3;
const SEARCH_DELAY = 2000;

let collectedMagnets = [];
let profileData = null;
let profileFile = null;
let browser = null;

function outputMagnets() {
    console.log(`\n========================================`);
    console.log(`执行结果`);
    console.log(`========================================`);
    if (collectedMagnets.length > 0) {
        console.log(`[*] 收集到 ${collectedMagnets.length} 个磁链 (Tixati导入格式):\n`);
        for (const { magnet } of collectedMagnets) {
            console.log(magnet);
        }
    } else {
        console.log(`[*] 未收集到新的磁链`);
    }
}

function cleanup() {
    console.log('\n[*] 正在清理...');
    if (browser) {
        browser.close().catch(() => {});
    }
    if (profileData && profileFile) {
        fs.writeFileSync(profileFile, yaml.dump(profileData, { allowUnicode: true }));
    }
    outputMagnets();
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function searchMagnet(browser, code) {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let page;
        try {
            page = await browser.newPage();
            page.setDefaultTimeout(120000);
            
            const searchUrl = `https://cilisousuo.cc/search?q=${code}`;
            await page.goto(searchUrl, { waitUntil: 'load', timeout: 120000 });
            await new Promise(r => setTimeout(r, 5000));
            
            const result = await page.evaluate(() => {
                const items = document.querySelectorAll('li.item');
                const data = [];
                for (let i = 0; i < Math.min(3, items.length); i++) {
                    const title = items[i].querySelector('.result-title')?.textContent || '';
                    const link = items[i].querySelector('a.link')?.href || '';
                    data.push({ title, link });
                }
                return data;
            });
            
            if (result.length === 0) {
                await page.close();
                return null;
            }
            
            for (let i = 0; i < result.length; i++) {
                const { title, link } = result[i];
                
                if (title.toUpperCase().includes(code.toUpperCase())) {
                    await page.goto(link, { waitUntil: 'load', timeout: 120000 });
                    await new Promise(r => setTimeout(r, 3000));
                    const magnet = await page.$eval('#input-magnet', el => el.value).catch(() => null);
                    await page.close();
                    return magnet;
                }
            }
            
            for (let i = 0; i < result.length; i++) {
                const { link } = result[i];
                await page.goto(link, { waitUntil: 'load', timeout: 120000 });
                await new Promise(r => setTimeout(r, 3000));
                
                const files = await page.evaluate(() => {
                    const rows = document.querySelectorAll('.files tbody tr');
                    return Array.from(rows).map(row => row.textContent.trim());
                }).catch(() => []);
                
                const hasCodeInFiles = files.some(f => f.toUpperCase().includes(code.toUpperCase()));
                
                if (hasCodeInFiles) {
                    const magnet = await page.$eval('#input-magnet', el => el.value).catch(() => null);
                    await page.close();
                    return magnet;
                }
            }
            
            await page.close();
            return null;
        } catch (e) {
            console.error(`    Attempt ${attempt} failed: ${e.message}`);
            if (page) await page.close().catch(() => {});
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
    return null;
}

async function processWork(work, browser, profileData, profileFile, newMagnets) {
    console.log(`[${work.index}/${work.total}] 搜索: ${work.code}`);
    
    const magnet = await searchMagnet(browser, work.code);
    if (magnet) {
        work.data.magnet = magnet;
        newMagnets.push({ code: work.code, magnet });
        console.log(`[${work.index}/${work.total}] ${work.code} -> Found`);
        fs.writeFileSync(profileFile, yaml.dump(profileData, { allowUnicode: true }));
    } else {
        console.log(`[${work.index}/${work.total}] ${work.code} -> Not found`);
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
    
    const name = args[0];
    profileFile = path.join(PROFILE_DIR, `${name}.yaml`);
    
    if (!fs.existsSync(profileFile)) {
        console.error(`[-] 不存在演员 ${name} 的profile文件`);
        console.error(`    请先运行: node getcode.js ${name}`);
        process.exit(1);
    }
    
    console.log(`========================================`);
    console.log(`演员: ${name}`);
    console.log(`并发数: ${CONCURRENCY}`);
    console.log(`========================================\n`);
    
    profileData = yaml.load(fs.readFileSync(profileFile, 'utf-8'));
    
    if (!profileData.works || profileData.works.length === 0) {
        console.log(`[-] 该演员没有作品记录`);
        console.log(`    请先运行: node getcode.js ${name} <日期>`);
        process.exit(1);
    }
    
    const worksWithoutMagnet = profileData.works
        .filter(w => !w.magnet)
        .map((w, i) => ({ data: w, code: w.code, index: i + 1 }));
    
    console.log(`[*] 共 ${profileData.works.length} 部作品，其中 ${worksWithoutMagnet.length} 部没有磁链\n`);
    
    if (worksWithoutMagnet.length === 0) {
        console.log(`[*] 所有作品都已存在磁链`);
        process.exit(0);
    }
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const total = worksWithoutMagnet.length;
        
        for (let i = 0; i < worksWithoutMagnet.length; i += CONCURRENCY) {
            const batch = worksWithoutMagnet.slice(i, i + CONCURRENCY);
            const batchWithTotal = batch.map(w => ({ ...w, total }));
            
            await Promise.all(
                batchWithTotal.map(work => 
                    processWork(work, browser, profileData, profileFile, collectedMagnets)
                )
            );
        }
        
    } finally {
        if (browser) await browser.close();
    }
    
    outputMagnets();
}

main();
