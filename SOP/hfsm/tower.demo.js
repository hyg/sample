// tower-demo.js
const { buildTowerSOP } = require('./tower');

const sopDef = {
  name: '原料放行-3层',
  phases: [
    {
      name: 'Phase-1-取样',
      tasks: [
        { code: 'A', role: 'QA', maxRetry: 1 },
        { code: 'B', role: 'QC', maxRetry: 1 }
      ],
      edges: [
        { from: 'A', to: 'B', guard: d => d.ok, action: () => console.log('取样→封样') }
      ]
    },
    {
      name: 'Phase-2-检验',
      tasks: [
        { code: 'C', role: 'Lab', maxRetry: 2 },
        { code: 'D', role: 'Micro', maxRetry: 2 }
      ],
      edges: []
    },
    {
      name: 'Phase-3-放行',
      tasks: [{ code: 'E', role: 'QP', maxRetry: 1 }],
      edges: []
    }
  ]
};

const inst = buildTowerSOP(sopDef, 'RM20250923002');

/* 模拟员工干活 */
setTimeout(() => inst.completeTask('Phase-1-取样', 'A', true), 500);
setTimeout(() => inst.completeTask('Phase-1-取样', 'B', true), 1000);
setTimeout(() => inst.completeTask('Phase-2-检验', 'C', true), 1500);
setTimeout(() => inst.completeTask('Phase-2-检验', 'D', true), 1800);
setTimeout(() => inst.completeTask('Phase-3-放行', 'E', true), 2500);

/* 每 300ms 打印一次全景 */
const t = setInterval(() => {
  console.log('--- 全景 ---');
  sopDef.phases.forEach((ph) => {               // ← ph 就是阶段对象
    const phMachine = inst.states.get(ph.name);
    ph.tasks.forEach((t) => {                   // ← 改成 ph.tasks
      const taskMachine = phMachine.states.get(t.code);
      console.log(`${ph.name}.${t.code} = ${taskMachine.current.name}`);
    });
  });
}, 300);

setTimeout(() => { clearInterval(t); console.log('🏁 全部完成'); }, 3000);