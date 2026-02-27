const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const https = require('https');
const { JSDOM } = require('jsdom');

const PROFILE_DIR = './profile';

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function encodeSearchName(name) {
    return encodeURIComponent(name);
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

function extractProfileData(html, profileUrl) {
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
    
    const nameMatch = infoText.match(/中文名[：:\s]*([^\n]+?)(?=外文名|呢称|别名|性别|出生日期)/);
    if (nameMatch) {
        data.name = nameMatch[1].trim();
    }
    
    const enNameMatch = infoText.match(/外文名[：:\s]*([^\n]+?)(?=呢称|别名|性别|出生日期)/);
    if (enNameMatch) {
        data.english_name = enNameMatch[1].trim();
    }
    
    const birthMatch = infoText.match(/出生日期[：:\s]*(\d{4})年(\d+)月(\d+)日/);
    if (birthMatch) {
        data.birthday = `${birthMatch[1]}-${birthMatch[2].padStart(2, '0')}-${birthMatch[3].padStart(2, '0')}`;
    }
    
    const heightMatch = infoText.match(/身高[：:\s]*(\d+)\s*cm/);
    if (heightMatch) {
        data.height = parseInt(heightMatch[1]);
    }
    
    const bwhMatch = infoText.match(/三围[：:\s]*B(\d+)[(（](\w+)[)）]-W(\d+)-H(\d+)/);
    if (bwhMatch) {
        data.bust = parseInt(bwhMatch[1]);
        data.waist = parseInt(bwhMatch[3]);
        data.hip = parseInt(bwhMatch[4]);
    }
    
    const debutMatch = infoText.match(/出道时间[：:\s]*(\d{4})/);
    if (debutMatch) {
        data.debut_year = parseInt(debutMatch[1]);
    }
    
    const bloodMatch = infoText.match(/血型[：:\s]*(\w)/);
    if (bloodMatch) {
        data.blood_type = bloodMatch[1];
    }
    
    const placeMatch = infoText.match(/出生地[：:\s]*([^\n]+?)(?=国籍|职业)/);
    if (placeMatch) {
        data.birthplace = placeMatch[1].trim();
    }
    
    const agencyMatch = infoText.match(/经纪公司[：:\s]*([^\n]+?)$/);
    if (agencyMatch) {
        data.agency = agencyMatch[1].trim();
    }
    
    return data;
}

function extractWorks(html, endDate) {
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
            
            const code = cells[1]?.textContent?.trim();
            const dateStr = cells[2]?.textContent?.trim();
            const duration = cells[3]?.textContent?.trim();
            const maker = cells[4]?.textContent?.trim();
            
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

async function searchProfileUrl(name) {
    const searchUrl = `https://www.renwujidian.com/search/${encodeSearchName(name)}`;
    const html = await fetchUrl(searchUrl);
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const firstProfileLink = doc.querySelector('a[href^="/profile/"]');
    if (firstProfileLink) {
        return 'https://www.renwujidian.com' + firstProfileLink.href;
    }
    return null;
}

async function fetchProfilePage(url) {
    const html = await fetchUrl(url);
    return html;
}

async function updateProfile(name, endDate) {
    ensureDir(PROFILE_DIR);
    
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
        profileUrl = await searchProfileUrl(name);
        if (!profileUrl) {
            throw new Error(`未找到演员 ${name} 的profile页面`);
        }
        console.log(`[+] 找到profile页面: ${profileUrl}`);
        changes.created = true;
    }
    
    console.log(`[*] 正在获取profile页面...`);
    const html = await fetchProfilePage(profileUrl);
    const webData = extractProfileData(html, profileUrl);
    
    for (const [key, value] of Object.entries(webData)) {
        if (value !== undefined && profileData[key] === undefined) {
            profileData[key] = value;
        }
    }
    
    if (endDate) {
        console.log(`[*] 正在提取截止到 ${endDate} 的作品...`);
        const newWorks = extractWorks(html, endDate);
        
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
        
    } catch (e) {
        console.error(`[-] 错误: ${e.message}`);
        process.exit(1);
    }
}

main();
