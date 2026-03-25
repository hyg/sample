const puppeteer = require('puppeteer');

async function analyzePage() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('正在访问详情页...');
    await page.goto('https://angora48.top/599811f41ca1abf78e35f50d59c0cdbd00548081.html', { 
        waitUntil: 'load', 
        timeout: 60000 
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // 获取页面标题
    const title = await page.title();
    console.log('\n=== 页面标题 ===');
    console.log(title);
    
    // 获取完整 HTML
    const html = await page.content();
    
    // 获取页面文本
    const text = await page.evaluate(() => document.body.innerText);
    console.log('\n=== 页面文本 ===');
    console.log(text.substring(0, 2000));
    
    // 查找文件列表相关元素
    const fileStructure = await page.evaluate(() => {
        const result = {
            tables: [],
            lists: [],
            magnetLinks: [],
            fileNames: []
        };
        
        // 查找所有表格
        const tables = document.querySelectorAll('table');
        tables.forEach((table, i) => {
            const text = table.innerText.substring(0, 200);
            if (text.length > 10) {
                result.tables.push({ index: i, text: text.replace(/\n/g, ' | ') });
            }
        });
        
        // 查找所有列表
        const lists = document.querySelectorAll('ul, ol, dl');
        lists.forEach((list, i) => {
            const text = list.innerText.substring(0, 200);
            if (text.length > 10) {
                result.lists.push({ index: i, text: text.replace(/\n/g, ' | ') });
            }
        });
        
        // 查找磁链
        const magnetLinks = document.querySelectorAll('a[href^="magnet:"]');
        magnetLinks.forEach((link, i) => {
            result.magnetLinks.push({
                href: link.href,
                text: link.innerText,
                className: link.className
            });
        });
        
        // 查找可能包含文件名的元素
        const possibleFileElements = document.querySelectorAll('.file-list td, .files td, table td, .file-name, [class*="file"]');
        possibleFileElements.forEach((el, i) => {
            const text = el.innerText.trim();
            if (text.length > 5 && text.length < 200) {
                result.fileNames.push({
                    tag: el.tagName,
                    class: el.className,
                    text: text
                });
            }
        });
        
        return result;
    });
    
    console.log('\n=== 表格结构 ===');
    fileStructure.tables.forEach(t => {
        console.log('表格 #' + t.index + ': ' + t.text);
    });
    
    console.log('\n=== 列表结构 ===');
    fileStructure.lists.forEach(l => {
        console.log('列表 #' + l.index + ': ' + l.text);
    });
    
    console.log('\n=== 磁链链接 ===');
    fileStructure.magnetLinks.forEach(m => {
        console.log('磁链：' + m.href);
        console.log('  文本：' + m.text);
        console.log('  类名：' + m.className);
    });
    
    console.log('\n=== 可能的文件名元素 ===');
    fileStructure.fileNames.forEach(f => {
        console.log('标签：' + f.tag + ', 类名：' + f.class + ', 文本：' + f.text);
    });
    
    // 保存 HTML 到文件
    const fs = require('fs');
    fs.writeFileSync('debug_page.html', html);
    console.log('\n=== HTML 已保存到 debug_page.html ===');
    
    await browser.close();
}

analyzePage().catch(console.error);
