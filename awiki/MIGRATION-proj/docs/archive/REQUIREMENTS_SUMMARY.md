# 全面测试和调试要求总结

## 1. 测试原则

### 原则一：命令行方式测试
**凡是生产环境中用户从命令行调用的代码，都是用命令行方式测试**

- 适用范围：独立的 CLI 工具（如 `check_inbox.js`, `check_status.js` 等）
- 测试方法：使用 `child_process.spawn` 执行命令行
- 示例：
  ```bash
  node scripts\check_inbox --credential hyg4awiki
  ```

### 原则二：函数方式测试
**凡是被其它代码导入并调用的函数，使用测试代码导入并调用**

- 适用范围：可导入的函数模块（如工具函数、SDK 模块）
- 测试方法：使用 `import` 导入并直接调用函数
- 示例：
  ```javascript
  import { myFunction } from './module.js';
  const result = myFunction(5);
  ```

## 2. 全面测试要求

### 2.1 测试脚本结构
- **comprehensive_test.js**: 全面测试脚本
  - 单元测试（函数方式）
  - JWT 过期测试
  - CLI 命令测试（命令行方式）

### 2.2 测试内容
1. **单元测试**: 测试可导入的函数
2. **JWT 过期测试**: 测试 JWT 自动刷新机制
3. **CLI 命令测试**: 测试命令行工具

### 2.3 测试执行
```bash
# 运行全面测试
node MIGRATION-proj\tests\comprehensive_test.js

# 运行 CLI 命令测试
test_cli_commands.bat
```

## 3. 调试要求

### 3.1 调试模式 vs 正常模式
- **调试模式**: 使用本项目文件夹内的路径（`.credentials`）
- **正常模式**: 使用 Python 版本相同的路径（`C:\Users\hyg\.openclaw\credentials\...`）

### 3.2 模式切换方式
1. **命令行参数**:
   - `--debug` 或 `-d`: 切换到调试模式
   - `--normal` 或 `-n`: 切换到正常模式

2. **环境变量**:
   - `NODE_AWIKI_MODE=debug`: 切换到调试模式
   - `NODE_AWIKI_MODE=normal`: 切换到正常模式

3. **自动检测**:
   - 当前目录包含 `nodejs-client`: 调试模式
   - 其他情况: 正常模式

### 3.3 数据采集要求
当 awiki.ai 返回错误码时：
1. 调用 Python 版本获得输入输出数据作为基准
2. 采集每一步的内部函数调用输入输出值
3. 采集 awiki.ai 的收发数据包
4. 编写全程采集数据的测试版本代码
5. 比较 Python 和 Node.js 版本的实现细节差异

## 4. JWT 自动刷新测试

### 4.1 测试场景
使用已过期的 JWT 凭据测试自动刷新功能：

```bash
node scripts\check_inbox.js --credential hyg4awiki
```

### 4.2 预期行为
1. 检测到 JWT 过期
2. 自动触发 JWT 刷新流程
3. 获取新的 JWT
4. 重试原始请求
5. 成功读取站内消息

### 4.3 验证方法
比较 Python 和 Node.js 版本的输出：
- Python: 成功读取 11 条消息
- Node.js: 成功读取 11 条消息
- 结果应该完全一致

## 5. 文件清理要求

### 5.1 保留文件
- `README.md`: 项目说明文档
- `agent.md`: 项目记忆文档

### 5.2 清理文件
- 临时测试脚本: 移动到 `MIGRATION-proj/tests/`
- 调试脚本: 移动到 `MIGRATION-proj/debug/`
- 文档文件: 移动到 `MIGRATION-proj/docs/`

### 5.3 重复使用文件
- 需要重复使用的文件保存到 `MIGRATION-proj/` 适合位置
- 避免根目录杂乱

## 6. 项目记忆文档

### 6.1 agent.md 内容
- 项目概述
- 关键技术栈
- 重要文件说明
- 测试原则
- 调试模式说明
- 常见问题和解决方案

### 6.2 文档位置
- 根目录: `agent.md`
- 详细文档: `MIGRATION-proj/docs/`
