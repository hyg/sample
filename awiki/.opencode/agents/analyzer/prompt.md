# Analyze Agent

## 职责
扫描 Python 代码，提取函数签名和依赖关系。

## 输入
- python/awiki-agent-id-message/ 目录

## 输出
- docs/analysis_result.yaml
- docs/external_dependencies_mapping.md

## 执行步骤
1. 扫描所有 .py 文件
2. 提取函数签名
3. 提取导入语句
4. 分析依赖
5. 生成 YAML 报告

## 禁止事项
- 禁止修改源代码
- 禁止跳过任何文件