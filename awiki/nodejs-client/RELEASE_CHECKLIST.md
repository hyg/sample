# NPM 发布检查清单

**版本**: 1.0.0  
**日期**: 2026-03-08  
**包名**: awiki-agent-id-message

---

## 发布前检查

### 代码质量

- [ ] 所有核心功能已实现
- [ ] 代码通过 lint 检查
- [ ] 无 console.log 调试语句（除 CLI 外）
- [ ] 错误处理完整
- [ ] 注释清晰

### 测试覆盖

- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 跨平台测试通过
- [ ] E2EE 互操作测试通过
- [ ] 性能测试通过

### 文档完整性

- [ ] README.md 完整
- [ ] USAGE.md 完整
- [ ] API 文档完整
- [ ] 示例代码正确
- [ ] 故障排除指南完整

### package.json 配置

- [ ] 包名正确：`awiki-agent-id-message`
- [ ] 版本号正确：`1.0.0`
- [ ] 描述清晰
- [ ] 关键词完整
- [ ] 许可证正确
- [ ] bin 配置正确
- [ ] 依赖版本正确

### Git 仓库

- [ ] .gitignore 完整
- [ ] .npmignore 配置
- [ ] LICENSE 文件存在
- [ ] CHANGELOG.md 更新
- [ ] 所有更改已提交

---

## 测试清单

### 功能测试

#### 身份管理
- [ ] 创建身份成功
- [ ] JWT 获取成功
- [ ] 凭证保存成功
- [ ] 加载已保存身份成功

#### 消息收发
- [ ] 明文消息发送成功
- [ ] 明文消息接收成功
- [ ] 收件箱查询成功
- [ ] 聊天历史查询成功

#### E2EE 加密
- [ ] 握手成功
- [ ] 加密消息成功
- [ ] 解密消息成功
- [ ] 棘轮算法正确
- [ ] 会话持久化成功

#### 社交关系
- [ ] 关注成功
- [ ] 取消关注成功
- [ ] 关系状态查询成功
- [ ] 关注列表查询成功
- [ ] 粉丝列表查询成功

#### 内容页面
- [ ] 创建页面成功
- [ ] 更新页面成功
- [ ] 删除页面成功
- [ ] 重命名页面成功

#### WebSocket
- [ ] 连接成功
- [ ] 接收推送成功
- [ ] 断线重连成功

### 跨平台测试

#### Python → Node.js
- [ ] 明文消息互通
- [ ] E2EE 消息互通
- [ ] 社交关系互通

#### Node.js → Python
- [ ] 明文消息互通
- [ ] E2EE 消息互通
- [ ] 社交关系互通

### CLI 测试

- [ ] `awiki identity create` 工作正常
- [ ] `awiki message send` 工作正常
- [ ] `awiki e2ee handshake` 工作正常
- [ ] `awiki social follow` 工作正常
- [ ] `awiki content create` 工作正常
- [ ] `awiki --help` 显示正确

---

## 发布步骤

### 1. 版本更新

```bash
# 更新 package.json 版本号
npm version patch  # 1.0.0 -> 1.0.1
# 或
npm version minor  # 1.0.0 -> 1.1.0
# 或
npm version major  # 1.0.0 -> 2.0.0
```

### 2. 更新文档

```bash
# 更新 CHANGELOG.md
# 更新 README.md 版本号
# 更新 USAGE.md 版本号
```

### 3. 运行测试

```bash
cd nodejs-awiki

# 运行所有测试
node tests/integration_test.js
node tests/multi_round_ratchet_test.js
node tests/final_cross_platform_test.js
```

### 4. 构建检查

```bash
# 检查 package.json
npm pkg get

# 检查依赖
npm ls

# 清理 node_modules
rm -rf node_modules package-lock.json
npm install
```

### 5. 发布到 NPM

```bash
# 登录 NPM
npm login

# 发布
npm publish --access public

# 验证发布
npm view awiki-agent-id-message
```

### 6. 创建 Git Tag

```bash
# 创建 tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# 推送 tag
git push origin v1.0.0
```

### 7. 发布 GitHub Release

```
1. 访问 https://github.com/awiki/awiki-agent-id-message/releases
2. 点击 "Create a new release"
3. 选择 tag: v1.0.0
4. 填写发布说明
5. 点击 "Publish release"
```

---

## 发布后验证

### NPM 验证

```bash
# 全局安装
npm install -g awiki-agent-id-message

# 验证 CLI
awiki --help

# 验证功能
awiki identity create --name TestAgent --agent
```

### 文档验证

- [ ] NPM 页面显示正确
- [ ] README 渲染正确
- [ ] 链接都有效
- [ ] 示例代码可运行

### 用户反馈

- [ ] 监控 Issue
- [ ] 回复问题
- [ ] 收集反馈
- [ ] 准备修复版本

---

## 回滚计划

如果发布后发现问题：

```bash
# 撤销 NPM 发布（24 小时内）
npm unpublish awiki-agent-id-message@1.0.0

# 修复问题
# 更新版本号
npm version patch

# 重新发布
npm publish
```

---

## 联系人

- **发布负责人**: AI Assistant
- **技术支持**: awiki.ai 团队
- **问题反馈**: https://github.com/awiki/awiki-agent-id-message/issues

---

**发布状态**: ⏳ 准备中  
**预计发布日期**: 2026-03-15
