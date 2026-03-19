# 步骤 2：蒸馏脚本编写 - 任务执行列表

## 任务执行规则

1. **按顺序执行**：一次只执行一个任务
2. **独立上下文**：每个任务有独立的 task-distill.md 文件
3. **死循环检查**：每个任务必须通过死循环检查
4. **超时保护**：试运行使用 timeout 30 秒
5. **完成一个再执行下一个**：不要合并任务

## 第一批次：utils 工具模块（11 个文件）

### 执行顺序

| 序号 | 文件 | 任务文件 | 状态 | 完成时间 |
|------|------|----------|------|----------|
| 1 | utils/config.py | doc/scripts/utils/config.py/task-distill.md | ✅ 已完成 | - |
| 2 | utils/logging_config.py | doc/scripts/utils/logging_config.py/task-distill.md | ✅ 已完成 | - |
| 3 | utils/auth.py | doc/scripts/utils/auth.py/task-distill.md | ⏳ 待执行 | - |
| 4 | utils/identity.py | doc/scripts/utils/identity.py/task-distill.md | ⏳ 待执行 | - |
| 5 | utils/client.py | doc/scripts/utils/client.py/task-distill.md | ⏳ 待执行 | - |
| 6 | utils/rpc.py | doc/scripts/utils/rpc.py/task-distill.md | ⏳ 待执行 | - |
| 7 | utils/handle.py | doc/scripts/utils/handle.py/task-distill.md | ⏳ 待执行 | - |
| 8 | utils/e2ee.py | doc/scripts/utils/e2ee.py/task-distill.md | ⏳ 待执行 | - |
| 9 | utils/resolve.py | doc/scripts/utils/resolve.py/task-distill.md | ⏳ 待执行 | - |
| 10 | utils/ws.py | doc/scripts/utils/ws.py/task-distill.md | ⏳ 待执行 | - |
| 11 | utils/__init__.py | doc/scripts/utils/__init__.py/task-distill.md | ⏳ 待执行 | - |

## 第二批次：scripts 主目录文件（32 个文件）

| 序号 | 文件 | 任务文件 | 状态 |
|------|------|----------|------|
| 12 | __init__.py | doc/scripts/__init__.py/task-distill.md | ⏳ 待执行 |
| 13 | check_inbox.py | doc/scripts/check_inbox.py/task-distill.md | ⏳ 待执行 |
| 14 | check_status.py | doc/scripts/check_status.py/task-distill.md | ⏳ 待执行 |
| 15 | credential_layout.py | doc/scripts/credential_layout.py/task-distill.md | ⏳ 待执行 |
| ... | ... | ... | ... |

## 第三批次：tests 测试文件（19 个文件）

| 序号 | 文件 | 任务文件 | 状态 |
|------|------|----------|------|
| 44 | test_auth_update.py | doc/tests/test_auth_update.py/task-distill.md | ⏳ 待执行 |
| 45 | test_check_inbox_cli.py | doc/tests/test_check_inbox_cli.py/task-distill.md | ⏳ 待执行 |
| ... | ... | ... | ... |

## 任务执行流程

```
1. 读取任务列表，找到下一个"待执行"任务
   ↓
2. 检查前置任务是否完成（py.md 是否存在）
   ↓
3. 如果前置完成，委托 distiller agent 执行
   ↓
4. 等待任务完成
   ↓
5. 验证输出（distill.py 是否存在，语法是否正确）
   ↓
6. 更新任务列表状态为"已完成"
   ↓
7. 继续下一个任务
```

## 当前进度

- **步骤 2 总体进度**: 2/63 (3%)
- **第一批次进度**: 2/11 (18%)
- **当前执行任务**: utils/auth.py

## 任务完成验证

每个任务完成后，执行以下验证：

```bash
# 1. 检查 distill.py 是否存在
ls -la doc/scripts/utils/auth.py/distill.py

# 2. 语法检查
python -m py_compile doc/scripts/utils/auth.py/distill.py

# 3. 试运行（带超时）
timeout 30 python doc/scripts/utils/auth.py/distill.py
```

验证通过后，才能继续下一个任务。
