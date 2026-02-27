const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const https = require('https');
const { JSDOM } = require('jsdom');
const { spawn } = require('child_process');
const readline = require('readline');

if (process.stdout.setEncoding) {
    process.stdout.setEncoding('utf8');
}
if (process.stderr.setEncoding) {
    process.stderr.setEncoding('utf8');
}

const PROFILE_DIR = './profile';
const SITES_CONFIG = './sites.yaml';

let sitesConfig;

function loadSitesConfig() {
    if (!sitesConfig) {
        sitesConfig = yaml.load(fs.readFileSync(SITES_CONFIG, 'utf-8'));
    }
    return sitesConfig;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function encodeSearchName(name) {
    return encodeURIComponent(name);
}

function formatString(template, params) {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');
        protocol.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function extractByPattern(text, pattern, options = {}) {
    const match = text.match(new RegExp(pattern));
    if (!match) return null;
    
    if (options.capture !== undefined) {
        return match[options.capture];
    }
    
    if (options.format) {
        let format = options.format;
        for (let i = 1; i < match.length; i++) {
            const widthMatch = format.match(new RegExp('\\{' + i + '(?::(\\d+))?d?\\}'));
            if (widthMatch) {
                const width = widthMatch[1] ? parseInt(widthMatch[1]) : 1;
                format = format.replace(widthMatch[0], match[i].padStart(width, '0'));
            } else {
                format = format.replace('{' + i + '}', match[i]);
            }
        }
        return format;
    }
    
    return match[1];
}

function extractProfileData(html, profileUrl, siteConfig) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const data = {
        profile_url: profileUrl,
    };
    
    const tables = doc.querySelectorAll('table');
    let infoText = '';
    
    for (const table of tables) {
        const text = table.textContent;
        if (text.includes('出生日期') || text.includes('身高') || text.includes('三围')) {
            infoText = text;
            break;
        }
    }
    
    if (!infoText) {
        infoText = doc.body.textContent;
    }
    
    const fields = siteConfig.profile.fields;
    
    for (const [key, fieldConfig] of Object.entries(fields)) {
        const value = extractByPattern(infoText, fieldConfig.pattern, fieldConfig);
        if (value) {
            if (fieldConfig.type === 'integer') {
                data[key] = parseInt(value);
            } else {
                data[key] = value.trim();
            }
        }
    }
    
    return data;
}

function extractWorks(html, endDate, siteConfig) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const works = [];
    const tables = doc.querySelectorAll('table');
    
    for (const table of tables) {
        const text = table.textContent;
        if (!text.includes('番号') || !text.includes('发行时间')) continue;
        
        const rows = table.querySelectorAll('tr');
        
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            if (cells.length < 4) continue;
            
            const col = siteConfig.profile.works.columns;
            const code = cells[col.code]?.textContent?.trim();
            const dateStr = cells[col.date]?.textContent?.trim();
            const duration = cells[col.duration]?.textContent?.trim();
            const maker = cells[col.maker]?.textContent?.trim();
            
            if (!code || !dateStr) continue;
            
            const workDate = new Date(dateStr);
            const end = new Date(endDate.substring(0, 4) + '-' + endDate.substring(4, 6) + '-' + endDate.substring(6, 8));
            
            if (workDate <= end) {
                works.push({
                    code,
                    date: dateStr,
                    duration,
                    maker
                });
            }
        }
        
        if (works.length > 0) break;
    }
    
    return works;
}

async function searchProfileUrl(name, siteConfig) {
    const searchUrl = formatString(siteConfig.searchActorUrl, {
        baseUrl: siteConfig.baseUrl,
        name: encodeSearchName(name)
    });
    
    const html = await fetchUrl(searchUrl);
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const linkSelector = siteConfig.search.profileLinkSelector;
    const firstProfileLink = doc.querySelector(linkSelector);
    
    if (firstProfileLink) {
        return siteConfig.profileUrlPrefix + firstProfileLink.href;
    }
    return null;
}

async function fetchProfilePage(url) {
    const html = await fetchUrl(url);
    return html;
}

async function updateProfile(name, endDate) {
    ensureDir(PROFILE_DIR);
    
    const sites = loadSitesConfig();
    const siteConfig = sites.profileSites.renwujidian;
    
    const profileFile = path.join(PROFILE_DIR, `${name}.yaml`);
    const changes = {
        created: false,
        updated: [],
        newWorks: []
    };
    
    let profileData = {};
    let profileUrl = null;
    
    if (fs.existsSync(profileFile)) {
        console.log(`[+] 发现本地profile文件: ${profileFile}`);
        profileData = yaml.load(fs.readFileSync(profileFile, 'utf-8'));
        profileUrl = profileData.profile_url;
        console.log(`[+] 已有profile URL: ${profileUrl}`);
    } else {
        console.log(`[-] 本地不存在profile文件，正在搜索...`);
        profileUrl = await searchProfileUrl(name, siteConfig);
        if (!profileUrl) {
            throw new Error(`未找到演员 ${name} 的profile页面`);
        }
        console.log(`[+] 找到profile页面: ${profileUrl}`);
        changes.created = true;
    }
    
    console.log(`[*] 正在获取profile页面...`);
    const html = await fetchProfilePage(profileUrl);
    const webData = extractProfileData(html, profileUrl, siteConfig);
    
    for (const [key, value] of Object.entries(webData)) {
        if (value !== undefined && profileData[key] === undefined) {
            profileData[key] = value;
        }
    }
    
    if (endDate) {
        console.log(`[*] 正在提取截止到 ${endDate} 的作品...`);
        const newWorks = extractWorks(html, endDate, siteConfig);
        
        if (!profileData.works) {
            profileData.works = [];
        }
        
        const existingCodes = new Set(profileData.works.map(w => w.code));
        
        for (const work of newWorks) {
            if (!existingCodes.has(work.code)) {
                profileData.works.push(work);
                changes.newWorks.push(work);
            }
        }
        
        profileData.works.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    fs.writeFileSync(profileFile, yaml.dump(profileData, { allowUnicode: true }));
    console.log(`[+] 已保存profile文件: ${profileFile}`);
    
    return changes;
}

async function askSearchMagnets(name) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(`\n[*] 是否搜索磁链? (Y/N): `, async (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y') {
                console.log(`\n[*] 请在Windows命令行运行以下命令来屏蔽Chromium日志:\n`);
                console.log(`node getmagnet.js ${name} 2>nul\n`);
                resolve();
            } else {
                resolve();
            }
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.log('用法: node getcode.js <演员中文名> [结束日期(yyyymmdd)]');
        console.log('示例: node getcode.js 三宫椿');
        console.log('示例: node getcode.js 三宫椿 20241001');
        process.exit(1);
    }
    
    const name = args[0];
    const endDate = args[1];
    
    console.log(`========================================`);
    console.log(`演员: ${name}`);
    if (endDate) {
        console.log(`截止日期: ${endDate}`);
    }
    console.log(`========================================\n`);
    
    try {
        const changes = await updateProfile(name, endDate);
        
        console.log(`\n========================================`);
        console.log(`执行结果`);
        console.log(`========================================`);
        
        if (changes.created) {
            console.log(`[+] 新建profile文件`);
        }
        
        if (changes.updated.length > 0) {
            console.log(`\n[*] 更新了以下信息:`);
            for (const u of changes.updated) {
                console.log(`    - ${u.field}: ${u.old} -> ${u.new}`);
            }
        }
        
        if (changes.newWorks.length > 0) {
            console.log(`\n[*] 新增作品 (${changes.newWorks.length}个):`);
            for (const w of changes.newWorks) {
                console.log(`    - ${w.code} (${w.date})`);
            }
        }
        
        if (!changes.created && changes.updated.length === 0 && changes.newWorks.length === 0) {
            console.log(`[*] 没有需要更新的信息`);
        }
        
        await askSearchMagnets(name);
        
    } catch (e) {
        console.error(`[-] 错误: ${e.message}`);
        process.exit(1);
    }
}

main();
