to openclaw：
1. 访问 https://www.renwujidian.com/profile/sannomiya-tsubaki ，把2024年10月1日之前发行的番号提取出来，以json结构列出。
1. 以每个番号去https://cilisousuo.cc搜索，语法是（以番号ADN-597为例）：https://cilisousuo.cc/search?q=ADN-597 。
1. 进入第一个含有番号的搜索结果（URL开头为 https://cilisousuo.cc/magnet/ ），提取其中的磁链，显示出来。
1. 对每个番号完成第2、3步骤后，汇集所有收集到的磁链，以每行一个的格式列出。除了换行没有任何标点符号。

to opencode：
1. 访问 https://www.renwujidian.com/profile/sannomiya-tsubaki ，把2024年10月1日之前发行的番号提取出来，以json结构保存。
---
编写一个nodejs程序，需求是：
1. 读取本地 sannomiya_tsubaki_works.json 文件，对每个数据项的“番号”字段（以下成为“编号”）执行下面两步：
2. 以每个编号去https://cilisousuo.cc搜索，语法是（以编号ADN-597为例）：https://cilisousuo.cc/search?q=ADN-597 。
3. 进入第一个含有编号的搜索结果（URL开头为 https://cilisousuo.cc/magnet/ ），提取其中的磁链，显示出来。
    3.1. 含有编号的意思是搜索结果中明确包含编号。比如：“萌你一脸@第一会所@03月25日-精选高清有码三十二部合集”不包含编号“OFJE-456”、“[7E5A.CC]-小硬盘福音@ADN-597”含有编号“ADN-597”。
4. 对每个番号完成第2、3步骤后，汇集所有收集到的磁链，以每行一个的格式列出。除了换行没有任何标点符号。
---
1. 开发getcode.js,参数一是演员中文名，参数二是结束时间（可选，格式为yyyymmdd）。功能是：
    1. 根据参数一读取演员profile文件，命名规则是 profile\[演员中文名].yaml文件中(比如 profile\三宫椿.yaml )：
        1. 如果本地存在演员profile文件，则获得profile网页url。从profile网页中提取演员的元数据， 比对并更新演员profile文件。
        1. 如果本地不存在演员profiel文件，去 https://www.renwujidian.com 搜索，语法是（以演员三宫椿为例）：https://www.renwujidian.com/search/%E4%B8%89%E5%AE%AB%E6%A4%BF 。从搜索结果中选择第一个进入 https://www.renwujidian.com/profile/ 开头的页面（比如：https://www.renwujidian.com/profile/sannomiya-tsubaki ）。从profile网页中提取演员信息，创建演员profile文件并记录演员信息。profile网页的url也作为元数据记录下来。
    1. 如果有参数二，则从profile网页提取截止到参数二时间的作品番号，记录到演员profile文件。已经记录的番号，不要修改数据项。如果没有参数二，则只记录演员信息、不记录任何作品番号。
    1. 以上过程在命令行显示进度信息，最后列出这次执行新增和更新的信息。
1. get_magnets.js改名为getmagnet.js，参数是演员中文名。功能是按上面给出的步骤搜索演员profile中没有磁链的番号，把磁链写入演员profile文件。以上过程在命令行显示进度信息，最后（包括正常结束和异常退出）用tixati导入格式列出这次执行收集到的磁链：以每行一个的格式列出磁链，除了换行没有任何标点符号。
--- 
对以上工作，有什么优化建议吗？
几点优化建议：
1. 断点续传：getmagnet.js 运行时间长时可中断后继续，避免重复搜索
2. 搜索命中率：当前逻辑对部分番号匹配率低（如 OFJE-456），可尝试模糊匹配
3. 并行处理：可并行搜索多个番号（需控制并发数和延迟）
4. 日志记录：添加日志文件记录执行历史
5. 配置分离：超时、重试次数等参数可抽离到配置文件
6. 增量更新：getcode.js 只获取新增作品，避免重复抓取
---
1. 根据以上工作，整理一份需求和设计文档，用途是在其它计算机上输入给coding agent（比如claude code），开发相同功能的程序。保存为codingagent.md。
1. 根据以上工作，整理一份基于 [agentskills.io](https://agentskills.io/specification) 规范的Agent技能描述文档，用途是在没有本项目代码、没有开发环境的其他计算机上输入给通用agent（比如openclaw），然后用自然语言提示完成类似功能（不进行任何开发）。保存为skill.md。
1. 根据以上工作，整理一份提示词，用途是是在在没有本项目代码、没有开发环境的其他计算机上输入给通用agent（比如openclaw），完成类似功能（不进行任何开发）。保存为agent.md。