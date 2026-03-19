# awiki-agent-id-message Node.js 移植工作流程

## 工作流程概述

按步骤批量执行，每个步骤完成所有文件的任务，确保前置步骤完成后才能进入下一步。

```
步骤 1: Python 代码分析 → doc/*/py.md
    ↓
步骤 2: 蒸馏脚本编写 → doc/*/distill.py
    ↓
步骤 3: 蒸馏执行 → doc/*/py.json
    ↓
步骤 4: 测试代码编写 → doc/*/test.js
    ↓
步骤 5: Node.js 移植 → module/scripts/*.js (逐个测试通过)
    ↓
步骤 6: module 集成测试 → module/tests/integration/
    ↓
步骤 7: nodejs-client 项目 → nodejs-client/ (最终产品)
```

---

## 步骤 1: Python 代码分析

**目标**: 为所有 Python 文件创建分析报告 `doc/*/py.md`

**输入**: 
- `python/scripts/**/*.py` (所有 Python 源文件)

**输出**:
- `doc/scripts/**/*.py/py.md` (每个 py 文件对应一个分析报告)
- `doc/tests/**/*.py/py.md` (测试文件分析报告)

**任务描述**:

```markdown
# 步骤 1: Python 代码分析

## 任务
为 python/scripts 下的每个 .py 文件创建分析报告 py.md

## 分析内容
每个 py.md 应包含：
1. 文件概述
2. 常量定义
3. 类定义（属性、方法）
4. 函数签名（参数、返回值）
5. 导入的模块
6. 调用关系（调用谁、被谁调用）
7. 环境变量（如有）

## 输出位置
- python/scripts/utils/config.py → doc/scripts/utils/config.py/py.md
- python/scripts/send_message.py → doc/scripts/send_message.py/py.md
- ... (所有文件)

## 完成标准
- [ ] 所有 py 文件都有对应的 py.md
- [ ] py.md 包含完整的函数/类签名
- [ ] py.md 包含调用关系
- [ ] doc/cli.md 已更新（CLI 命令文档）
- [ ] doc/web.md 已更新（API 文档）
- [ ] doc/skill.py.md 已更新（Python 版本分析）
- [ ] doc/skill.js.md 已更新（Node.js 移植方案）

## 验证
执行以下命令验证：
```bash
# 检查是否所有 py 文件都有 py.md
python scripts/verify_step1.py
```
```

**文件列表** (63 个 py 文件):
- scripts/utils/ (11 个): config, logging_config, auth, identity, client, rpc, handle, e2ee, resolve, ws, __init__
- scripts/ (32 个): setup_identity, register_handle, send_message, check_inbox, manage_group, etc.
- tests/ (19 个): test_*.py
- 根目录 (1 个): install_dependencies.py

---

## 步骤 2: 蒸馏脚本编写

**目标**: 为所有 Python 文件创建蒸馏脚本 `doc/*/distill.py`

**前置条件**: 步骤 1 完成（所有 py.md 已创建）

**输入**:
- `python/scripts/**/*.py` (Python 源文件)
- `doc/scripts/**/*.py/py.md` (分析报告)

**输出**:
- `doc/scripts/**/*.py/distill.py` (每个 py 文件对应一个蒸馏脚本)

**任务描述**:

```markdown
# 步骤 2: 蒸馏脚本编写

## 任务
为每个 Python 文件创建蒸馏脚本 distill.py

## 蒸馏脚本要求
每个 distill.py 应：
1. 导入目标 Python 模块
2. 为每个公共函数设计测试输入
3. 执行函数，捕获输出
4. 输出 JSON 格式的蒸馏数据

## 输出位置
- doc/scripts/utils/config.py/distill.py
- doc/scripts/send_message.py/distill.py
- ... (所有文件)

## 完成标准
- [ ] 所有 py 文件都有对应的 distill.py
- [ ] distill.py 可以执行（语法正确）
- [ ] distill.py 覆盖所有公共函数
- [ ] 包含常量导出
- [ ] 包含类信息

## 验证
```bash
# 检查是否所有文件都有 distill.py
python scripts/verify_step2.py

# 抽样执行蒸馏脚本
python doc/scripts/utils/config.py/distill.py
```
```

**注意**: 此步骤不需要 task-distill.md 文件，直接编写 distill.py

---

## 步骤 3: 蒸馏执行

**目标**: 执行所有蒸馏脚本，生成 `doc/*/py.json`

**前置条件**: 步骤 2 完成（所有 distill.py 已创建）

**输入**:
- `doc/scripts/**/*.py/distill.py` (所有蒸馏脚本)

**输出**:
- `doc/scripts/**/*.py/py.json` (蒸馏输出)

**任务描述**:

```markdown
# 步骤 3: 蒸馏执行

## 任务
执行所有蒸馏脚本，生成 py.json 文件

## 执行命令
```bash
cd D:\huangyg\git\sample\awiki

# 批量执行
for file in doc/scripts/*/distill.py; do
    python "$file" > "${file/distill.py/py.json}" 2>&1
done

# utils 子目录
for file in doc/scripts/utils/*/distill.py; do
    python "$file" > "${file/distill.py/py.json}" 2>&1
done

# tests 子目录
for file in doc/tests/*/distill.py; do
    python "$file" > "${file/distill.py/py.json}" 2>&1
done
```

## 完成标准
- [ ] 所有 py.json 文件已生成
- [ ] py.json 格式正确（JSON 可解析）
- [ ] py.json 包含 functions 数组
- [ ] py.json 包含测试输入输出

## 验证
```bash
# 验证 JSON 格式
python scripts/verify_step3.py

# 检查 py.json 内容
python -c "import json; json.load(open('doc/scripts/utils/config.py/py.json'))"
```
```

---

## 步骤 4: 测试代码编写

**目标**: 为所有文件创建 Node.js 单元测试代码 `doc/*/test.js`

**前置条件**: 步骤 3 完成（所有 py.json 已生成）

**输入**:
- `doc/scripts/**/*.py/py.json` (蒸馏数据)
- `doc/scripts/**/*.py/py.md` (分析报告)

**输出**:
- `doc/scripts/**/*.py/test.js` (Node.js 测试文件)

**任务描述**:

```markdown
# 步骤 4: Node.js 测试代码编写

## 任务
基于 py.json 和 py.md，为每个文件编写 Node.js 测试代码

## 测试代码要求
每个 test.js 应：
1. 导入蒸馏数据（py.json）
2. 为每个函数创建测试用例
3. 包含 CLI 测试（如适用）
4. 包含交叉测试（Python vs Node.js）

## 输出位置
- doc/scripts/utils/config.py/test.js
- doc/scripts/send_message.py/test.js
- ... (所有文件)

## 完成标准
- [ ] 所有 py 文件都有对应的 test.js
- [ ] test.js 基于 py.json 的测试数据
- [ ] test.js 使用 Jest 格式
- [ ] CLI 脚本包含命令行测试
- [ ] 包含 Python vs Node.js 交叉测试

## 验证
```bash
# 检查是否所有文件都有 test.js
python scripts/verify_step4.py
```
```

---

## 步骤 5: Node.js 代码移植

**目标**: 将所有 Python 文件移植到 Node.js，形成 `module/scripts/*.js`

**前置条件**: 步骤 4 完成（所有 test.js 已创建）

**输入**:
- `python/scripts/**/*.py` (Python 源文件)
- `doc/scripts/**/*.py/py.json` (蒸馏数据)
- `doc/scripts/**/*.py/py.md` (分析报告)
- `doc/scripts/**/*.py/test.js` (测试文件)

**输出**:
- `module/scripts/**/*.js` (Node.js 移植代码)

**执行顺序**（按依赖关系）:

### 5.1 第一批次：基础工具模块
1. `module/scripts/utils/config.js` - 配置管理
2. `module/scripts/utils/logging.js` - 日志管理

### 5.2 第二批次：核心工具模块
3. `module/scripts/utils/rpc.js` - JSON-RPC
4. `module/scripts/utils/client.js` - HTTP 客户端
5. `module/scripts/utils/auth.js` - 认证
6. `module/scripts/utils/identity.js` - 身份创建

### 5.3 第三批次：业务工具模块
7. `module/scripts/utils/handle.js` - Handle 管理
8. `module/scripts/utils/e2ee.js` - E2EE 加密
9. `module/scripts/utils/resolve.js` - DID 解析
10. `module/scripts/utils/ws.js` - WebSocket

### 5.4 第四批次：核心业务脚本
11. `module/scripts/credential-store.js` - 凭证存储
12. `module/scripts/local-store.js` - 本地存储
13. `module/scripts/setup-identity.js` - 身份设置
14. `module/scripts/send-message.js` - 发送消息
15. `module/scripts/check-inbox.js` - 检查收件箱

### 5.5 第五批次：其他业务脚本
16-50. 其他业务脚本（按依赖顺序）

### 5.6 第六批次：测试脚本
51-63. 测试脚本移植

**任务描述**:

```markdown
# 步骤 5: Node.js 代码移植

## 任务
按依赖顺序将所有 Python 文件移植到 Node.js

## 移植要求
每个 .js 文件应：
1. 函数名、参数、返回值与 Python 完全一致
2. 变量名保持一致
3. 实现逻辑一致
4. 不做猜测和简化

## 移植流程（每个文件）
1. 阅读 py.md 和 py.json
2. 编写 Node.js 代码
3. 运行 test.js 测试
4. 如失败，修复直到通过
5. Python vs Node.js 交叉验证
6. 通过后提交

## 输出位置
- module/scripts/utils/config.js
- module/scripts/utils/logging.js
- module/scripts/send-message.js
- ... (所有文件)

## 完成标准
- [ ] 所有 py 文件都有对应的 js 文件
- [ ] 所有 test.js 测试通过
- [ ] Python vs Node.js 交叉测试通过
- [ ] 代码通过语法检查（node --check）

## 验证
```bash
cd module
npm test
```
```

---

## 步骤 6: module 集成测试

**目标**: 完成 module 项目的集成测试

**前置条件**: 步骤 5 完成（所有 js 文件已移植且单元测试通过）

**输入**:
- `module/scripts/**/*.js` (所有 Node.js 代码)

**输出**:
- `module/tests/integration/**/*.test.js` (集成测试)
- 修复后的 module 代码

**任务描述**:

```markdown
# 步骤 6: module 集成测试

## 任务
编写集成测试，验证模块间协作

## 测试场景
1. 身份创建 → Handle 注册 → 发送消息
2. 创建群组 → 加入群组 → 群消息
3. E2EE 会话建立 → 加密通信
4. Python ↔ Node.js 交叉通信

## 输出位置
- module/tests/integration/messaging.test.js
- module/tests/integration/group.test.js
- module/tests/integration/e2ee.test.js
- module/tests/integration/cross-platform.test.js

## 完成标准
- [ ] 所有集成测试通过
- [ ] Python vs Node.js 行为一致
- [ ] 3 轮以上来回通信测试通过
- [ ] 性能达标（CLI < 500ms）

## 验证
```bash
cd module
npm run test:integration
```
```

---

## 步骤 7: nodejs-client 项目

**目标**: 将 module 的代码转移到 nodejs-client，完成最终产品

**前置条件**: 步骤 6 完成（module 集成测试通过）

**输入**:
- `module/scripts/**/*.js` (已验证的 Node.js 代码)
- `module/tests/**/*.js` (测试代码)

**输出**:
- `nodejs-client/` (完整的 Skill 项目)

**任务描述**:

```markdown
# 步骤 7: nodejs-client 项目

## 任务
将 module 的代码转移到 nodejs-client，创建完整的 Skill 项目

## 转移内容
1. scripts/ → nodejs-client/scripts/
2. lib/ → nodejs-client/lib/ (适配器)
3. 创建 nodejs-client/package.json
4. 创建 nodejs-client/SKILL.md
5. 创建 nodejs-client/README.md

## 输出位置
- nodejs-client/scripts/utils/config.js
- nodejs-client/scripts/send-message.js
- nodejs-client/SKILL.md
- nodejs-client/package.json
- ...

## 完成标准
- [ ] 所有代码已转移
- [ ] nodejs-client 可以独立运行
- [ ] 集成测试通过
- [ ] SKILL.md 符合 agentskills.io 规范
- [ ] 文档完整

## 验证
```bash
cd nodejs-client
npm install
npm test
```
```

---

## 步骤完成检查

| 步骤 | 输入 | 输出 | 完成标准 |
|------|------|------|----------|
| 1. Python 分析 | python/**/*.py | doc/*/py.md | 所有文件有 py.md |
| 2. 蒸馏脚本 | python/**/*.py, doc/*/py.md | doc/*/distill.py | 所有文件有 distill.py |
| 3. 蒸馏执行 | doc/*/distill.py | doc/*/py.json | 所有文件有 py.json |
| 4. 测试编写 | doc/*/py.json, doc/*/py.md | doc/*/test.js | 所有文件有 test.js |
| 5. 代码移植 | python/**/*.py, doc/*/* | module/scripts/*.js | 所有测试通过 |
| 6. 集成测试 | module/scripts/*.js | module/tests/integration/ | 集成测试通过 |
| 7. 最终项目 | module/* | nodejs-client/ | Skill 项目完成 |

---

## 当前进度

### 步骤 1: Python 代码分析 ✅ 已完成！

- ✅ 64 个 Python 文件
- ✅ 66 个 py.md 文件（包含 lib 目录 3 个）
- ✅ 覆盖率：100%+
- ✅ doc 根目录文件完整（cli.md, web.md, skill.py.md, skill.js.md, WORKFLOW.md）

### 步骤 2: 蒸馏脚本编写 ⚪ 待开始

- ⏳ 需要创建 63 个 distill.py 文件
- ✅ 已完成：2 个（config.py, logging_config.py）
- ⏳ 待完成：61 个

### 步骤 3: 蒸馏执行 ⚪ 待开始
### 步骤 4: 测试代码编写 ⚪ 待开始
### 步骤 5: Node.js 代码移植 ⚪ 待开始
### 步骤 6: module 集成测试 ⚪ 待开始
### 步骤 7: nodejs-client 项目 ⚪ 待开始
