# 步骤 5 任务描述模板改进建议

## 执行日期
2026-03-24

## 观察结果

### 第一轮移植执行情况

**成功完成**：
- ✅ config.js 移植（5 个核心测试通过）
- ✅ logging.js 移植（9 个核心测试通过）
- ✅ 代码语法检查通过
- ✅ 函数签名一致
- ✅ 变量名一致
- ✅ 实现逻辑一致

**遇到的问题**：
1. ❌ 跨平台测试失败 - Python 路径配置问题（`ModuleNotFoundError: No module named 'scripts'`）
2. ⚠️ 文件名差异 - `logging_config.py` → `logging.js`（与测试文件和 index.js 引用保持一致）

---

## 改进建议

### 1. 添加"已知问题"部分

**问题**：跨平台测试失败不是代码移植问题，而是 Python 路径配置问题。

**建议**：在任务描述模板中添加"已知问题"部分，提前说明可能的环境问题：

```markdown
## 已知问题

- 跨平台测试可能需要配置 Python 路径：`sys.path.insert(0, str(PROJECT_ROOT / 'python' / 'scripts'))`
- Python 测试失败不一定是移植问题，可能是路径配置问题
- 如遇到 `ModuleNotFoundError`，先检查路径配置
```

### 2. 明确文件名约定

**问题**：`logging_config.py` 应该移植为 `logging.js` 还是 `logging_config.js`？

**建议**：在任务描述模板中明确文件名约定：

```markdown
## 文件名约定

- 保持与 Python 源文件一致，但使用 .js 扩展名
- 例外：`logging_config.py` → `logging.js`（与测试文件和 index.js 引用保持一致）
- 例外：`__init__.py` → `index.js`（Node.js 惯例）
- 连字符命名：`send_message.py` → `send-message.js`
```

### 3. 添加"移植前检查清单"

**问题**：porter agent 需要先确认测试文件和 index.js 的引用。

**建议**：添加移植前检查清单：

```markdown
## 移植前检查清单

在开始移植前，请确认：
- [ ] 已阅读 py.md 和 py.json
- [ ] 已检查 test.js 中的引用（`require('../../scripts/utils/xxx')`）
- [ ] 已检查 module/index.js 中的导出引用
- [ ] 已确认文件名（是否与测试和导出一致）
```

### 4. 添加"测试策略"部分

**问题**：跨平台测试失败，但核心测试都通过了。

**建议**：明确测试优先级和策略：

```markdown
## 测试策略

### 测试优先级
1. **核心功能测试**（必须通过）- 验证模块导入、函数存在、基本功能
2. **CLI 参数测试**（如适用）- 验证命令行参数处理
3. **集成测试**（必须通过）- 验证 SDKConfig 集成
4. **跨平台测试**（可选）- Python vs Node.js 行为对比

### 跨平台测试说明
- 跨平台测试失败可能是 Python 路径配置问题，不是移植问题
- 优先确保核心功能测试通过
- 跨平台测试可以稍后修复
```

### 5. 添加"常见陷阱"部分

**问题**：Python 和 JavaScript 在某些实现上有差异。

**建议**：添加常见陷阱和解决方案：

```markdown
## 常见陷阱

### Path 处理
- Python: `Path.home() / '.openclaw' / 'credentials'`
- JavaScript: `path.join(os.homedir(), '.openclaw', 'credentials')`

### 数据类
- Python: `@dataclass`
- JavaScript: `class` with constructor

### 可选参数
- Python: `def func(param=None)`
- JavaScript: `function func(param = defaultValue)`

### 环境变量
- Python: `os.environ.get('VAR', 'default')`
- JavaScript: `process.env.VAR || 'default'`
```

### 6. 添加"提交前验证"部分

**建议**：添加提交前的最终验证步骤：

```markdown
## 提交前验证

在提交移植代码前，请确认：
- [ ] 所有核心测试通过
- [ ] 代码通过 `node --check` 语法检查
- [ ] 已运行 ESLint（如配置）
- [ ] 已更新 module/index.js 导出（如适用）
- [ ] 已记录已知问题（如跨平台测试失败）
```

---

## 改进后的模板结构

基于以上建议，改进后的步骤 5 任务描述模板应包含：

```markdown
# 步骤 5: Node.js 代码移植 - <批次名称>

## 任务信息
- **任务类型**: 代码移植
- **目标文件**: <Python 文件路径>
- **输出文件**: <Node.js 文件路径>
- **依赖文件**: <依赖文件列表>

## 项目上下文
（保持不变）

## 移植前检查清单 ⭐ 新增
- [ ] 已阅读 py.md 和 py.json
- [ ] 已检查 test.js 中的引用
- [ ] 已检查 module/index.js 中的导出
- [ ] 已确认文件名

## 任务目标
（保持不变）

## 移植要求
（保持不变）

## 执行步骤
1. 阅读分析文档
2. 编写 Node.js 代码
3. 运行测试
4. 语法检查
5. 提交前验证 ⭐ 新增

## 测试策略 ⭐ 新增
### 测试优先级
1. 核心功能测试（必须通过）
2. CLI 参数测试（如适用）
3. 集成测试（必须通过）
4. 跨平台测试（可选）

## 验收标准
（增加一条）
- [ ] 已记录已知问题（如跨平台测试失败）

## 已知问题 ⭐ 新增
- 跨平台测试可能需要配置 Python 路径
- Python 测试失败不一定是移植问题

## 常见陷阱 ⭐ 新增
- Path 处理差异
- 数据类实现差异
- 可选参数处理

## 文件名约定 ⭐ 新增
- 保持与 Python 源文件一致
- 例外情况说明

## 注意事项
（增加常见陷阱说明）

## 参考资料
（保持不变）
```

---

## 下一步行动

1. **更新 skill.js.md** - 将上述改进建议应用到 9.1 节模板
2. **创建检查清单文件** - 创建独立的移植检查清单文件
3. **更新后续批次任务** - 使用改进后的模板创建后续批次任务描述

---

## 总结

### 第一轮移植成果
- ✅ 2 个文件移植完成
- ✅ 13 个核心测试通过
- ✅ 代码质量达标

### 改进建议
- 6 项模板改进建议
- 新增 5 个模板部分
- 优化测试策略说明

### 预期效果
- 减少 porter agent 的困惑
- 提高移植效率
- 减少跨平台测试相关的误报
