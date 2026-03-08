# npm 发布检查清单

**用途**: 确保每次 npm 发布前完成所有必要验证

**版本**: 1.0
**创建日期**: 2026-03-08

---

## 发布前检查清单

### 1. 代码质量检查

- [ ] 所有单元测试通过
  ```bash
  npm test
  ```

- [ ] 代码无语法错误
  ```bash
  node --check src/index.js
  node --check bin/awiki.js
  ```

- [ ] 所有依赖已正确声明
  ```bash
  npm list --depth=0
  ```

- [ ] 无敏感信息泄露
  ```bash
  # 检查是否有 API 密钥、密码等
  grep -r "API_KEY\|PASSWORD\|SECRET" src/ scripts/
  ```

---

### 2. 功能测试

- [ ] DID 身份创建功能正常
  ```bash
  npx awiki setup-identity --name "TestRelease"
  ```

- [ ] 消息发送功能正常
  ```bash
  npx awiki send-message --to <DID> --content "Test"
  ```

- [ ] E2EE 加密解密正常
  ```bash
  npx awiki e2ee-messaging --init --peer <DID>
  npx awiki e2ee-messaging --send --peer <DID> --content "Secret"
  ```

- [ ] 所有 CLI 命令可执行
  ```bash
  npx awiki --help
  ```

---

### 3. 互操作性验证

- [ ] Python → Node.js 消息互通
- [ ] Node.js → Python 消息互通
- [ ] E2EE 跨平台解密正常
- [ ] 与 awiki.ai 服务兼容

---

### 4. 文档检查

- [ ] README.md 已更新
  - [ ] 版本号正确
  - [ ] 功能描述准确
  - [ ] 示例代码可运行

- [ ] SKILL.md 套装已更新
  - [ ] SKILL.md（主文件）
  - [ ] SKILL-DID.md
  - [ ] SKILL-PROFILE.md
  - [ ] SKILL-MESSAGE.md
  - [ ] SKILL-SOCIAL.md
  - [ ] SKILL-GROUP.md
  - [ ] SKILL-CONTENT.md

- [ ] USAGE.md 已更新
  - [ ] 命令参数准确
  - [ ] 示例完整

- [ ] CHANGELOG.md 已更新
  - [ ] 本次变更已记录
  - [ ] 版本号对应正确

- [ ] LICENSE 和 NOTICE.md 存在

---

### 5. package.json 检查

- [ ] 版本号已更新（遵循 semver）
  ```bash
  npm version patch  # 或 minor/major
  ```

- [ ] name 字段正确（nodejs-awiki）
- [ ] main 字段指向正确入口
- [ ] bin 字段包含所有 CLI 命令
- [ ] dependencies 完整
- [ ] engines 指定 Node.js 版本要求
- [ ] repository 字段指向 Git 仓库
- [ ] license 字段正确

---

### 6. npm pack 验证

- [ ] 打包成功
  ```bash
  cd nodejs-client
  npm pack
  ```

- [ ] 检查生成的 tarball 内容
  ```bash
  tar -tzf nodejs-awiki-*.tgz
  ```

- [ ] 确认包含必要文件
  - [ ] lib/anp/
  - [ ] scripts/
  - [ ] bin/
  - [ ] SKILL*.md
  - [ ] README.md
  - [ ] package.json

- [ ] 确认排除不必要文件
  - [ ] tests/
  - [ ] .credentials/
  - [ ] .e2ee_store/
  - [ ] *.test.js
  - [ ] 开发文档

---

### 7. 独立环境安装测试

- [ ] 创建临时目录
  ```bash
  mkdir /tmp/test-install
  cd /tmp/test-install
  ```

- [ ] 安装 tarball
  ```bash
  npm install <path-to-tarball>
  ```

- [ ] 验证安装成功
  ```bash
  ls node_modules/nodejs-awiki/
  ```

- [ ] 测试 CLI 命令
  ```bash
  npx awiki --help
  npx awiki setup-identity --help
  ```

- [ ] 验证 SKILL.md 可读
  ```bash
  cat node_modules/nodejs-awiki/SKILL.md
  ```

- [ ] 清理临时目录
  ```bash
  rm -rf /tmp/test-install
  ```

---

### 8. Git 检查

- [ ] 所有更改已提交
  ```bash
  git status
  ```

- [ ] 提交信息清晰
  ```bash
  git log -n 3
  ```

- [ ] 创建 release branch（如需要）
  ```bash
  git checkout -b release/v1.x.x
  ```

- [ ] 准备 tag
  ```bash
  # 等待用户批准后执行
  # git tag v1.x.x
  # git push origin --tags
  ```

---

### 9. 用户批准

- [ ] 提交发布请求给用户
  - [ ] 版本号
  - [ ] 变更摘要
  - [ ] 测试结果

- [ ] 获得用户明确批准
  - [ ] 批准记录
  - [ ] 批准时间

---

### 10. 回滚准备

- [ ] 上一个稳定版本 tag 存在
  ```bash
  git tag v1.x.x-stable
  ```

- [ ] 回滚脚本就绪
  ```bash
  ls MIGRATION-proj/tools/rollback.sh
  ```

- [ ] 回滚计划文档完整
  ```bash
  cat MIGRATION-proj/docs/ROLLBACK_PLAN.md
  ```

---

## 发布执行

### 用户批准后执行

```bash
# 1. 确认当前版本
npm version  # 检查当前版本

# 2. 更新版本号（如未在之前执行）
npm version patch  # 或 minor/major

# 3. Git 提交和打 tag
git commit -am "Release v1.x.x"
git tag v1.x.x
git push origin --tags

# 4. 发布到 npm
npm publish --access public

# 5. 验证发布
npm view nodejs-awiki
```

---

## 发布后验证

- [ ] npm 页面显示正确
  ```bash
  npm view nodejs-awiki
  ```

- [ ] 可以安装最新版本
  ```bash
  npm install nodejs-awiki@latest
  ```

- [ ] 安装后功能正常
  ```bash
  npx awiki --help
  ```

- [ ] Release Notes 已更新
  ```bash
  cat MIGRATION-proj/docs/RELEASE_NOTES.md
  ```

- [ ] 通知用户发布完成

---

## 问题记录

### 发布过程中遇到的问题

| 问题 | 解决方式 | 备注 |
|------|---------|------|
| - | - | - |

---

## 签名确认

**发布人**: AI Assistant
**发布日期**: YYYY-MM-DD
**版本号**: v1.x.x

**检查确认**:
- [ ] 所有检查项已完成
- [ ] 用户已批准发布
- [ ] 发布成功完成

---

**下次审查**: 下次发布前审查此清单是否需要更新
