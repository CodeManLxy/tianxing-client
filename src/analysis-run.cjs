const crypto=require('node:crypto');
const labels={submitted:'等待EA接收',processing:'EA处理中',accepted:'券商已接受',rejected:'已拒绝',unconfirmed:'结果未确认'};
class AnalysisRun {
 constructor(scope,execution,state,noExecution=false){this.id=crypto.randomUUID();this.scope=scope;this.execution=execution;this.contexts=new Map(scope.targets.map(strategy=>[strategy.chartId,{chartId:strategy.chartId,strategy,noExecution,initialAccount:state.account?.login,initialServer:state.account?.server,initialSession:state.session,analysisId:this.id,batchScopeId:scope.multi?scope.historyKey.id:undefined}]));this.errors=new Map();}
 target(chartId){const target=this.scope.targets.find(t=>t.chartId===String(chartId));if(!target)throw Error('图表不在本轮勾选范围内，禁止提交');return target;}
 async place(args,signal){const target=this.target(args.chart_id),context=this.contexts.get(target.chartId);try{return await this.execution.place(args,context,signal);}catch(e){this.errors.set(target.chartId,e.message);throw e;}}
 submitted(){return [...this.contexts.values()].filter(c=>c.autoSubmitted).map(c=>({target:c.strategy,id:c.autoSubmitted}));}
 summary(){return this.scope.targets.map(target=>{const c=this.contexts.get(target.chartId),result=c.autoSubmitted?this.execution.result(c.autoSubmitted):null;return {chart_id:target.chartId,strategy:target.name,risk_percent:target.riskPercent,command_id:c.autoSubmitted||null,...(result||{status:'not_submitted',message:this.errors.get(target.chartId)||'本轮未向该周期提交订单；详见分析中的等待原因。'})};});}
 report(){const clean=s=>String(s??'—').replace(/[|\r\n]/g,' ');const rows=this.summary();return '\n\n**实际执行回执（客户端）**\n\n| 周期策略 | 状态 | 指令 / 订单 | 说明 |\n|---|---|---|---|\n'+rows.map(r=>'| '+[r.strategy,labels[r.status]||'未提交',(r.command_id||'—')+' / '+(r.order&&r.order!=='0'?r.order:'—'),r.message].map(clean).join(' | ')+' |').join('\n')+'\n\n已发送不等于已成交。各周期分别处理；已发送指令不因其他周期等待或失败而自动撤销。';}
}
module.exports={AnalysisRun};
