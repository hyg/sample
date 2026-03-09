# Git 提交指南

**日期**: 2026-03-09  
**状态**: 清理完成，准备提交

---

## 提交内容分类

### ✅ 需要提交的核心文件

#### 1. **.gitignore 更新**
```
.gitignore
```

#### 2. **nodejs-client 核心代码**
```
nodejs-client/
├── lib/anp/authentication/     # P0 认证模块
│   ├── did_wba.js
│   ├── did_wba_authenticator.js
│   └── __init__.js
├── scripts/
│   ├── check_inbox.js
│   ├── e2ee_messaging.js
│   ├── get_profile.js
│   ├── manage_content.js
│   ├── manage_group.js
│   ├── manage_relationship.js
│   ├── register_handle.js
│   ├── send_message.js
│   ├── setup_identity.js
│   ├── update_profile.js
│   ├── ws_listener.js
│   └── utils/
│       ├── rpc.js
│       ├── credential_store.js
│       ├── config.js
│       └── __init__.js
├── src/
│   ├── credential_store.js
│   ├── ws_client.js
│   └── utils/
│       ├── auth.js
│       ├── client.js
│       ├── config.js
│       ├── identity.js
│       └── rpc.js
├── bin/awiki.js
├── package.json
└── README.md
```

#### 3. **MIGRATION-proj 文档**
```
MIGRATION-proj/
├── docs/
│   ├── P0_FINAL_COMPLETION_REPORT.md
│   ├── P0_TASKS_COMPLETION_REPORT.md
│   ├── JWT_AUTO_REFRESH_TEST_REPORT.md
│   ├── PYTHON_JWT_AUTO_REFRESH_ANALYSIS.md
│   └── ANP_PACKAGE_ANALYSIS.md
└── python-work/anp_source/
    ├── authentication/
    ├── e2e_encryption_hpke/
    └── proof/
```

---

### ❌ 已忽略的文件（不提交）

#### 1. **python-client/** - 官方代码
```
python-client/
```

#### 2. **nodejs-client/tests/** - 调试测试
```
nodejs-client/tests/
nodejs-client/*.mjs
nodejs-client/debug_*.js
nodejs-client/check_*.mjs
nodejs-client/verify_*.mjs
```

#### 3. **nodejs-client/scripts/*test*** - 测试脚本
```
nodejs-client/scripts/*test*.js
nodejs-client/scripts/send_test*.js
```

#### 4. **nodejs-client/src/** - 未使用的文件
```
nodejs-client/src/auth.js
nodejs-client/src/e2ee*.js
nodejs-client/src/hpke.js
nodejs-client/src/ratchet.js
nodejs-client/src/w3c_proof.js
nodejs-client/src/utils/handle.js
nodejs-client/src/utils/resolve.js
nodejs-client/src/index.js
```

#### 5. **凭证和数据**
```
nodejs-client/.credentials/
nodejs-client/.e2ee_store/
```

#### 6. **MIGRATION-proj 临时文件**
```
MIGRATION-proj/docs/ANP_PORTING_*.md
MIGRATION-proj/python-work/outputs/
MIGRATION-proj/python-work/tests/
```

---

## 建议的提交命令

### 第一次提交：P0 核心功能

```bash
cd D:\huangyg\git\sample\awiki

# 查看将要提交的文件
git status

# 添加 .gitignore
git add .gitignore

# 添加 nodejs-client 核心代码
git add nodejs-client/lib/anp/authentication/
git add nodejs-client/scripts/utils/
git add nodejs-client/scripts/test_jwt_*.js
git add nodejs-client/src/credential_store.js
git add nodejs-client/src/ws_client.js
git add nodejs-client/src/utils/
git add nodejs-client/bin/awiki.js
git add nodejs-client/package.json
git add nodejs-client/README.md

# 添加 MIGRATION-proj 文档
git add MIGRATION-proj/docs/P0_*.md
git add MIGRATION-proj/docs/JWT_AUTO_REFRESH_*.md
git add MIGRATION-proj/docs/PYTHON_JWT_AUTO_REFRESH_ANALYSIS.md
git add MIGRATION-proj/docs/ANP_PACKAGE_ANALYSIS.md
git add MIGRATION-proj/python-work/anp_source/

# 提交
git commit -m "feat: P0 JWT auto-refresh mechanism complete

Core implementation:
- lib/anp/authentication/ - DIDWbaAuthHeader class
- scripts/utils/rpc.js - 401 auto-retry
- scripts/utils/credential_store.js - JWT persistence
- scripts/test_jwt_*.js - Complete test suite (100% pass)

Documentation:
- P0_FINAL_COMPLETION_REPORT.md
- JWT_AUTO_REFRESH_TEST_REPORT.md
- ANP_PACKAGE_ANALYSIS.md

Python ANP source copied for reference:
- MIGRATION-proj/python-work/anp_source/"
```

### 第二次提交：python-client 更新

```bash
# python-client 已在 .gitignore 中，不需要提交
```

### 第三次提交：清理工作

```bash
# .gitignore 已生效，自动清理
```

---

## 验证提交

```bash
# 查看提交历史
git log --oneline -5

# 查看提交内容
git show HEAD

# 验证远程仓库
git remote -v
```

---

## 注意事项

1. **python-client/** 已在 .gitignore 中，不会被提交
2. **nodejs-client/tests/** 已忽略，保持本地调试
3. **凭证文件** 已忽略，保护私钥安全
4. **MIGRATION-proj** 只保留核心文档

---

**准备就绪**: 可以执行提交命令
