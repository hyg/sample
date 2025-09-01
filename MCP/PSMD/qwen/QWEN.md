## Qwen Added Memories
- 用户项目是开发一个名为PSMD.MCP的MCP（Model Context Protocol）服务，用于分析公司章程（章程）并识别不同类型的条款。
- PSMD.MCP需要以stdio模式运行，为coding agent提供服务。
- PSMD.MCP的核心功能是接收coding agent传来的章程JSON数据，分析并识别三种条款类型：决策条款（可修订其它条款、任免人员）、非决策条款（不可修订其它条款、不可任免人员）、独立条款（修订程序不明确）。并对缺失部分进行补齐。
- PSMD.MCP需要内置一个数据集，用于比对和补齐章程中缺失的条款。
