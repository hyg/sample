# awiki-agent-id-message 文档索引

这是 awiki-agent-id-message 项目的完整文档集合，包括 Python SDK 和三个 Node.js 项目的设计文档。

**更新日期**: 2026-03-16  
**完成状态**: [查看完成状态](COMPLETION_STATUS.md) - 设计阶段 100% 完成

---

## 文档结构

### Node.js 项目设计文档

| 项目 | 文档 | 说明 |
|------|------|------|
| **Module 项目** | [module.md](module.md) | 将 Python utils 模块移植为 JavaScript |
| **Skill 项目** | [skill.md](skill.md) | agentskills.io 规范的 Skill Package |
| **SDK 项目** | [sdk.md](sdk.md) | npm 发行包，为 Node.js 客户端提供 SDK 接口 |
| **依赖映射** | [DEPENDENCIES.md](DEPENDENCIES.md) | Python 依赖到 Node.js 的映射方案 |
| **依赖检查** | [DEPENDENCY_CHECKLIST.md](DEPENDENCY_CHECKLIST.md) | Python 依赖检查清单 |
| **设计总结** | [DESIGN_SUMMARY.md](DESIGN_SUMMARY.md) | 三个项目的设计总结 |

### Python SDK 文档

| 文档 | 说明 |
|------|------|
| **web.md** | awiki.ai Web API 文档 |
| **cli.md** | CLI 工具使用文档 |
| **scripts/** | scripts 目录综合文档 |

### 依赖库文档

| 依赖库 | 设计文档 | 测试数据 |
|--------|---------|---------|
| **anp-0.6.8** | [lib/anp-0.6.8/js.md](lib/anp-0.6.8/js.md) | [lib/anp-0.6.8/distill.json](lib/anp-0.6.8/distill.json) |
| **httpx-0.28.0** | [lib/httpx-0.28.0/js.md](lib/httpx-0.28.0/js.md) | [lib/httpx-0.28.0/distill.json](lib/httpx-0.28.0/distill.json) |
| **websockets-16.0** | [lib/websockets-16.0/js.md](lib/websockets-16.0/js.md) | [lib/websockets-16.0/distill.json](lib/websockets-16.0/distill.json) |

### 测试数据蒸馏

| 文档 | 说明 |
|------|------|
| **蒸馏总结** | [DISTILL_SUMMARY.md](DISTILL_SUMMARY.md) | 所有模块测试数据蒸馏总结 |
| **Util 模块** | `util/*/distill.json` | 10 个 util 模块的测试用例数据 |
| **Lib 依赖** | `lib/*/distill.json` | 3 个依赖库的测试用例数据 |

### 测试计划文档

| 项目 | 测试计划 | 说明 |
|------|---------|------|
| **Module 项目** | [module.test.md](module.test.md) | 模块单元测试、集成测试、交叉测试 |
| **Skill 项目** | [skill.test.md](skill.test.md) | CLI 脚本测试、场景测试、超时测试 |
| **SDK 项目** | [npm.test.md](npm.test.md) | API 函数测试、类型测试、端到端测试 |
| **测试总结** | [TEST_SUMMARY.md](TEST_SUMMARY.md) | 三个项目测试计划总结 |

```
doc/
├── README.md                 # 本文档（索引）
├── web.md                    # Web API 文档
├── cli.md                    # CLI 工具文档
├── lib/                      # 依赖库文档
│   ├── anp-0.6.8/
│   │   └── readme.md
│   ├── httpx-0.28.0/
│   │   └── readme.md
│   └── websockets-16.0/
│       └── readme.md
├── util/                     # 工具模块文档
│   ├── auth/
│   │   └── readme.md
│   ├── client/
│   │   └── readme.md
│   ├── config/
│   │   └── readme.md
│   ├── e2ee/
│   │   └── readme.md
│   ├── handle/
│   │   └── readme.md
│   ├── identity/
│   │   └── readme.md
│   ├── init/
│   │   └── readme.md
│   ├── logging_config/
│   │   └── readme.md
│   ├── resolve/
│   │   └── readme.md
│   ├── rpc/
│   │   └── readme.md
│   └── ws/
│       └── readme.md
└── scripts/                  # 脚本模块文档
    └── readme.md
```

---

## 文档分类

### 1. API 文档

| 文档 | 描述 | 链接 |
|------|------|------|
| **Web API 文档** | awiki.ai 平台的所有 RESTful API | [web.md](web.md) |
| **CLI 工具文档** | 所有命令行工具的使用说明 | [cli.md](cli.md) |

### 2. 依赖库文档

| 文档 | 描述 | 链接 |
|------|------|------|
| **ANP 0.6.8** | awiki Network Protocol 库 | [lib/anp-0.6.8/readme.md](lib/anp-0.6.8/readme.md) |
| **httpx 0.28.0** | HTTP 客户端库 | [lib/httpx-0.28.0/readme.md](lib/httpx-0.28.0/readme.md) |
| **websockets 16.0** | WebSocket 客户端库 | [lib/websockets-16.0/readme.md](lib/websockets-16.0/readme.md) |

### 3. 工具模块文档

| 模块 | 描述 | 链接 |
|------|------|------|
| **utils/__init__** | 包入口和公共接口 | [util/init/readme.md](util/init/readme.md) |
| **utils/auth** | DID 认证和 JWT 获取 | [util/auth/readme.md](util/auth/readme.md) |
| **utils/client** | HTTP 客户端工厂 | [util/client/readme.md](util/client/readme.md) |
| **utils/config** | SDK 配置管理 | [util/config/readme.md](util/config/readme.md) |
| **utils/e2ee** | E2EE 端到端加密 | [util/e2ee/readme.md](util/e2ee/readme.md) |
| **utils/handle** | Handle 注册和解析 | [util/handle/readme.md](util/handle/readme.md) |
| **utils/identity** | DID 身份创建 | [util/identity/readme.md](util/identity/readme.md) |
| **utils/logging_config** | 日志配置 | [util/logging_config/readme.md](util/logging_config/readme.md) |
| **utils/resolve** | 标识符解析 | [util/resolve/readme.md](util/resolve/readme.md) |
| **utils/rpc** | JSON-RPC 客户端 | [util/rpc/readme.md](util/rpc/readme.md) |
| **utils/ws** | WebSocket 客户端 | [util/ws/readme.md](util/ws/readme.md) |

### 4. 脚本模块文档

| 文档 | 描述 | 链接 |
|------|------|------|
| **scripts/** | 所有 CLI 脚本的综合文档 | [scripts/readme.md](scripts/readme.md) |

---

## 快速入门

### 安装依赖

```bash
cd python
pip install -r requirements.txt
```

### 创建身份

```bash
python scripts/setup_identity.py --name myid
```

### 注册 Handle

```bash
python scripts/register_handle.py --handle myname --phone +8613800138000
```

### 发送消息

```bash
python scripts/send_message.py --to @alice --content "Hello!"
```

### 查看文档

- **Web API**: 查看 [web.md](web.md) 了解所有 API 端点
- **CLI 工具**: 查看 [cli.md](cli.md) 了解所有命令
- **模块文档**: 查看 `util/` 目录了解每个工具模块
- **依赖库**: 查看 `lib/` 目录了解依赖库的使用

---

## 文档更新日期

- **创建日期**: 2026-03-16
- **最后更新**: 2026-03-16

---

## 文档内容概要

### web.md - Web API 文档

- awiki.ai 平台功能概述
- DID WBA 认证协议
- 9 个 API 端点详解：
  - 身份认证服务
  - Handle 管理服务
  - 消息服务
  - 群组服务
  - Profile 服务
  - 社交关系服务
  - 内容管理服务
  - 搜索服务
  - 积分服务
- E2EE 加密协议
- WebSocket 推送
- 本地存储结构
- 错误处理

### cli.md - CLI 工具文档

- 14 个 CLI 工具的完整使用说明
- 每个命令的参数、输入输出示例
- 业务场景调用时序
- 故障排除指南

### scripts/readme.md - 脚本模块文档

- 30+ 个脚本的分类说明
- 每个脚本的功能和使用方法
- 凭证存储结构
- 本地数据库说明
- 使用流程示例

### util/*.md - 工具模块文档

每个工具模块的详细说明，包括：
- 模块概述
- 导入依赖
- 函数/类详解
- 调用关系
- 使用示例

### lib/*/readme.md - 依赖库文档

每个依赖库的详细说明，包括：
- 库的概述和版本
- 被调用的接口
- 调用位置汇总
- 源码位置
- 核心实现细节

---

## 贡献指南

如需更新文档，请：
1. 修改对应的 `.md` 文件
2. 更新此索引文档（如有新增）
3. 确保代码示例可运行
4. 保持文档风格一致
