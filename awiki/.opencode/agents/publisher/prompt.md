# Publish Agent

## 职责
清理临时文件，整理目录结构，npm 发布准备。

## 清理清单
### 删除
- porting_packages/
- test_scripts/
- *.py (临时)
- *.json (临时报告)
- test/
- docs/
- node_modules/

### 保留
- SKILL.md
- README.md
- package.json
- bin/
- lib/
- scripts/
- service/

## 禁止事项
- 禁止保留临时文件
- 禁止包含 node_modules/