# Agent 职责总览

## 项目背景
- 项目：awiki-agent-id-message Python to Node.js 移植
- 版本：0.1.5

## Agent 列表

| Agent | 职责 | 阶段 |
|-------|------|------|
| analyzer | 扫描代码，提取签名 | 1. 分析 |
| distiller | 执行 Python，记录输入输出 | 2. 蒸馏 |
| porter | 移植代码 | 4. 移植 |
| tester | 对比测试 | 5. 测试 |
| debugger | 修复 Bug | 5. 测试 |
| publisher | 发布准备 | 5. 发布 |

## 工作流程
analyzer → distiller → porter → tester → (debugger) → publisher

## 核心规则

### 测试规则
- 禁止只测试 --help
- 禁止不对比 Python 输出
- 禁止不记录实际输出

### 修复规则
- 禁止不阅读 Python 源码
- 禁止凭想象改变实现
- 修复后必须验证一致性