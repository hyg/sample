# 任务描述：编写 utils/auth.py 的蒸馏脚本

## 任务信息
- **任务类型**: 蒸馏脚本编写
- **步骤**: 步骤 2/7 - 蒸馏脚本编写
- **目标文件**: `python/scripts/utils/auth.py`
- **输出文件**: `doc/scripts/utils/auth.py/distill.py`

## 前置任务确认

### 检查清单（必须全部完成才能继续）

- [ ] `python/scripts/utils/auth.py` 存在（Python 源文件）
- [ ] `doc/scripts/utils/auth.py/py.md` 存在（分析报告）

### 如果前置任务未完成

**立即退出任务**，返回以下信息：

```
【前置任务未完成】任务中止
缺失：python/scripts/utils/auth.py 或 doc/scripts/utils/auth.py/py.md
```

**不要重试，不要继续执行**。

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`

### 相关文件位置
- Python 源文件：`python/scripts/utils/auth.py`
- 分析报告：`doc/scripts/utils/auth.py/py.md`
- 蒸馏脚本输出：`doc/scripts/utils/auth.py/distill.py`

## 任务目标

为 `utils/auth.py` 创建蒸馏脚本 `distill.py`。

## 可用工具

**允许使用的工具**：
- `read_file` - 读取文件
- `write_file` - 创建文件
- `run_shell_command` - 执行命令（用于验证）

**禁止使用的工具**：
- `edit` - 不要使用编辑工具，直接使用 write_file 创建完整文件
- 其他不需要的工具

## 执行步骤

### 步骤 1: 读取文件（使用 read_file）

1. 读取 `doc/scripts/utils/auth.py/py.md`
2. 读取 `python/scripts/utils/auth.py`

### 步骤 2: 分析函数列表

从 py.md 中提取所有公共函数名称。

### 步骤 3: 编写蒸馏脚本（使用 write_file）

创建 `doc/scripts/utils/auth.py/distill.py`，内容包含：
- 正确的导入路径
- 所有公共函数的蒸馏代码
- 主函数（if __name__ == "__main__"）

**重要**：
- 使用 `write_file` 一次性创建完整文件
- **不要使用 `edit` 工具**
- 确保没有死循环（while True、无限递归）
- 脚本在 30 秒内完成

### 步骤 4: 验证（使用 run_shell_command）

```bash
# 语法检查
python -m py_compile doc/scripts/utils/auth.py/distill.py

# 试运行
timeout 30 python doc/scripts/utils/auth.py/distill.py
```

## 错误处理

**如果任何工具调用失败**：

1. **立即停止执行**
2. **不要重试**
3. **返回错误信息**：

```
【工具调用失败】任务中止
失败的工具：<工具名称>
错误信息：<错误内容>
```

**禁止行为**：
- ❌ 不要重试失败的工具调用
- ❌ 不要尝试其他方法绕过
- ❌ 不要继续执行后续步骤
- ❌ 不要进入循环尝试

## 任务完成标准

- [ ] distill.py 已创建
- [ ] 语法检查通过
- [ ] 试运行在 30 秒内完成
- [ ] 没有死循环

## 输出格式

任务完成后，返回：

```
✅ 任务完成
文件：doc/scripts/utils/auth.py/distill.py
覆盖函数：[function1, function2, ...]
验证：语法检查✅ 试运行✅
```

或

```
❌ 任务中止
原因：<具体原因>
```
