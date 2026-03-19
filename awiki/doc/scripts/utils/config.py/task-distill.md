# 任务描述：Python 文件蒸馏 - utils/config.py

## 任务信息
- **任务类型**: 蒸馏
- **目标文件**: `python/scripts/utils/config.py`
- **输出文件**: `doc/scripts/utils/config.py/py.json`
- **依赖文件**: 
  - `doc/scripts/utils/config.py/py.md` (分析报告)
  - `python/scripts/utils/config.py` (Python 源文件)

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`
- module 目录：`D:\huangyg\git\sample\awiki\module\`

### 相关文件位置
- Python 源文件：`python/scripts/utils/config.py`
- 蒸馏脚本输出：`doc/scripts/utils/config.py/distill.py`
- 蒸馏输出：`doc/scripts/utils/config.py/py.json`
- 分析报告：`doc/scripts/utils/config.py/py.md`

## 任务目标

为 `utils/config.py` 创建蒸馏脚本并执行蒸馏，提取所有公共函数/类的输入输出作为"黄金标准"，保存到 `py.json` 文件中。

## 执行步骤

### 步骤 1: 阅读分析报告

读取 `doc/scripts/utils/config.py/py.md`，了解：
- 文件的功能概述
- 所有公共函数/类的签名
- 导入的模块和依赖
- 调用关系

### 步骤 2: 阅读 Python 源文件

读取 `python/scripts/utils/config.py`，理解：
- 每个函数的实现逻辑
- 参数类型和返回值
- 异常处理
- 常量定义

### 步骤 3: 设计测试场景

为 `SDKConfig` 类的每个方法设计测试场景：

**SDKConfig.load()**：
- 场景 1：加载默认配置（无参数）
- 场景 2：加载自定义配置（指定路径）

**SDKConfig 属性**：
- user_service_url
- molt_message_url
- molt_message_ws_url
- did_domain
- credentials_dir
- data_dir

### 步骤 4: 编写蒸馏脚本

创建 `doc/scripts/utils/config.py/distill.py`：

```python
#!/usr/bin/env python3
"""蒸馏脚本 - utils/config.py"""

import sys
import json
from pathlib import Path

# 添加 Python 脚本目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'python' / 'scripts'))

# 导入目标模块
from utils.config import SDKConfig

def distill():
    """执行蒸馏，返回输入输出对"""
    results = {
        "file": "python/scripts/utils/config.py",
        "doc_path": "doc/scripts/utils/config.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    # 测试 SDKConfig.load()
    test_input = {"config_path": None}
    config = SDKConfig.load()
    test_output = {
        "user_service_url": config.user_service_url,
        "molt_message_url": config.molt_message_url,
        "molt_message_ws_url": config.molt_message_ws_url,
        "did_domain": config.did_domain,
        "credentials_dir": str(config.credentials_dir),
        "data_dir": str(config.data_dir)
    }
    results["functions"].append({
        "name": "SDKConfig.load",
        "type": "classmethod",
        "signature": "(config_path=None) -> SDKConfig",
        "tests": [{
            "input": test_input,
            "output": test_output,
            "scenario": "加载默认配置"
        }]
    })
    
    # 导出常量
    results["constants"] = {
        "DEFAULT_CREDENTIAL_NAME": "default"
    }
    
    # 导出类信息
    results["classes"] = {
        "SDKConfig": {
            "properties": [
                "user_service_url",
                "molt_message_url", 
                "molt_message_ws_url",
                "did_domain",
                "credentials_dir",
                "data_dir"
            ],
            "methods": ["load"]
        }
    }
    
    return results

if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
```

### 步骤 5: 执行蒸馏脚本

```bash
cd D:\huangyg\git\sample\awiki
python doc/scripts/utils/config.py/distill.py > doc/scripts/utils/config.py/py.json
```

### 步骤 6: 验证输出

检查生成的 `py.json`：
- JSON 格式正确
- 所有公共函数都有测试
- 输入输出数据完整
- 场景描述清晰

## 验收标准

1. ✅ 蒸馏脚本 `distill.py` 已创建并可执行
2. ✅ 蒸馏输出 `py.json` 格式正确
3. ✅ `SDKConfig` 类的所有公共方法都有测试场景
4. ✅ 常量定义已导出
5. ✅ 类属性已记录

## 注意事项

- **不要修改 Python 源文件**：蒸馏只读取，不修改
- **处理外部依赖**：config.py 依赖环境变量，使用默认值
- **路径处理**：使用 `str()` 转换 Path 对象为字符串
- **敏感数据**：不要记录真实的凭证路径

## 参考资料

- [skill.js.md](../../skill.js.md) - 第 10.1 节：Python 文件蒸馏任务模版
- [skill.py.md](../../skill.py.md) - Python 版本分析
- `doc/scripts/utils/config.py/py.md` - 分析报告
