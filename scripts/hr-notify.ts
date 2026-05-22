import { sendMessage } from '../src/notify/feishu.js';

const msg = [
  'HR-001 系统就绪检查报告',
  '',
  '在职 Agent：10/19',
  '  [策略] AGT-001~005 到位',
  '  [审核] RAG-001~005 到位',
  '',
  '缺失 9 Agent（profile 已就绪，待入职）：',
  '  策略: AGT-006(价格异动) AGT-007(均线交叉)',
  '  审核: RAG-006(均线交叉审核)',
  '  舆情: SENT-001  |  数据: DAT-001',
  '  选举: ELC-001  |  执行: EXE-001',
  '  HR: HR-001     |  广告: ADV-001',
  '',
  '部门表：完全为空（8 部门待初始化）',
  '',
  '整体状态：半就绪，需补全入职 + 部门初始化',
].join('\n');

sendMessage(msg).then((id) => {
  if (id) process.stdout.write('OK:' + id);
  else process.stdout.write('FAIL');
}).catch((e: any) => process.stdout.write('ERR:' + e.message));
