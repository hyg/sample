## 通用入口页面

修改本文件必须经过用户同意。

### 数据结构

#### SOP

- Standard Operating Procedure | 标准作业程序
- 用有限状态机FSM表达：
- SOP:{s0,S,E,A,F,D}
    - s0:初始状态，{S}中的一个成员。
    - S:状态集合。每个成员是一个状态state。
        - state:状态,string
    - E:事件集合。每个成员是一个事件event。
        - event:事件，string
    - A:行为集合。每个成员是一个行为集合actionset。
        - actionset:行为集合。每个成员是一个行为action。
            - action:
                - role:角色，string
                - task:任务，string
                - param:可选参数，any
    - F:
    - D:数据

#### protocol

- 协议、契约
- 用责权利表达
    - listen：责任，事件（event）发生后必须启动的工作。
        - action：单人任务
        - SOP+role：标准作业程序+角色
    - emit：权力，发出一个事件。可以在自己认为需要时行使权力。
    - interest：利益。
        - data+function：由数据加公式（函数）定义。可以和任何层级的数据绑定，从单张工单到整个共同体的结算案。

### 页面
