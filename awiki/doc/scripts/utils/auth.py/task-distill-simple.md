# 任务：编写 utils/auth.py 的蒸馏脚本

## 输入
- `python/scripts/utils/auth.py` - Python 源文件
- `doc/scripts/utils/auth.py/py.md` - 分析报告

## 输出
- `doc/scripts/utils/auth.py/distill.py` - 蒸馏脚本

## 文件操作方式
- **读取**：read_file
- **写入**：write_file（写入完整文件内容）
- **执行**：run_shell_command

## 步骤

1. 读取输入文件
2. 分析 auth.py 中的公共函数
3. 写入 distill.py（完整内容）
4. 执行验证命令

## 验证

```bash
python -m py_compile doc/scripts/utils/auth.py/distill.py
timeout 30 python doc/scripts/utils/auth.py/distill.py
```

## 完成标准

- distill.py 已创建
- 语法检查通过
- 30 秒内运行完成
- 无死循环
