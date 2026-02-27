# AV演员磁链收集工具 - 需求与设计文档

## 项目概述

开发一套命令行工具，用于从网站收集日本AV演员的作品信息及磁力链接。

## 网站配置

### 配置文件 sites.yaml

网站配置抽取到 `sites.yaml` 文件，分为两类：
- `profileSites`: 演员资料网站
- `magnetSites`: 磁链搜索网站

每个网站配置包含：
- `baseUrl`: 基础URL
- `search`: 搜索页面配置（URL模板、选择器等）
- `result`: 搜索结果解析配置
- `detail`: 详情页配置
- `pageLoadWait`: 页面加载等待时间(毫秒)

### 1. 人物纪典 (renwujidian.com)

搜索演员：`https://www.renwujidian.com/search/{演员名}`

### 2. 磁力搜索网站

| 网站 | 搜索URL |
|------|---------|
| cilisousuo.cc | `https://cilisousuo.cc/search?q={番号}` |
| TorrentDownload.info | `https://www.torrentdownload.info/search?q={番号}` |

## 文件结构

```
magnet/
├── sites.yaml          # 网站配置（JSON/YAML格式）
├── common.js          # 公共模块（配置加载、工具函数）
├── getcode.js         # 获取演员信息和作品番号
├── getmagnet.js       # 搜索磁力链接
├── profile/           # 演员profile文件目录
│   └── 三宫椿.yaml
├── package.json
└── node_modules/
```

## 公共模块 (common.js)

提供以下函数供其他模块调用：

```javascript
loadSitesConfig()        // 加载sites.yaml配置
getProfileSites()        // 获取演员资料网站列表
getMagnetSites()       // 获取磁链搜索网站列表
formatString(template, params)  // 字符串模板替换
ensureDir(dir)          // 确保目录存在
encodeSearchName(name)  // URL编码
initEncoding()          // 初始化UTF-8编码
PROFILE_DIR             // profile目录常量
SITES_CONFIG            // 配置文件路径常量
```

## 核心功能

### 1. getcode.js - 获取演员作品番号

**功能**：从人物纪典获取演员信息和作品番号

**输入**：
- 参数1：演员中文名（如 `三宫椿`）
- 参数2（可选）：截止日期，格式yyyymmdd（如 `20241001`）

**输出**：保存演员profile文件到 `profile/演员名.yaml`

**处理流程**：
1. 调用 `getProfileSites()` 获取第一个配置的演员资料网站
2. 检查本地是否存在 `profile/演员名.yaml`
3. 如不存在：使用网站的搜索功能查找演员profile页面URL
4. 获取profile页面，提取演员元数据（使用sites.yaml中的字段提取配置）
5. 如提供截止日期，提取该日期之前的作品列表
6. 增量更新：已存在的作品不重复添加
7. 执行结束后询问用户是否搜索磁链（直接回车默认Y）

### 2. getmagnet.js - 搜索磁力链接

**功能**：从多个磁链搜索网站搜索作品的磁链

**输入**：演员中文名

**输出**：更新演员profile文件中的magnet字段

**处理流程**：
1. 调用 `getMagnetSites()` 获取所有配置的磁链搜索网站
2. 读取演员profile文件，**删除**上次的cache字段（重新开始）
3. 找出没有magnet字段的作品
4. 并发搜索（默认4并发，流水线模式）
5. 对每个番号：
   - 依次尝试每个磁链搜索网站
   - 单次尝试：超时或失败立即换网站，不重试
   - 优先匹配搜索结果标题中包含番号的条目
   - 其次检查文件列表中是否包含番号
   - 每个网站最多检查前3个搜索结果
   - 找到磁链后停止尝试其他网站
6. 找到磁链后立即：
   - 写入该作品数据的 `magnet` 字段
   - 写入该作品数据的 `magnet_updated_at` 时间戳
   - 更新 `cache` 字段
7. 任何情况退出（正常完成、Ctrl+C、SIGTERM）都会保存cache并输出结果

## 数据结构

### profile YAML格式

```yaml
profile_url: https://www.renwujidian.com/profile/xxx
name: 三宫椿
english_name: Sannomiya Tsubaki
birthday: '1998-05-04'
height: 152
bust: 89
waist: 54
hip: 83
debut_year: 2020
blood_type: A
birthplace: 日本东京
agency: C-more
works:
  - code: YUJ-024
    date: '2024-10-01'
    duration: 120分
    maker: attackers
    magnet: magnet:?xt=urn:btih:...
    magnet_updated_at: '2026-02-27T12:00:00.000Z'
cache:
  updated_at: '2026-02-27T12:00:00.000Z'
  magnets: |
    magnet:?xt=urn:btih:xxx1
    magnet:?xt=urn:btih:xxx2
```

### 关键实现细节

1. **cache.magnets字段格式**：
   - 使用YAML字面量样式（`|-`或`|`）避免空行
   - 每行一个磁链，无空行
   - 使用js-yaml的 `styles: {'!!str': '|'}` 选项

2. **流水线并发**：
   - 使用Promise数组管理并发任务
   - 每次任务完成后立即启动下一个
   - 保持同时有CONCURRENCY个任务运行

3. **信号处理**：
   - 捕获SIGINT和SIGTERM信号
   - 清理时保存cache并输出结果
   - 使用setTimeout延迟退出确保清理完成

## 技术实现

### 依赖

```json
{
  "dependencies": {
    "js-yaml": "^4.1.0",
    "jsdom": "^24.0.0",
    "puppeteer": "^21.0.0"
  }
}
```

### 关键配置

```javascript
// getmagnet.js
const CONCURRENCY = 4;      // 并发数
const SEARCH_DELAY = 2000;  // 搜索间隔(毫秒)
```

### Puppeteer配置

```javascript
browser = await puppeteer.launch({
    headless: 'new',
    dumpio: false,
    env: {
        PUPPETEER_SKIP_DOWNLOAD: 'true',
        PUPPETEER_NO_SANDBOX: '1',
        PUPPETEER_DISABLE_SETUID_SANDBOX: '1'
    },
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-logging',
        '--log-level=3'
    ]
});
```

### 搜索匹配规则

1. 依次尝试配置的磁链搜索网站
2. 每个网站只尝试一次，超时或失败立即换网站
3. 搜索结果标题包含番号（大写不敏感）
4. 搜索结果的文件列表包含番号
5. 每个网站最多检查前3个搜索结果
6. 找到则停止尝试其他网站

## 使用示例

```bash
# 1. 获取演员信息（不包含作品）
node getcode.js 三宫椿

# 2. 获取演员信息及2024年10月1日前的作品
node getcode.js 三宫椿 20241001
# 执行结束后会询问是否搜索磁链，直接回车默认Y

# 3. 搜索磁链（直接运行）
node getmagnet.js 三宫椿

# 4. Windows上屏蔽Chromium日志（可选）
node getmagnet.js 三宫椿 2>NUL
```

## 注意事项

- 磁链搜索网站可能有Cloudflare保护，需使用Puppeteer
- 网站可能限流，并发数和延迟需合理设置
- 磁链搜索匹配率取决于网站资源丰富程度
- 支持配置多个磁链搜索网站，自动依次尝试
- 每个番号对每个网站只尝试一次，不重试
- cache.magnets使用YAML字面量样式确保无空行
