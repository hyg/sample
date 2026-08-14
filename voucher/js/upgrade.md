# 电子凭证整理工具升级方案

> 状态：方案待确认，未实施（当前仅新增本说明文档）
> 涉及需求：
> 1. AVR 文件新增 `raw` 字段，保存原始凭证（多行文本）
> 2. 新增 CLI 工具，从手工修正后的 AVR/AER 提取新格式的特征模版

---

## 一、现状分析

### 1.1 文件结构

```
js/
├── voucher.js        # 批量处理模式（node voucher.js < 凭证.txt）
├── vi.js             # 连续/交互式模式（node vi.js）
├── test-runner.js    # 测试用例查看器
├── testcase/         # 测试用例（.txt 原始凭证 + AVR.*.yaml + AER.*.yaml）
├── USAGE.md          # 使用说明
└── package.json
```

### 1.2 公用代码分析：voucher.js 与 vi.js

两个文件各约 700 行，**95% 的代码完全重复**，差异仅 3 处：

| 差异点 | voucher.js（批量） | vi.js（连续/交互） |
|---|---|---|
| 输出目录 targetPath | `__dirname`（js/ 目录） | ego 数据目录 `staging/2026`（不存在则创建） |
| 最新编号查找 | 只扫描 targetPath | 扫描 ego `staging/{year}` + `archive/{year}` |
| 运行方式 | 仅管道 stdin | TTY 交互 + 管道 stdin |

**完全重复的逻辑**（均应抽取为公用模块）：

- 文本处理：`splitSingleLineText`、`parseVoucherText`（含单行智能分割、`---` 分隔符处理）
- 日期转换：`convertDate`
- AVR 生成：`generateYamlContent`
- 文件读写：`parseAvrFile`、`saveYamlFile`、`saveAerFile`
- AVR→AER：`getAccountTitle`、`getCreditAccountTitle`、`getUnitBySummary`、`generateComments`、`generateAerContent`、`generateAerFile`、`generateAerFileWithSpecificId`
- 主流程：`processUserInput`（含 374.txt 特例编号映射）、stdin 读取逻辑

---

## 二、需求 1：AVR 文件新增 `raw` 字段

### 2.1 字段定义

在 AVR YAML 末尾增加 `raw` 字段，使用 YAML 块标量（`|`）保存原始凭证的多行文本：

```yaml
date: 2025-08-22 20:21:28
title: 微信支付账单
VoucherID: 4200002727202508220795047468
VoucherType: 交易单号
amount: 19.13
summary: 蔬菜、鸡蛋
comment:
  - name: 商户单号
    value: 20250822202122U70804517930403523
  - name: 美团订单
    value: 25082211100300001304615814784876
raw: |
  当前状态

  支付成功

  支付时间

  2025年8月22日 20:21:28

  商品

  美团订单-25082211100300001304615814784876

  商户全称

  北京三快在线科技有限公司

  收单机构

  财付通支付科技有限公司

  支付方式

  零钱

  交易单号

  4200002727202508220795047468

  商户单号

  20250822202122U70804517930403523

  商家小程序
```

### 2.2 raw 的取值规则

- **来源**：用户粘贴的原始凭证文本
- **剔除元数据**：去掉 `---` 分隔符及其后的用户补充信息（金额、摘要）。例如 307.txt 中 `---` 之后的 `10.90`、`Y型牙线` 不属于凭证本体，不进入 raw
- **格式**：统一换行符为 `\n`，去掉首部空行与尾部空白，保证以单个换行结尾
- **YAML 编码**：使用 `|` 块标量，每行缩进 2 空格；若文本不以换行结尾则用 `|-`（去掉末尾换行）以保证往返无损

### 2.3 代码改动点

新增两个公用函数：

```js
// 从输入文本中提取原始凭证内容（去掉 "---" 元数据段）
function extractRawVoucherText(text) { ... }

// 多行文本 → YAML 块标量（raw: | ...）
function yamlBlockScalar(text) { ... }
```

修改 `generateYamlContent(data)`：当 `data.raw` 存在时，在 YAML 末尾追加 `raw:` 块。

修改 `processUserInput()`：解析输入后调用 `extractRawVoucherText(inputText)`，把结果存入 `parsedData.raw` 再生成 YAML。

---

## 三、需求 2：特征模版提取 CLI 工具

### 3.1 使用场景与流程

当出现**新格式**的凭证时（现有规则解析不出来）：

1. 先用 `voucher.js` / `vi.js` 生成 AVR（此时已含 `raw` 原始凭证），字段可能解析错误
2. **用户手工修正** AVR 和 AER 文件中的字段（如日期、VoucherID、comment 条目、amount、summary）
3. 运行 CLI 工具：

```bash
node extract-template.js AVR.xxx.yaml [--out 输出目录] [--name 模版名称]
```

4. 工具从 `raw` + 修正后的字段**反推"标签→字段"映射**，生成特征模版到 `templates/` 目录

### 3.2 特征模版格式

```yaml
name: 微信支付账单(交易单号)
source: AVR.299.yaml
title: 微信支付账单
VoucherType: 交易单号
fields:                    # 标签 → AVR 字段映射（未来自动解析的依据）
  - target: date
    label: 支付时间
  - target: VoucherID
    label: 交易单号
  - target: comment
    name: 商户单号
    label: 商户单号
  - target: comment
    name: 美团订单
    label: 商品
    linePattern: 美团订单-<value>    # 值嵌入行内时的掩码行（无则值在标签下一行）
structure:                 # 掩码后的行序列 = 格式识别指纹
  - 当前状态
  - <value>
  - 支付时间
  - <date>
  - 商品
  - <value>
  - 商户全称
  - <value>
  - 收单机构
  - <value>
  - 支付方式
  - <value>
  - 交易单号
  - <id>
  - 商户单号
  - <id>
  - 商家小程序
```

### 3.3 提取算法（值锚定反推）

1. **拆行**：raw 按行拆分、trim、去空行
2. **值掩码分类**（用于生成 structure 指纹）：
   - 日期（`2025年8月22日 20:21:28` / `2025-08-22 20:48:15`）→ `<date>`
   - 金额（`-128.00`）→ `<amount>`
   - 长 ID（`[A-Z0-9]{10,}` / `\d{16,}`）→ `<id>`
   - 前一行为标签 → `<value>`
   - 其余保留原文（标签或固定文本，如"当前状态""计入收支"）
3. **字段映射反推**：
   - `date`：在 raw 中找日期行，按日期部分与 AVR.date 匹配（兼容中文日期格式、兼容手工修改后的日期）
   - `VoucherID`：在 raw 中查找该值
   - `comment` 条目：在 raw 中查找每个 `value`
   - `amount`：**保守匹配**——仅当金额行前一行是已知标签时才映射，避免误映射（amount/summary 常被手工调整，不可靠时不映射）
4. **标签推断**：值所在行若以已知标签开头 → 行内标签；否则取前一行（须为短中文标签）。同一值多处出现时**优先整行匹配**（例如 307.txt 的商户单号同时出现在"商品"行内和独立行，会正确选择独立行）

### 3.4 关键设计点

- 同一格式的多张凭证（如 299/300 微信支付）会得到**相同 structure**，可用于格式归并去重
- 无法可靠反推的字段**宁缺毋滥**，输出警告并跳过，用户可手工补充模版
- AVR 缺少 `raw` 字段时报错退出，提示先用 voucher.js/vi.js 生成
- 未来可在 `voucher.js` 中加载 `templates/` 下的模版做自动识别解析（本方案暂不实现）

---

## 四、架构设计

### 4.1 目标结构

```
js/
├── voucher-core.js        # ★ 新增：全部公用业务逻辑
├── voucher.js             # 改：薄壳入口
├── vi.js                  # 改：薄壳入口
├── extract-template.js    # ★ 新增：特征模版提取 CLI
├── templates/             # ★ 新增：特征模版存放目录
├── testcase/              # 参考文件补充 raw 字段示例
└── USAGE.md               # 补充新功能说明
```

### 4.2 依赖注入消除重复

核心流程函数签名：

```js
processUserInput(targetPath, inputText, sourceFileName, getLatestAvrId, getLatestAerId)
```

- `targetPath`：输出目录（voucher.js 传 `__dirname`；vi.js 传 ego `staging/2026`）
- `getLatestAvrId` / `getLatestAerId`：编号查找函数（voucher.js 扫描本目录；vi.js 扫描 staging+archive 且按年份），由入口注入，核心零分支

### 4.3 兼容性保证

- `voucher.js` 保留原有导出（`parseVoucherText`、`generateYamlContent`、`convertDate`、`parseAvrFile`、`generateAerContent`、`getAccountTitle`、`getCreditAccountTitle`、`getUnitBySummary`），从 core 转导出
- `voucher.js` 的 `processUserInput(inputText, sourceFileName)` 旧签名保留为包装函数
- 新增功能（raw 提取、yaml 块标量）只写一次于 core，两入口自动获得
- `extract-template.js` 复用 core 的 `parseAvrFile`，只新增模版提取自有逻辑

### 4.4 各文件改动清单

| 文件 | 动作 | 内容 |
|---|---|---|
| `js/voucher-core.js` | 新增 | 全部公用逻辑（含 `extractRawVoucherText`、`yamlBlockScalar`、带 raw 的 `generateYamlContent`） |
| `js/voucher.js` | 重写为薄壳 | 保留主流程与导出接口，注入目录与 ID 查找 |
| `js/vi.js` | 重写为薄壳 | 保留交互界面，注入 ego 路径与年份 ID 查找 |
| `js/extract-template.js` | 新增 | 特征模版提取 CLI |
| `js/package.json` | 修改 | 增加脚本 `"extract-template": "node extract-template.js"` |
| `js/USAGE.md` | 修改 | 补充 raw 字段说明、新格式处理流程 |
| `js/testcase/AVR.{299,300,301,307,308}.yaml` | 修改 | 补充 raw 字段作为示例（308 无 txt，用 USAGE.md 示例重建） |

---

## 五、验证计划

1. **raw 往返无损**：调用 `generateYamlContent` 生成含 raw 的 YAML，再用 `yaml.load` 回读，逐字节比对多行文本
2. **入口行为不变**：对 299.txt 分别走新旧逻辑，对比 AVR/AER 输出（除新增 raw 字段外一致）
3. **模版提取正确性**：对 `testcase/AVR.299.yaml`（微信）、`AVR.301.yaml`（支付宝）、`AVR.307.yaml`（商户单号多处出现）运行 extract-template，核对：
   - fields 映射（date/VoucherID/comment 的标签是否正确，307 是否选中独立行标签）
   - structure 指纹是否与预期一致
4. **异常路径**：无 raw 字段的 AVR → 报错退出；值无法匹配 → 警告并跳过

---

## 六、未决问题（可后续讨论）

- 模版是否需要在生成时与已有模版做去重/合并（同结构多来源）
- 是否在 `voucher.js` / `vi.js` 中加载模版做新格式自动解析（当前仅提取、不消费）
- `templates/` 目录位置：默认 `js/templates/`，可通过 `--out` 覆盖
