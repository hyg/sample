# awiki Node.js 升级工作流程

**版本**: 1.0
**生效日期**: 2026-03-08
**项目仓库**: https://github.com/YOUR_USERNAME/awiki-agent-id-message

---

## 1. 工作流程总览

```
用户触发 → 代码分析 → 真实测试 → 计划设计 → 用户确认 → 
执行升级 → 测试验证 → 文档更新 → 发布验证 → npm 发布
```

**总周期**: 通常 1-2 周（取决于升级复杂度）

**触发方式**: 用户指示（检查 Python 版本更新）

---

## 2. 详细流程

### 阶段 1: 用户触发

**触发条件**: 用户指示检查 Python 版本更新

**负责人**: 用户 → AI Assistant

**步骤**:

1. **用户提出请求**
   - 示例："检查 Python 版本是否有更新"
   - 或："同步最新 Python 代码"

2. **下载最新代码**
   ```bash
   # 备份旧版本
   mv python-client python-client.backup.YYYYMMDD
   
   # 下载新版本（方法 A: ZIP 下载）
   curl -o awiki-agent-id-message.zip http://awiki.info/static-files/awiki-agent-id-message.zip
   unzip awiki-agent-id-message.zip -d python-client/
   
   # 或（方法 B: Git 克隆）
   git clone https://github.com/AgentConnect/awiki-agent-id-message.git python-client
   ```

3. **Git 提交**
   ```bash
   git add python-client/
   git commit -m "Update python-client to YYYYMMDD"
   git push
   ```

4. **记录更新日志**
   - 文件: `MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md`

**输出**:
- ✅ python-client/ 已更新
- ✅ Git 已提交
- ✅ docs/PYTHON_UPDATE_LOG.md 已记录

---

### 阶段 2: 代码分析与初步评估

**负责人**: AI Assistant

**步骤**:

1. **对比 Python 新旧版本**
   - 对比 `python-client/` 与 `python-client.backup.YYYYMMDD/`
   - 识别变更的文件和功能

2. **识别变更内容**
   - 新增功能
   - 修改功能
   - Bug 修复
   - API 变化

3. **评估 Node.js 影响**
   - 哪些功能需要升级？
   - 影响范围多大？
   - 风险评估

4. **生成分析报告**
   - 文件: `MIGRATION-proj/docs/PYTHON_CHANGE_ANALYSIS.md`

**输出**:
- ✅ docs/PYTHON_CHANGE_ANALYSIS.md
- ✅ 初步影响评估

---

### 阶段 3: 真实测试验证

**负责人**: AI Assistant

**步骤**:

1. **准备测试环境**
   - Python 环境：使用新下载的 python-client/
   - Node.js 环境：当前 nodejs-client/
   - 测试凭证：MIGRATION-proj/nodejs-work/.credentials/

2. **在 awiki.ai 测试 Python 新功能**
   ```bash
   # Python 测试
   cd python-client/scripts
   python setup_identity.py --name "PyTestNew"
   python <新功能脚本>
   ```

3. **对比 Node.js 当前行为**
   ```bash
   # Node.js 测试
   cd nodejs-client
   node scripts/setup_identity.js --name "NodeTestNew"
   node scripts/<对应功能>
   ```

4. **记录测试结果**
   - 文件: `MIGRATION-proj/docs/PYTHON_TEST_RESULTS.md`
   - 内容：测试步骤、Python 输出、Node.js 输出、差异

5. **确认升级需求**
   - 文件: `MIGRATION-proj/docs/NODEJS_UPGRADE_REQUIREMENTS.md`
   - 明确需要升级的具体功能点

**输出**:
- ✅ docs/PYTHON_TEST_RESULTS.md
- ✅ docs/NODEJS_UPGRADE_REQUIREMENTS.md

---

### 阶段 4: 升级计划设计

**负责人**: AI Assistant

**步骤**:

1. **设计技术方案**
   - 需要修改的文件
   - 需要新增的文件
   - 需要删除的文件
   - lib/anp/ 对应模块更新

2. **评估工作量和风险**
   - 预计工时
   - 技术难点
   - 风险点及缓解措施

3. **制定测试计划**
   - 单元测试
   - 互操作性测试
   - awiki.ai 真实测试

4. **更新 SKILL.md 草案**
   - 标记为 `[DRAFT]`
   - 反映功能变化
   - 便于测试验证

5. **生成升级计划**
   - 文件: `MIGRATION-proj/docs/NODEJS_UPGRADE_PLAN.md`

**输出**:
- ✅ docs/NODEJS_UPGRADE_PLAN.md
- ✅ SKILL.md 草案（标记 DRAFT）
- ✅ 测试计划

---

### 阶段 5: 用户确认

**负责人**: 用户

**步骤**:

1. **AI Assistant 提交升级计划**
   - 提交 docs/NODEJS_UPGRADE_PLAN.md
   - 说明升级内容、风险、预计时间

2. **用户审查**
   - 审查升级必要性
   - 提问和讨论
   - 提出修改建议

3. **AI Assistant 调整计划**
   - 根据用户反馈调整
   - 更新升级计划文档

4. **用户批准**
   - 用户确认可以执行
   - 记录批准时间

**输出**:
- ✅ 用户批准记录
- ✅ 最终版 NODEJS_UPGRADE_PLAN.md

---

### 阶段 6: 执行升级

**负责人**: AI Assistant

**步骤**:

1. **创建 Git 分支**
   ```bash
   git checkout -b feature/upgrade-YYYYMMDD
   ```

2. **在 nodejs-work/ 实施代码修改**
   ```bash
   cd MIGRATION-proj/nodejs-work
   
   # 修改 lib/anp/ 对应模块
   # 修改 scripts/ 对应功能
   ```

3. **同步更新 lib/anp/**
   - 按照 lib/anp 结构设计
   - 保持与 Python anp 包对应

4. **记录实施日志**
   - 文件: `MIGRATION-proj/docs/IMPLEMENTATION_LOG.md`
   - 记录每次修改的内容和原因

5. **Git 提交阶段性成果**
   ```bash
   git add nodejs-client/
   git commit -m "Implement <feature-name>"
   ```

**输出**:
- ✅ 代码修改完成
- ✅ docs/IMPLEMENTATION_LOG.md
- ✅ Git 分支已更新

---

### 阶段 7: 测试验证

**负责人**: AI Assistant

**步骤**:

1. **单元测试**
   ```bash
   cd MIGRATION-proj/nodejs-work
   node tests/test_*.js
   ```

2. **互操作性测试**
   - Python → Node.js 消息互通
   - Node.js → Python 消息互通
   - E2EE 加解密测试

3. **awiki.ai 真实测试**
   - 使用真实服务验证
   - 对比 Python 行为

4. **记录测试结果**
   - 文件: `MIGRATION-proj/docs/UPGRADE_TEST_REPORT.md`
   - 通过/失败详情

5. **问题修复循环**
   ```
   发现问题 → 返回阶段 6 修复 → 重新测试 → 验证通过
   ```

**输出**:
- ✅ docs/UPGRADE_TEST_REPORT.md
- ✅ 所有测试通过

---

### 阶段 8: 文档更新

**负责人**: AI Assistant

**步骤**:

1. **完善 SKILL.md 套装**
   - 移除 `[DRAFT]` 标记
   - 基于最终实现完善内容
   - 验证示例代码可运行

2. **更新用户文档**
   - README.md
   - USAGE.md
   - CHANGELOG.md

3. **更新内部文档**
   - 升级完成记录
   - 经验总结

**输出**:
- ✅ SKILL.md 套装（正式版）
- ✅ README.md, USAGE.md, CHANGELOG.md

---

### 阶段 9: 发布前验证

**负责人**: AI Assistant

**步骤**:

1. **npm pack 打包测试**
   ```bash
   cd nodejs-client
   npm pack
   # 检查生成的 tarball
   ```

2. **独立环境安装验证**
   ```bash
   # 在临时目录安装
   mkdir /tmp/test-install
   cd /tmp/test-install
   npm install <path-to-tarball>
   # 验证功能
   ```

3. **运行完整测试套件**
   ```bash
   npm test
   ```

4. **生成验证报告**
   - 文件: `MIGRATION-proj/docs/PRELEASE_VERIFICATION.md`

**输出**:
- ✅ docs/PRELEASE_VERIFICATION.md
- ✅ 发布候选版本

---

### 阶段 10: 用户发布确认

**负责人**: 用户

**步骤**:

1. **AI Assistant 提交发布请求**
   - 提交 docs/PRELEASE_VERIFICATION.md
   - 提交升级总结
   - 请求发布批准

2. **用户审查**
   - 审查测试结果
   - 审查文档更新
   - 确认可以发布

3. **用户批准发布**
   - 明确指示可以发布
   - 确认目标版本号

**输出**:
- ✅ 用户发布批准记录

---

### 阶段 11: npm 发布

**负责人**: AI Assistant（根据用户批准）

**步骤**:

1. **更新版本号**
   ```bash
   npm version patch  # 或 minor/major，根据用户指示
   ```

2. **Git 提交和打 tag**
   ```bash
   git commit -am "Release v1.x.x"
   git tag v1.x.x
   git push origin --tags
   ```

3. **npm publish**
   ```bash
   npm publish --access public
   ```

4. **验证发布**
   - 检查 npm 页面
   - 测试下载安装
   - 验证功能

5. **发布通知**
   - 更新 Release Notes
   - 记录发布完成

**输出**:
- ✅ npm 包已发布
- ✅ Git tag 已创建
- ✅ docs/RELEASE_NOTES.md

---

### 阶段 12: 回滚准备

**负责人**: AI Assistant

**步骤**:

1. **保留上一个稳定版本 tag**
   ```bash
   git tag v1.x.x-stable
   git push origin --tags
   ```

2. **准备回滚脚本**
   - 文件: `MIGRATION-proj/tools/rollback.sh`
   - 步骤清晰

3. **记录回滚步骤**
   - 文件: `MIGRATION-proj/docs/ROLLBACK_PLAN.md`
   - 什么情况下回滚
   - 如何回滚

**输出**:
- ✅ git tag 已创建
- ✅ docs/ROLLBACK_PLAN.md

---

## 3. 文档索引

| 阶段 | 文档 | 位置 |
|------|------|------|
| 1 | PYTHON_UPDATE_LOG.md | MIGRATION-proj/docs/ |
| 2 | PYTHON_CHANGE_ANALYSIS.md | MIGRATION-proj/docs/ |
| 3 | PYTHON_TEST_RESULTS.md | MIGRATION-proj/docs/ |
| 3 | NODEJS_UPGRADE_REQUIREMENTS.md | MIGRATION-proj/docs/ |
| 4 | NODEJS_UPGRADE_PLAN.md | MIGRATION-proj/docs/ |
| 6 | IMPLEMENTATION_LOG.md | MIGRATION-proj/docs/ |
| 7 | UPGRADE_TEST_REPORT.md | MIGRATION-proj/docs/ |
| 8 | SKILL.md 套装 | nodejs-client/ |
| 9 | PRESALE_VERIFICATION.md | MIGRATION-proj/docs/ |
| 11 | RELEASE_NOTES.md | MIGRATION-proj/docs/ |
| 12 | ROLLBACK_PLAN.md | MIGRATION-proj/docs/ |

---

## 4. 角色与职责

| 角色 | 职责 | 人员 |
|------|------|------|
| **触发** | 提出升级请求 | 用户 |
| **分析** | 代码分析和评估 | AI Assistant |
| **测试** | 执行测试验证 | AI Assistant |
| **实施** | 代码修改 | AI Assistant |
| **文档** | 文档编写和更新 | AI Assistant |
| **审批** | 升级计划和发布审批 | 用户 |

---

## 5. 时间估算

| 阶段 | 预计时间 | 说明 |
|------|---------|------|
| 1. 用户触发 | - | 用户决定 |
| 2. 代码分析 | 0.5-1 天 | 取决于变更大小 |
| 3. 真实测试 | 1-2 天 | 需要 awiki.ai 可用 |
| 4. 计划设计 | 0.5-1 天 | 技术方案设计 |
| 5. 用户确认 | 1-2 天 | 等待用户反馈 |
| 6. 执行升级 | 1-3 天 | 取决于复杂度 |
| 7. 测试验证 | 1-2 天 | 包含修复时间 |
| 8. 文档更新 | 0.5 天 | 文档完善 |
| 9. 发布验证 | 0.5 天 | 打包和验证 |
| 10. 用户发布确认 | 1-2 天 | 等待用户反馈 |
| 11. npm 发布 | 0.5 天 | 发布和通知 |
| **总计** | **8-16 天** | 通常 1-2 周 |

---

## 6. 质量管理

### 检查清单

#### 阶段 7 完成后检查

- [ ] 所有单元测试通过
- [ ] 互操作性测试通过
- [ ] awiki.ai 真实测试通过
- [ ] 与 Python 行为一致
- [ ] 测试报告完整

#### 阶段 9 完成后检查

- [ ] npm pack 成功
- [ ] 独立环境安装验证通过
- [ ] 完整测试套件通过
- [ ] SKILL.md 套装完整
- [ ] CHANGELOG.md 已更新

#### 发布前最终检查

- [ ] 用户批准发布
- [ ] 所有文档已更新
- [ ] 版本号已更新
- [ ] Git tag 已创建
- [ ] 回滚方案已准备

---

## 7. Git 工作流

### 分支策略

```
main          - 主分支，稳定版本
develop       - 开发分支
upgrade/*     - 升级分支（临时）
```

### 升级流程 Git 操作

```bash
# 1. 创建升级分支
git checkout develop
git checkout -b upgrade/YYYYMMDD-feature

# 2. 实施升级并提交
git add <files>
git commit -m "Implement <feature>"

# 3. 合并到 develop
git checkout develop
git merge upgrade/YYYYMMDD-feature

# 4. 发布前合并到 main
git checkout main
git merge develop
git tag v1.x.x
git push origin --tags

# 5. 如需回滚
git revert <commit-hash>
# 或
git checkout <previous-tag>
```

---

## 8. 风险管理

### 常见风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| awiki.ai 服务不可用 | 测试无法进行 | 等待恢复/使用缓存数据 |
| Python 变更过大 | 工作量激增 | 分阶段实施/优先核心功能 |
| 互操作性问题 | 无法与 Python 互通 | 详细对比/逐步调试 |
| npm 发布失败 | 需要重新发布 | 本地验证充分/准备回滚 |

### 回滚触发条件

- 发布后发现严重 Bug
- 互操作性问题影响核心功能
- 用户反馈重大问题

---

**制定人**: AI Assistant
**生效日期**: 2026-03-08
**审查周期**: 每次升级后审查改进
