# AV演员磁链收集工具 - 需求与设计文档

## 项目概述

开发一套命令行工具，用于从网站收集日本AV演员的作品信息及磁力链接。

## 网站配置

### 配置文件 sites.yaml

网站配置抽取到 `sites.yaml` 文件，分为两类：

```yaml
profileSites:     # 演员资料网站
magnetSites:     # 磁链搜索网站
```

### 1. 人物纪典 (renwujidian.com)

搜索演员：
```
https://www.renwujidian.com/search/三宫椿
```

演员profile页面URL格式：
```
https://www.renwujidian.com/profile/sannomiya-tsubaki
```

### 2. 磁力搜索网站

| 网站 | 搜索URL | 特点 |
|------|---------|------|
| cilisousuo.cc | `https://cilisousuo.cc/search?q=番号` | 有Cloudflare保护 |
| TorrentDownload.info | `https://www.torrentdownload.info/search?q=番号` | 备用网站 |

## 核心功能

### 1. getcode.js - 获取演员作品番号

**功能**：从人物纪典(renwujidian.com)获取演员信息和作品番号

**输入**：
- 参数1：演员中文名（如 `三宫椿`）
- 参数2（可选）：截止日期，格式yyyymmdd（如 `20241001`）

**输出**：保存演员profile文件到 `profile/演员名.yaml`

**处理流程**：
1. 检查本地是否存在 `profile/演员名.yaml`
2. 如不存在：在 renwujidian.com 搜索演员，进入第一个 `/profile/` 页面
3. 从profile页面提取演员元数据（姓名、英文名、出生日期、身高，三围，出道年份、血型、出生地、经纪公司）
4. 如提供截止日期，提取该日期之前的作品列表（番号、发行时间、片长、厂商）
5. 增量更新：已存在的作品不重复添加
6. 执行结束后询问用户是否搜索磁链

### 2. getmagnet.js - 搜索磁力链接

**功能**：从多个磁力搜索网站搜索作品的磁链

**输入**：演员中文名

**输出**：更新演员profile文件中的magnet字段

**处理流程**：
1. 读取演员profile文件，清空上次的cache字段
2. 找出没有magnet字段的作品
3. 并发搜索（默认4并发，可配置）
4. 流水线模式：每个任务完成立即启动下一个，保持同时有设定并发数
5. 对每个番号：
   - 依次尝试配置的磁链搜索网站
   - 优先匹配搜索结果标题中包含番号的条目
   - 其次检查文件列表中是否包含番号
   - 每个网站最多检查前3个搜索结果
6. 找到磁链后：
   - 立即写入该作品数据的 `magnet` 字段
   - 立即写入该作品数据的 `magnet_updated_at` 时间戳
   - 立即更新 `cache` 字段（保存本次运行收集到的全部磁链）
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

### 字段说明

- `works[].magnet`: 该作品的磁链
- `works[].magnet_updated_at`: 磁链写入时间
- `cache.updated_at`: 最后一次运行的时间
- `cache.magnets`: Tixati导入格式（每行一个磁链），用户可复制使用

## 技术实现

### 依赖

- Node.js
- puppeteer - 浏览器自动化（处理Cloudflare保护）
- js-yaml - YAML文件读写
- jsdom - HTML解析

### 关键配置

```javascript
// getmagnet.js
const CONCURRENCY = 4;      // 并发数
const SEARCH_DELAY = 2000;  // 搜索间隔(毫秒)
```

### 搜索匹配规则

1. 依次尝试配置的磁链搜索网站
2. 搜索结果标题包含番号（大写不敏感）
3. 搜索结果的文件列表包含番号
4. 每个网站最多检查前3个搜索结果
5. 找到则停止尝试其他网站

### 退出处理

- SIGINT / SIGTERM 信号捕获
- 清理时保存cache字段
- 清理时输出本次收集的磁链

## 文件结构

```
magnet/
├── sites.yaml          # 网站配置
├── getcode.js         # 获取演员信息和作品番号
├── getmagnet.js       # 搜索磁力链接
├── profile/           # 演员profile文件目录
│   └── 三宫椿.yaml
├── package.json
└── node_modules/
```

## 使用示例

```bash
# 1. 获取演员信息（不包含作品）
node getcode.js 三宫椿

# 2. 获取演员信息及2024年10月1日前的作品
node getcode.js 三宫椿 20241001
# 执行结束后会询问是否搜索磁链

# 3. 搜索磁链（直接运行）
node getmagnet.js 三宫椿

# 4. Windows上屏蔽Chromium日志输出
node getmagnet.js 三宫椿 2>nul
```

## 注意事项

- 磁链搜索网站可能有Cloudflare保护，需使用Puppeteer
- 网站可能限流，并发数和延迟需合理设置
- 磁链搜索匹配率取决于网站资源丰富程度
- 支持配置多个磁链搜索网站，自动依次尝试
- Windows上Chromium会产生stderr日志，建议使用 `2>nul` 重定向
