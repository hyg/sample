# AV演员磁链收集工具 - 需求与设计文档

## 项目概述

开发一套命令行工具，用于从网站收集日本AV演员的作品信息及磁力链接。

## 网站搜索语法

### 1. 人物纪典 (renwujidian.com)

搜索演员：
```
https://www.renwujidian.com/search/三宫椿
```

演员profile页面URL格式：
```
https://www.renwujidian.com/profile/sannomiya-tsubaki
```

### 2. 磁力搜索 (cilisousuo.cc)

搜索番号：
```
https://cilisousuo.cc/search?q=ADN-597
```

磁力详情页URL格式：
```
https://cilisousuo.cc/magnet/xxx
```

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

### 2. getmagnet.js - 搜索磁力链接

**功能**：从磁力搜索网站(cilisousuo.cc)搜索作品的磁链

**输入**：演员中文名

**输出**：更新演员profile文件中的magnet字段

**处理流程**：
1. 读取演员profile文件，找出没有magnet字段的作品
2. 并发搜索（默认2并发，可配置）
3. 对每个番号：
   - 在cilisousuo.cc搜索
   - 优先匹配搜索结果标题中包含番号的条目
   - 其次检查文件列表中是否包含番号
   - 最多检查前3个搜索结果
4. 找到磁链后立即写入文件（断点续传）
5. 最后输出所有新收集的磁链（每行一个）

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
```

## 技术实现

### 依赖

- Node.js
- puppeteer - 浏览器自动化（处理Cloudflare保护）
- js-yaml - YAML文件读写
- jsdom - HTML解析

### 关键配置

```javascript
// getmagnet.js
const CONCURRENCY = 2;      // 并发数
const SEARCH_DELAY = 2000;   // 搜索间隔(毫秒)
```

### 搜索匹配规则

1. 搜索结果标题包含番号（大写不敏感）
2. 搜索结果的文件列表包含番号
3. 每个番号最多检查前3个搜索结果
4. 超过匹配限制则视为未找到

## 文件结构

```
magnet/
├── getcode.js      # 获取演员信息和作品番号
├── getmagnet.js    # 搜索磁力链接
├── profile/        # 演员profile文件目录
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

# 3. 搜索磁链
node getmagnet.js 三宫椿
```

## 注意事项

- cilisousuo.cc 有Cloudflare保护，需使用Puppeteer
- 网站可能限流，并发数和延迟需合理设置
- 磁链搜索匹配率取决于网站资源丰富程度
