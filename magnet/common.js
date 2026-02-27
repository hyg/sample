const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SITES_CONFIG = './sites.yaml';

let sitesConfig;
let profileSites = [];
let magnetSites = [];

function loadSitesConfig() {
    if (!sitesConfig) {
        sitesConfig = yaml.load(fs.readFileSync(SITES_CONFIG, 'utf-8'));
    }
    return sitesConfig;
}

function getProfileSites() {
    if (profileSites.length === 0) {
        const sites = loadSitesConfig();
        const siteList = sites.profileSites;
        for (const [key, config] of Object.entries(siteList)) {
            profileSites.push({ key, ...config });
        }
    }
    return profileSites;
}

function getMagnetSites() {
    if (magnetSites.length === 0) {
        const sites = loadSitesConfig();
        const siteList = sites.magnetSites;
        for (const [key, config] of Object.entries(siteList)) {
            magnetSites.push({ key, ...config });
        }
    }
    return magnetSites;
}

function formatString(template, params) {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function encodeSearchName(name) {
    return encodeURIComponent(name);
}

function initEncoding() {
    if (process.stdout.setEncoding) {
        process.stdout.setEncoding('utf8');
    }
    if (process.stderr && process.stderr.setEncoding) {
        process.stderr.setEncoding('utf8');
    }
}

module.exports = {
    loadSitesConfig,
    getProfileSites,
    getMagnetSites,
    formatString,
    ensureDir,
    encodeSearchName,
    initEncoding,
    PROFILE_DIR: './profile',
    SITES_CONFIG
};
