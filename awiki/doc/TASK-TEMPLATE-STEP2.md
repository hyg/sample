# 步骤 2：蒸馏脚本编写 - 通用模版

## 任务信息
- **任务类型**: 蒸馏脚本编写
- **步骤**: 步骤 2/7 - 蒸馏脚本编写
- **目标文件**: `python/scripts/<path>/<file>.py`
- **输出文件**: `doc/scripts/<path>/<file>.py/distill.py`

## 前置任务确认

### 检查清单（必须全部完成才能继续）

- [ ] `python/scripts/<path>/<file>.py` 存在（Python 源文件）
- [ ] `doc/scripts/<path>/<file>.py/py.md` 存在（分析报告）

### 如果前置任务未完成

**退出当前任务**，并通知主 agent：

```
【前置任务未完成】
任务：编写 <file>.py 的蒸馏脚本
缺失的前置条件：
- Python 源文件不存在：python/scripts/<path>/<file>.py
或
- 分析报告不存在：doc/scripts/<path>/<file>.py/py.md

请先执行步骤 1：Python 代码分析。

当前任务已暂停，等待前置任务完成。
```

**不要继续执行**，直到前置任务完成！

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`

### 相关文件位置
- Python 源文件：`python/scripts/<path>/<file>.py`
- 分析报告：`doc/scripts/<path>/<file>.py/py.md`
- 蒸馏脚本输出：`doc/scripts/<path>/<file>.py/distill.py`

## 任务目标

为指定的 Python 文件创建蒸馏脚本 `distill.py`，提取所有公共函数的输入输出作为"黄金标准"。

## 执行步骤

### 步骤 1: 阅读分析报告

读取 `doc/scripts/<path>/<file>.py/py.md`，了解：
- 文件的功能概述
- 所有公共函数/类的签名
- 导入的模块和依赖
- 调用关系

### 步骤 2: 阅读 Python 源文件

读取 `python/scripts/<path>/<file>.py`，理解：
- 每个函数的实现逻辑
- 参数类型和返回值
- 异常处理
- 常量定义

### 步骤 3: 设计测试场景

为每个公共函数设计测试场景：

**纯函数**：直接调用，记录输入输出

**有外部依赖的函数**：
- 使用 mock 或模拟数据
- 记录 mock 的配置和预期行为

**CLI 脚本**：
- 记录命令行参数
- 记录标准输出
- 记录退出码

### 步骤 4: 编写蒸馏脚本

创建 `doc/scripts/<path>/<file>.py/distill.py`：

```python
#!/usr/bin/env python3
"""蒸馏脚本 - <file>.py

提取 <file>.py 中所有公共函数的输入输出作为黄金标准
"""

import sys
import json
from pathlib import Path

# 项目根目录：从 distill.py 向上 5 层
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

# 添加 Python 脚本目录到路径
sys.path.insert(0, str(PYTHON_SCRIPTS))

# 导入目标模块
from <path>.<file> import <function_name>

def distill():
    """执行蒸馏，返回输入输出对"""
    results = {
        "file": "python/scripts/<path>/<file>.py",
        "doc_path": "doc/scripts/<path>/<file>.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    # 为每个函数添加测试
    # 示例：
    # test_input = {"param1": "value1"}
    # test_output = <function_name>(**test_input)
    # results["functions"].append({
    #     "name": "<function_name>",
    #     "type": "function",
    #     "signature": "(param1) -> return_type",
    #     "tests": [{
    #         "input": test_input,
    #         "output": test_output,
    #         "scenario": "测试场景描述"
    #     }]
    # })
    
    return results

if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
```

**重要：死循环检查**

编写蒸馏脚本时，必须检查：
- [ ] 没有无限循环（如 `while True` 没有退出条件）
- [ ] 所有循环都有明确的退出条件
- [ ] 函数执行后会自动退出
- [ ] 没有递归调用或递归有明确的终止条件
- [ ] 脚本执行后会在合理时间内（< 30 秒）完成

### 步骤 5: 验证蒸馏脚本

**语法检查**：
```bash
python -m py_compile doc/scripts/<path>/<file>.py/distill.py
```

**死循环检查**：
- 检查代码中是否有 `while True` 没有退出条件
- 检查是否有递归调用没有终止条件
- 检查是否有无限循环的风险

**试运行**（带超时）：
```bash
# 使用超时防止死循环
timeout 30 python doc/scripts/<path>/<file>.py/distill.py
```

如果超时，说明有死循环，需要修复。

### 步骤 6: 完整性检查（防遗漏）

**任务完成检查清单**：

- [ ] distill.py 已创建
- [ ] distill.py 可以执行（语法正确）
- [ ] **没有死循环**（代码检查通过）
- [ ] **试运行在 30 秒内完成**（超时检查通过）
- [ ] 覆盖所有公共函数
- [ ] 包含常量导出
- [ ] 包含类信息

**只有所有复选框都勾选，任务才算完成！**

## 验收标准

1. ✅ 蒸馏脚本 `distill.py` 已创建
2. ✅ 蒸馏脚本可以执行（语法正确）
3. ✅ **没有死循环**（代码检查通过）
4. ✅ **试运行在 30 秒内完成**（超时检查通过）
5. ✅ 覆盖所有公共函数
6. ✅ 包含常量定义
7. ✅ 包含类信息

## 注意事项

- **不要修改 Python 源文件**：蒸馏只读取，不修改
- **处理外部依赖**：使用 mock 或模拟数据隔离外部依赖
- **覆盖所有场景**：包括正常流程、错误处理、边界情况
- **路径计算**：使用 `Path(__file__).resolve().parent.parent.parent.parent.parent` 计算项目根目录
- **错误处理**：使用 `default=str` 处理 Path 等不可序列化对象
- **死循环检查**：必须检查代码中是否有无限循环
- **超时保护**：试运行使用 timeout 命令防止死循环

## 常见遗漏错误

❌ **错误 1**：蒸馏脚本创建后不验证语法
   - **防止**：步骤 5 要求执行语法检查和试运行

❌ **错误 2**：遗漏某些函数的蒸馏
   - **防止**：步骤 6 完整性检查，对照 py.md 确认所有函数都已覆盖

❌ **错误 3**：py.json 生成后不验证内容
   - **防止**：步骤 5 要求试运行，确保能生成有效 JSON

❌ **错误 4**：代码中有死循环导致无法退出
   - **防止**：步骤 5 要求死循环检查和超时保护
   - **检查项**：while True 没有退出条件、递归没有终止条件、无限循环

## 参考资料

- [skill.js.md](../../../skill.js.md) - 第 10.1 节：Python 文件蒸馏任务模版
- [skill.py.md](../../../skill.py.md) - Python 版本分析
- `doc/scripts/<path>/<file>.py/py.md` - 分析报告
- `python/scripts/<path>/<file>.py` - Python 源文件
