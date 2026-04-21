const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Initialize encoding for Windows compatibility
if (process.stdout.setEncoding) {
    process.stdout.setEncoding('utf8');
}
if (process.stderr && process.stderr.setEncoding) {
    process.stderr.setEncoding('utf8');
}

const PROFILE_DIR = './profile';

// Get name from command line argument
const name = process.argv[2];
if (!name) {
    console.error('Usage: node redo.js <演员中文名>');
    process.exit(1);
}

const filePath = path.join(PROFILE_DIR, `${name}.yaml`);

try {
    // Read the YAML file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.load(fileContent);
    
    // Extract magnets from works array where magnet field exists
    const magnets = [];
    if (data.works && Array.isArray(data.works)) {
        for (const work of data.works) {
            if (work.magnet) {
                magnets.push(work.magnet);
            }
        }
    }
    
    // Update cache.magnets with magnets joined by newline
    if (!data.cache) {
        data.cache = {};
    }
    data.cache.magnets = magnets.join('\n');
    
    // Preserve updated_at if it exists, otherwise set to current time
    if (!data.cache.updated_at) {
        data.cache.updated_at = new Date().toISOString();
    }
    
    // Write back to file with YAML formatting
    const output = yaml.dump(data, {
        allowUnicode: true,
        lineWidth: -1,
        noRefs: true,
        styles: { '!!str': '|' }  // Use literal style for long strings
    });
    
    fs.writeFileSync(filePath, output, 'utf-8');
    
    console.log('[*] 已更新 ' + name + '.yaml 的 cache.magnets 字段，共 ' + magnets.length + ' 个磁链');
    
} catch (error) {
    console.error('错误: ' + error.message);
    process.exit(1);
}