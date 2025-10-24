# 电子凭证自动整理工具升级指南

## 系统概述
本系统用于自动化处理电子凭证，将文本格式的支付凭证转换为标准化的YAML文件，包括：
- **AVR文件**（Accounting Voucher Record）：记录凭证原始信息
- **AER文件**（Accounting Entry Record）：记录会计分录信息

## 核心功能组件

### 1. 文本解析 (`parseVoucherText`)
- 支持多行格式：字段名和值分别在不同行
- 支持单行格式：字段名和值连写（如"交易单号4200002873202510223710908214"）
- 智能行分割：自动检测单行输入格式并添加适当换行
- 两种支付类型支持：
  - 微信支付：交易单号、商户单号等
  - 支付宝：订单号、商家订单号等

### 2. 文件命名规则
- **普通情况**：TXT文件名数字 → AVR文件名数字，AER使用递增ID
- **特殊情况**：374.txt → AVR.374.yaml + AER.364.yaml（固定映射）

### 3. 输入模式
- 标准输入模式：`node voucher.js < input.txt`
- 文件参数模式：`node voucher.js filename.txt`
- 交互模式：`node vi.js`（支持END命令结束输入）

## 主要技术点

### 输入处理
```javascript
// 支持多种输入格式的解析
if (hasSingleLineFormat) {
    lines = splitSingleLineText(text);
} else {
    lines = text.split('\n')...
}
```

### 智能提取
```javascript
// 既支持分行提取，也支持连写提取
if (line === '交易单号' && i + 1 < lines.length) {
    result.transactionId = lines[i + 1];
} else if (line.startsWith('交易单号') && line.length > 4) {
    result.transactionId = line.substring(4);
}
```

### ID管理
- 支持固定ID映射（特殊文件）
- 支持自增ID（普通文件）
- AVR ID与TXT文件名同步
- AER ID独立递增

## 升级注意事项

### 1. 扩展解析功能
- 新增关键字时，需同时更新`splitSingleLineText`中的关键词数组
- 确保新字段支持分行和连写两种格式
- 注意在函数的两个分支（有/无"---"分隔符）中都添加相应处理

### 2. 文件映射扩展
- 添加新特殊映射时，修改`processUserInput`中的条件判断
- 确保对应的AVR和AER文件在testcase目录中存在

### 3. 错误处理
- 所有函数都应验证输入参数（null/undefined检查）
- 文件操作需确认路径存在且有读写权限
- 解析失败时应有默认值或降级处理

### 4. 向后兼容
- 保持原有函数接口不变
- 新增功能应有默认选项，不影响现有功能
- 确保vi.js与voucher.js功能同步

### 5. 测试验证
- 为新功能创建对应的testcase文件
- 验证单行和多行格式的处理结果
- 确认特殊文件映射关系正确

## 代码结构
- `voucher.js`: 主处理逻辑，支持命令行和管道输入
- `vi.js`: 交互式输入处理，功能应与voucher.js同步
- `testcase/`: 测试用例，包括.txt输入和.yaml期望输出

## 未来扩展方向
- 支持更多支付平台格式
- 增加OCR识别支持
- 提供批量处理模式
- 增加数据验证和质量检查
- 扩展输出格式（JSON、CSV等）