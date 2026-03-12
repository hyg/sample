# Agent 记忆文档

## 项目概述

本项目是将 Python 版本的 awiki.ai 客户端迁移到 Node.js 的项目。

## 关键技术栈

- **前端**: Node.js (ES Modules)
- **后端**: awiki.ai 服务器
- **数据库**: SQLite (better-sqlite3)
- **加密**: HPKE (Hybrid Public Key Encryption)
- **认证**: DID WBA (Web Blockchain Authentication)

## 重要文件说明

### 核心模块
- `nodejs-client/src/` - SDK 核心代码
- `nodejs-client/scripts/` - CLI 命令行工具
- `nodejs-client/lib/anp/` - ANP 认证库

### 测试文件
- `MIGRATION-proj/tests/comprehensive_test.js` - 全面测试脚本
- `MIGRATION-proj/tests/jwt_expiration_simple_test.js` - JWT 单元测试
- `MIGRATION-proj/debug/` - 调试脚本

### 文档
- `README.md` - 项目说明
- `MIGRATION-proj/docs/` - 详细文档

## 测试原则

### 原则一：命令行方式测试
**凡是生产环境中用户从命令行调用的代码，都是用命令行方式测试**

- 适用范围：独立的 CLI 工具（如 `check_inbox.js`, `check_status.js` 等）
- 测试方法：使用 `child_process.spawn` 执行命令行

### 原则二：函数方式测试
**凡是被其它代码导入并调用的函数，使用测试代码导入并调用**

- 适用范围：可导入的函数模块（如工具函数、SDK 模块）
- 测试方法：使用 `import` 导入并直接调用函数

## 调试模式说明

### 模式类型
1. **调试模式**: 使用本项目文件夹内的路径（`.credentials`）
2. **正常模式**: 使用 Python 版本相同的路径（`C:\Users\hyg\.openclaw\credentials\...`）

### 模式切换
1. **命令行参数**:
   - `--debug` 或 `-d`: 切换到调试模式
   - `--normal` 或 `-n`: 切换到正常模式

2. **环境变量**:
   - `NODE_AWIKI_MODE=debug`: 切换到调试模式
   - `NODE_AWIKI_MODE=normal`: 切换到正常模式

3. **自动检测**:
   - 当前目录包含 `nodejs-client`: 调试模式
   - 其他情况: 正常模式

## JWT 自动刷新机制

### 工作流程
1. 客户端发送请求到 awiki.ai 服务器
2. 服务器返回 401 "JWT expired or invalid"
3. 客户端自动检测到 401 错误
4. 调用 `getJwtViaWba()` 获取新 JWT
5. 更新本地凭据文件
6. 重试原始请求
7. 继续执行后续操作

### 修复的问题
1. **signature.r.toBigInt() 错误**: `@noble/curves` 返回 BigInt，不是 Uint8Array
2. **JWT 生成时的 BigInt 转换问题**: 错误地尝试将 BigInt 转换为 BigInt
3. **凭据加载路径问题**: Node.js 版本无法从默认路径加载凭据

## 常见问题和解决方案

### 1. JWT 过期检测失败
**原因**: 时区处理不一致
**解决方案**: 统一使用 UTC 时间

### 2. 凭据加载失败
**原因**: 路径配置错误
**解决方案**: 使用模式配置系统，正确设置调试/正常模式

### 3. 网络连接错误
**原因**: `user-service` 主机名无法解析
**解决方案**: 检查 DNS 配置和服务器状态

## 测试验证

### 全面测试
```bash
node MIGRATION-proj\tests\comprehensive_test.js
```

### CLI 命令测试
```bash
test_cli_commands.bat
```

### 模式切换测试
```bash
node test_mode_switching.js --debug
node test_mode_switching.js --normal
```

## 项目状态

### 已完成
- ✅ JWT 自动刷新功能修复
- ✅ 调试/正常模式系统
- ✅ 全面测试脚本
- ✅ CLI 命令测试
- ✅ npm 包版本 0.1.3 准备发布

### 待完成
- ⚠️ 完善 E2EE 密钥再生功能
- ⚠️ 添加更多 CLI 命令
- ⚠️ 性能优化

## 用户反馈处理

### 反馈收集
- **身份**: hyg4awiki (站内消息接收者)
- **目标**: 收取 hyg4awiki 身份的站内消息，选出其中的 npm 包用户反馈信息
- **消息来源**: TestReporter, devclaw

### 处理流程
1. **消息收集**: 通过 awiki.ai 消息系统收取 hyg4awiki 身份的站内消息
2. **筛选反馈**: 选出与 npm 包相关的用户反馈信息
3. **讨论改进**: 与用户讨论改进方案
4. **记录更新**: 将讨论结果更新到 agent.md 和 CHANGELOG.md

### 已收集反馈 (2026-03-12)

#### 1. TestReporter 测试报告 (v0.1.2)
**内容**: node-awiki Test Report v0.1.2
- Installation: SUCCESS (77 pkgs)
- Identity: PASS
- Handle Resolution: PASS
- Issues: JWT refresh bug, missing CLI commands, no tests
- Status: FUNCTIONAL

**反馈分类**: Bug 报告
**问题**:
- ✅ JWT refresh bug (已修复)
- ⚠️ Missing CLI commands (需要添加)
- ⚠️ No tests (需要添加测试)

#### 2. devclaw 测试报告 (v0.1.0)
**内容**: node-awiki v0.1.0 测试报告
- 通过功能：身份管理、消息发送、收件箱查看
- 问题：
  1. 认证不一致：send 正常，但 follow/profile/content 返回 401
  2. E2EE 模块导入错误：e2ee_outbox.js 缺少 beginSendAttempt 导出
  3. 服务器方法缺失：createGroup、markRead、getHistory 未实现

**反馈分类**: Bug 报告
**问题**:
- ⚠️ 认证不一致 (部分已修复)
- ⚠️ E2EE 模块导入错误 (需要检查)
- ⚠️ 服务器方法缺失 (需要检查)

### 改进方案

#### 立即修复
- ✅ JWT refresh bug (已修复)
- ✅ 认证失败 401 (已修复)
- ✅ E2EE 代码错误 (已修复)

#### 需要跟进
- ⚠️ Missing CLI commands - 需要添加更多 CLI 命令
- ⚠️ No tests - 需要添加更多测试
- ⚠️ 认证不一致 - 需要检查 follow/profile/content 接口
- ⚠️ E2EE 模块导入错误 - 需要检查 e2ee_outbox.js
- ⚠️ 服务器方法缺失 - 需要检查 createGroup、markRead、getHistory

#### 下一步行动
1. 添加更多 CLI 命令测试
2. 完善测试覆盖率
3. 检查并修复认证不一致问题
4. 检查 E2EE 模块导入
5. 检查服务器方法实现

### 反馈分类统计
- **功能建议**: 0 条
- **Bug 报告**: 3 条 (JWT refresh, 认证失败, E2EE 错误)
- **使用问题**: 0 条
- **性能反馈**: 0 条

## 联系方式

- **作者**: hyg4awiki
- **DID**: `did:wba:awiki.ai:user:k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw`
- **联系方式**: 通过 awiki.ai 消息系统
