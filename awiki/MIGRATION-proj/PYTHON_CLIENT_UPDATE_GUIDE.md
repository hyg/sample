# Python 客户端更新指南

**最后更新**: 2026-03-08

---

## 更新源

Python 客户端代码有两个更新源：

### 1. 官方 ZIP 下载

**URL**: http://awiki.info/static-files/awiki-agent-id-message.zip

**优点**:
- 官方发布
- 包含完整的源代码
- 适合手动更新

**更新步骤**:
```bash
# 1. 备份当前版本
cd awiki/python-client
cp -r scripts scripts.backup
cp -r anp_src anp_src.backup

# 2. 下载新版本
cd /tmp
curl -O http://awiki.info/static-files/awiki-agent-id-message.zip
unzip awiki-agent-id-message.zip

# 3. 对比差异
diff -ruN awiki-agent-id-message/scripts awiki/python-client/scripts > changes.diff

# 4. 更新
cp -r awiki-agent-id-message/scripts/* awiki/python-client/scripts/
cp -r awiki-agent-id-message/anp_src/* awiki/python-client/anp_src/

# 5. 验证更新
cd awiki/MIGRATION-proj/python-work/tests
python test_vectors.py ../../../python-client/scripts/
```

---

### 2. GitHub 仓库

**URL**: https://github.com/AgentConnect/awiki-agent-id-message

**优点**:
- 可以查看提交历史
- 可以对比具体变更
- 适合自动化更新

**更新步骤**:
```bash
# 1. 克隆或更新仓库
cd /tmp
git clone https://github.com/AgentConnect/awiki-agent-id-message.git
# 或
cd awiki-agent-id-message
git pull

# 2. 对比差异
diff -ruN awiki-agent-id-message/scripts awiki/python-client/scripts > changes.diff

# 3. 更新
cp -r awiki-agent-id-message/scripts/* awiki/python-client/scripts/
cp -r awiki-agent-id-message/anp_src/* awiki/python-client/anp_src/

# 4. 验证更新
cd awiki/MIGRATION-proj/python-work/tests
python test_vectors.py ../../../python-client/scripts/
```

---

## 自动化更新脚本

### 从 ZIP 更新

创建脚本 `MIGRATION-proj/tools/update_from_zip.sh`:

```bash
#!/bin/bash
# update_from_zip.sh - Update python-client from ZIP

set -e

BACKUP_DIR="/tmp/awiki-backup-$(date +%Y%m%d)"
DOWNLOAD_DIR="/tmp/awiki-download"

echo "=== Updating Python Client from ZIP ==="

# Create backup
echo "Creating backup..."
mkdir -p "$BACKUP_DIR"
cp -r awiki/python-client/scripts "$BACKUP_DIR/"
cp -r awiki/python-client/anp_src "$BACKUP_DIR/"

# Download and extract
echo "Downloading..."
mkdir -p "$DOWNLOAD_DIR"
cd "$DOWNLOAD_DIR"
curl -O http://awiki.info/static-files/awiki-agent-id-message.zip
unzip -o awiki-agent-id-message.zip

# Update
echo "Updating..."
cp -r "$DOWNLOAD_DIR/awiki-agent-id-message/scripts"/* awiki/python-client/scripts/
cp -r "$DOWNLOAD_DIR/awiki-agent-id-message/anp_src"/* awiki/python-client/anp_src/

# Generate diff
echo "Generating diff..."
diff -ruN "$BACKUP_DIR/scripts" awiki/python-client/scripts > \
  awiki/MIGRATION-proj/python-work/patches/python_update_$(date +%Y%m%d).diff || true

echo "=== Update Complete ==="
echo "Backup: $BACKUP_DIR"
echo "Diff: awiki/MIGRATION-proj/python-work/patches/python_update_$(date +%Y%m%d).diff"
```

### 从 GitHub 更新

创建脚本 `MIGRATION-proj/tools/update_from_github.sh`:

```bash
#!/bin/bash
# update_from_github.sh - Update python-client from GitHub

set -e

BACKUP_DIR="/tmp/awiki-backup-$(date +%Y%m%d)"
REPO_DIR="/tmp/awiki-agent-id-message"

echo "=== Updating Python Client from GitHub ==="

# Create backup
echo "Creating backup..."
mkdir -p "$BACKUP_DIR"
cp -r awiki/python-client/scripts "$BACKUP_DIR/"
cp -r awiki/python-client/anp_src "$BACKUP_DIR/"

# Clone or pull
echo "Cloning/Pulling..."
if [ -d "$REPO_DIR/.git" ]; then
    cd "$REPO_DIR"
    git pull
else
    git clone https://github.com/AgentConnect/awiki-agent-id-message.git "$REPO_DIR"
fi

# Update
echo "Updating..."
cp -r "$REPO_DIR/scripts"/* awiki/python-client/scripts/
cp -r "$REPO_DIR/anp_src"/* awiki/python-client/anp_src/

# Generate diff
echo "Generating diff..."
diff -ruN "$BACKUP_DIR/scripts" awiki/python-client/scripts > \
  awiki/MIGRATION-proj/python-work/patches/python_update_$(date +%Y%m%d).diff || true

echo "=== Update Complete ==="
echo "Backup: $BACKUP_DIR"
echo "Diff: awiki/MIGRATION-proj/python-work/patches/python_update_$(date +%Y%m%d).diff"
```

---

## 更新后验证

### 1. 运行测试向量

```bash
cd awiki/MIGRATION-proj/python-work/tests
python test_vectors.py ../../../python-client/scripts/
```

### 2. 对比 API

```bash
cd awiki/MIGRATION-proj
node tools/compare_python_nodejs.js \
  --python ../python-client/scripts \
  --nodejs ../nodejs-client/src \
  --output docs/comparison_$(date +%Y%m%d).md
```

### 3. 检查许可证

确认 Python 项目的许可证信息：

```bash
# 检查 LICENSE 文件
cat awiki/python-client/LICENSE

# 检查 setup.py 或 pyproject.toml
cat awiki/python-client/setup.py | grep -i license
# 或
cat awiki/python-client/pyproject.toml | grep -i license
```

---

## 许可证信息

### Python 项目许可证

**License**: Apache License 2.0

**来源**:
- GitHub: https://github.com/AgentConnect/awiki-agent-id-message
- 描述: "Apache License 2.0. See LICENSE for details."

**兼容性**:
- ✅ 与 MIT License 兼容
- ✅ 允许衍生作品
- ✅ 允许商业使用
- ⚠️ 需要保留版权声明和许可证文本
- ⚠️ 需要说明修改

### Node.js 项目许可证

**License**: MIT License

**理由**:
1. 与 Apache 2.0 兼容
2. 适合个人维护
3. 条款简单清晰

**义务**:
- ✅ 保留原始版权声明
- ✅ 包含 Apache 2.0 许可证副本（在 NOTICE.md 中）
- ✅ 说明是衍生作品
- ✅ 说明修改

---

## 更新频率建议

### 定期检查

- **每周**: 检查 GitHub 仓库更新
- **每月**: 检查 ZIP 文件更新
- **按需**: 当 Node.js 版本需要新功能时

### 更新策略

1. **小更新** (bug 修复)
   - 直接同步
   - 运行测试验证
   - 更新 Node.js 文档

2. **大更新** (新功能)
   - 分析变更
   - 在 python-work 中实验
   - 生成迁移计划
   - 更新 Node.js 实现

3. **破坏性更新** (API 变更)
   - 详细分析变更
   - 评估影响
   - 决定是否需要更新 Node.js
   - 可能保持旧版本兼容

---

## 故障排除

### 问题 1: ZIP 文件下载失败

**解决**:
```bash
# 使用备用源
wget https://github.com/AgentConnect/awiki-agent-id-message/archive/refs/heads/main.zip
```

### 问题 2: GitHub 仓库访问慢

**解决**:
```bash
# 使用镜像
git clone https://ghproxy.com/https://github.com/AgentConnect/awiki-agent-id-message.git
```

### 问题 3: 更新后测试失败

**解决**:
```bash
# 1. 回滚到备份
cd awiki/python-client
rm -rf scripts anp_src
cp -r /tmp/awiki-backup-YYYYMMDD/scripts .
cp -r /tmp/awiki-backup-YYYYMMDD/anp_src .

# 2. 分析失败原因
cd awiki/MIGRATION-proj/python-work/analysis
python analyze_changes.py

# 3. 决定下一步
# - 如果是小问题，修复 Node.js 实现
# - 如果是大变更，评估是否需要跟进
```

---

## 记录更新

每次更新后，在 `MIGRATION-proj/docs/PYTHON_VERSION_HISTORY.md` 记录：

```markdown
## Python Version History

### 2026-03-08
- Source: GitHub (https://github.com/AgentConnect/awiki-agent-id-message)
- Commit: abc1234
- Changes: Bug fixes in E2EE module
- Action: Synced to Node.js
- Tested: ✓ PASS

### 2026-03-01
- Source: ZIP (http://awiki.info/static-files/awiki-agent-id-message.zip)
- Changes: Initial version
- Action: Created Node.js implementation
- Tested: ✓ PASS
```

---

## 联系和支持

- **Python 项目 Issues**: https://github.com/AgentConnect/awiki-agent-id-message/issues
- **Node.js 项目 Issues**: [你的 GitHub 仓库 issues]

---

**最后更新**: 2026-03-08  
**维护者**: [Your Name]
