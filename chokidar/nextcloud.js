import { createClient } from "webdav";
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import axios from 'axios';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
dotenv.config();

const TAB_URL = process.env.TAB_URL.replace(/\/+$/, '');
const TAB_USER = process.env.TAB_USER;
const TAB_PASS = process.env.TAB_PASS;
const LOCAL_FILE = path.resolve(process.env.LOCAL_FILE);

const draft = {
    t1: {
        "0745": { name: "draft/t1.0745.0844.md", url: "https://kai.nl.tab.digital/s/sZW48yNjcinASkF" },
        "0930": { name: "draft/t1.0930.1059.md", url: "https://kai.nl.tab.digital/s/wxRtnMSYNGxSQPy" },
        "1400": { name: "draft/t1.1400.1429.md", url: "https://kai.nl.tab.digital/s/56zed9r4MHcMeeo" },
        "1430": { name: "draft/t1.1430.1459.md", url: "https://kai.nl.tab.digital/s/AQe92zxpc3ZBigH" },
        "1600": { name: "draft/t1.1600.1659.md", url: "https://kai.nl.tab.digital/s/AFKrPNB8RpMjBrq" },
        "1900": { name: "draft/t1.1900.1959.md", url: "https://kai.nl.tab.digital/s/W3kkLMeCZ3fCkAt" }
    },
    t2: {
        "0745": { name: "draft/t2.0745.1059.md", url: "https://kai.nl.tab.digital/s/FmpRZqDqW7pc5re" },
        "0930": { name: "draft/t2.0930.1059.md", url: "https://kai.nl.tab.digital/s/Q9meGsRiBzR28YG" },
        "1400": { name: "draft/t2.1400.1529.md", url: "https://kai.nl.tab.digital/s/zaS274tiimEFTcd" },
        "1600": { name: "draft/t2.1600.1659.md", url: "https://kai.nl.tab.digital/s/tdmXZBZceNp6siZ" },
        "1900": { name: "draft/t2.1900.1959.md", url: "https://kai.nl.tab.digital/s/6mppPLy636iKJgX" }
    }

};

function getdatestr(diff = 0) {
    var theDate = new Date();
    //theDate.setDate(theDate.getDate() - 1);
    theDate.setDate(theDate.getDate() + diff);

    var year = theDate.getFullYear();
    var month = theDate.getMonth() + 1 < 10 ? "0" + (theDate.getMonth() + 1) : theDate.getMonth() + 1;
    var day = theDate.getDate() < 10 ? "0" + theDate.getDate() : theDate.getDate();
    var dateStr = year + "" + month + "" + day;

    //console.log("datestr retrun:"+dateStr);
    return dateStr;
}

function getdayfilename(diff = 0) {
    console.log("diff:", diff);
    var datestr = getdatestr(diff);
    var year = datestr.slice(0, 4);

    var dayfilename = "../../ego/data/day/" + year + "/" + "d." + datestr + ".yaml";
    return dayfilename;
}

function loaddayobj(diff = 0) {
    console.log("diff:", diff);
    var dayobj;
    var dayfilename = getdayfilename(diff);
    try {
        if (fs.existsSync(dayfilename)) {
            dayobj = yaml.load(fs.readFileSync(dayfilename, 'utf8', { schema: yaml.FAILSAFE_SCHEMA }));
        } else {
            console.log("day obj is not exists.");
        }
    } catch (e) {
        // failure
        console.log("yaml read error:" + e);
    }
    return dayobj;
}

var filemap;
async function makefilemap(diff = 0) {
    filemap = new Object();
    var dayobj = loaddayobj(diff);
    const t = draft["t" + dayobj.mode];

    for (var i in dayobj.time) {
        var timeperiod = dayobj.time[i];
        var begintime = timeperiod.begin.slice(8, 12);
        console.log("beigintime:", begintime);
        if ((timeperiod.type == "check") || (timeperiod.type == "work")) {
            filemap[timeperiod.output.split('/').join('\\')] = t[begintime];
        }
    }
    console.log("filemap:", filemap);
}

const client = createClient("https://kai.nl.tab.digital/remote.php/dav/files/hyg", {
    username: TAB_USER,
    password: TAB_PASS
});

async function upload(localPath) {
    console.log("upload localPath:", localPath);
    const str = fs.readFileSync(localPath, 'utf8', { schema: yaml.FAILSAFE_SCHEMA })
    var ret = await client.putFileContents(filemap[localPath].name, str);
    console.log("upload return:", ret);
}

async function clear(localPath) {
    console.log("clear localPath:", localPath);
    var ret = await client.putFileContents(filemap[localPath].name, "## 手稿已经整理归档。");
    console.log("clear return:", ret);
}

// 首次全量同步
async function initialSync() {
    for (var output in filemap) {
        upload(output);
    }
}

// 启动监听
async function main() {
    await makefilemap();
    //await initialSync();
    for (var output in filemap) {
        console.log('🚀 监控开始：', output);
        const watcher = chokidar.watch(output);
        watcher
            .on('add', upload)
            .on('change', upload)
            .on('unlink', clear);
    }
}

main().catch(console.error);

