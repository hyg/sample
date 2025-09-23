// demo.js
const { buildSOP } = require('./sop');

// 1. SOP 模板定义（阶段+任务+依赖）
const sopDef = {
  sopId: 'RM-FP-001',
  name: '原料放行',
  nodes: [
    { code: 'A', role: 'QA',       seq: 1, group: 1 },
    { code: 'B', role: 'Lab',      seq: 2, group: 1 },
    { code: 'C', role: 'MicroLab', seq: 3, group: 1 },
    { code: 'D', role: 'DocCtrl',  seq: 1, group: 2 },
    { code: 'E', role: 'Prod',     seq: 1, group: 2 },
    { code: 'F', role: 'QP',       seq: 1, group: 3 }
  ],
  deps: {          // 后置 → 前置列表
    B: ['A'],
    C: ['B'],
    D: [],
    E: [],
    F: ['C', 'D', 'E']
  }
};

// 2. 实例化状态机
const fsMachine = buildSOP(sopDef, 'RM20250923001');

// 3. 模拟员工干活
setTimeout(() => fsMachine.completeTask('A'), 1000);   // QA 取样
setTimeout(() => fsMachine.completeTask('B'), 2000);   // 理化
setTimeout(() => fsMachine.completeTask('D'), 1500);   // 文件并行
setTimeout(() => fsMachine.completeTask('E'), 3000);   // 巡检并行
setTimeout(() => fsMachine.completeTask('C'), 4000);   // 微生物
setTimeout(() => fsMachine.completeTask('F'), 5000);   // QP 放行

// 4. 每 500ms 画一次当前状态
const timer = setInterval(() => {
  fsMachine.update();
  const vars = fsMachine.data.vars;
  console.log('【状态快照】', vars);
  if (vars.F === 'OK') {
    console.log('🎉 SOP 全部完成！');
    clearInterval(timer);
  }
}, 500);