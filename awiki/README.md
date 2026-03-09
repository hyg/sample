# awiki-agent-id-message 项目组织

**创建日期**: 2026-03-08
**最后更新**: 2026-03-08
**项目结构**: 统一维护 Python 和 Node.js 客户端代码

---

## python-client 代码获取方式（重要）

`python-client/` 文件夹存放 Python 最新版本的**原始代码**（只读参考）。

### 获取最新代码的两个官方来源：

1. **静态文件下载**（推荐，快速）
   - URL: `http://awiki.info/static-files/awiki-agent-id-message.zip`
   - 适用场景：快速下载最新版本

2. **GitHub 仓库**（完整历史）
   - URL: `https://github.com/AgentConnect/awiki-agent-id-message`
   - 适用场景：查看提交历史、Issue 跟踪

### 更新 python-client 的步骤：

```bash
# 方法 1：下载 ZIP 并解压
cd D:\huangyg\git\sample\awiki
# 删除旧版本
rm -rf python-client/*
# 下载并解压新 ZIP（手动或使用脚本）
# 将 ZIP 内容复制到 python-client/

# 方法 2：从 GitHub 克隆
cd D:\huangyg\git\sample\awiki
rm -rf python-client
git clone https://github.com/AgentConnect/awiki-agent-id-message.git python-client
```

### 重要规则：

| 规则 | 说明 |
|------|------|
| ✅ **只读参考** | `python-client/` 仅作为参考，不做任何修改 |
| ✅ **唯一来源** | 仅从上述两个官方来源获取代码 |
| ✅ **工作区分离** | 所有分析、测试、修改在 `MIGRATION-proj/python-work/` 进行 |
| ✅ **版本追踪** | 每次更新记录来源、日期、版本号 |

---

---

## 各文件夹说明

### python-client (原始代码仓库)

**内容**: Python 最新版本的**官方原始代码**（只读仓库）
- 完整的 scripts 目录（所有 Python 脚本）
- 官方文档（README、LICENSE 等）
- 官方依赖配置（requirements.txt、pyproject.toml）

**来源**（仅从以下两个官方渠道获取）:
1. **静态文件**: `http://awiki.info/static-files/awiki-agent-id-message.zip`
2. **GitHub**: `https://github.com/AgentConnect/awiki-agent-id-message`

**用途**:
- 作为原始代码参考
- 运行官方脚本进行测试
- **保持原始性，不做任何修改**

**维护流程**:
```
1. 从官方来源下载最新代码
   ↓
2. 覆盖 python-client/ 全部内容
   ↓
3. 记录更新日志到 MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md
   ↓
4. 基于新代码重新测试 nodejs-client
   ↓
5. 根据测试结果修订 MIGRATION-proj/ 中文档
```

**重要**: 
- 此文件夹是**只读仓库**，仅在升级时可覆盖
- **所有派生内容**（分析、测试、修改、文档）**从一开始**就放在 `MIGRATION-proj/`
- 详见 `MIGRATION-proj/docs/PYTHON_CLIENT_READONLY_RULES.md`

---

### nodejs-client

**内容**: Node.js 最新版本的代码
- src/ - 核心库文件
- scripts/ - 脚本工具
- bin/ - CLI 工具（awiki 命令）
- tests/ - 测试文件
- .credentials/ - 测试凭证

**用途**:
- 主要的 Node.js 实现
- NPM 包发布源
- 日常开发和维护

---

#### 实现状态

| 模块 | 状态 | 完成度 |
|------|------|--------|
| DID 认证 | ⏳ 待实现 | 0% |
| 消息服务 | ⏳ 待实现 | 0% |
| Handle 服务 | ⏳ 待实现 | 0% |
| 个人资料 | ⏳ 待实现 | 0% |
| 社交关系 | ⏳ 待实现 | 0% |
| 内容页面 | ⏳ 待实现 | 0% |
| WebSocket | ⏳ 待实现 | 0% |

**用途**:
- 实现本地测试服务器
- 理解服务端功能
- 提供离线测试环境

---

## 工作流程

### 1. Python 版本更新

```
1. 更新 python-client/ 目录
   ↓
2. 分析差异，生成迁移计划
   ↓
3. 更新测试计划。
   ↓
4. 手动/自动更新 nodejs-client/
   ↓
5. 运行测试验证
   ↓
6. 清理文件，git提交
   ↓
7. 更新nodejs-client/ 的readme.md，skill.md，通过 npm 发布新版本
```

### 2. 日常开发

```
1. 收到bug report
   ↓
2. 运行 nodejs-client/tests/ 测试
   ↓
3. 修改、提交代码
   ↓
4. git提交，npm发布
```

### 3. awiki.ai返回错误码

```
1. 使用相同参数调用python版本代码，收集收发数据包。
   ↓
2. 如果python版本功能正常，逐行仔细分析代码的实现细节，移植到nodejs版本
   ↓
3. 重新测试nodejs版本，直到功能一致。
```


### 更新流程

1. Python 版本更新 → 更新 `python-client/`
2. 运行git对比工具 → 生成差异报告
3. 更新 `nodejs-client/`
4. 更新相关文档
5. 提交所有更改

---

## NPM 发布流程

### 准备工作

1. 更新版本号
2. 更新 CHANGELOG
3. 运行完整测试套件
4. 验证 package.json

### 发布步骤

```bash
cd awiki/nodejs-client

# 1. 更新版本号
npm version patch  # 或 minor/major

# 2. 运行测试
npm test

# 3. 发布
npm publish --access public

# 4. 推送 tag
git push origin v1.x.x
```

### 发布后验证

1. 安装新版本
2. 运行 CLI 验证
3. 检查 NPM 页面
4. 更新项目文档

---

## 版本控制

### Git 分支策略

```
main          - 主分支，稳定版本
develop       - 开发分支
feature/*     - 功能分支
release/*     - 发布分支
hotfix/*      - 热修复分支
```

### 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

---

**最后更新**: 2026-03-08  
**维护者**: AI Assistant
