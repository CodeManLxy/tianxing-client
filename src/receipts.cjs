const path=require('node:path');
const {atomic,json}=require('./core.cjs');
class Receipts {
 constructor(home,getBridge,getCommands){this.home=home;this.getBridge=getBridge;this.getCommands=getCommands;}
 visible(){const hidden=json(path.join(this.home,'receipt-visibility.json'),{});return this.getCommands().filter(c=>!hidden[c.id]);}
 clear(id=null,keepAnalysisId=null){
  const all=this.getCommands();if(id&&!all.some(c=>c.id===id))throw Error('未找到该指令回执');
  const file=path.join(this.home,'receipt-visibility.json'),hidden=json(file,{});let count=0;
  for(const c of all)if((!id||c.id===id)&&(!keepAnalysisId||c.analysis_id!==keepAnalysisId)){if(!hidden[c.id])count++;hidden[c.id]=true;}
  const kept=new Set(all.map(c=>c.id));atomic(file,Object.fromEntries(Object.entries(hidden).filter(([key])=>kept.has(key))));return {removed:count,message:'已删除回执显示；未撤单，内部执行记录保留用于防重复。'};
 }
 results(commands=this.getCommands()){
  const b=this.getBridge(),state=b.state(),file=path.join(this.home,'receipt-reconciliation.json'),overrides=json(file,{});let changed=false;
  const rows=commands.map(c=>{
   const raw=b.receipt(c);if(['accepted','rejected'].includes(raw.status))return raw;if(overrides[c.id]?.status==='accepted')return overrides[c.id];
   const sameAccount=c.account===state.account?.login&&c.server===state.account?.server&&(!c.bridge_dir||c.bridge_dir===b.dir);
   const expires=Number(c.expires_utc)||Number(c.created_utc)+30;
   const settled=sameAccount&&state.bridge_online&&state.connected&&Number.isFinite(expires)&&Date.now()/1000>expires+5&&state.published_utc>expires+5;
   if(settled){
    const prefix=c.id.slice(0,12),match=r=>{const comment=String(r.comment||'');return comment==='TXJ:'+prefix||comment.startsWith('TXJ:')&&comment.split(':').pop().startsWith(prefix);};
    const order=c.action==='place'&&(state.orders||[]).find(match),position=c.action==='place'&&(state.positions||[]).find(match),deal=c.action==='place'&&(state.deals||[]).find(match),actual=order||position||deal;
    const result=actual?{id:c.id,status:'accepted',order:order?.ticket||deal?.order||position?.ticket,deal:deal?.ticket,message:'已从MT5实际'+(order?'挂单':position?'持仓':'成交')+'记录匹配该指令；请以终端实际状态为准。',source:'client_reconciliation'}:{id:c.id,status:'expired',message:'指令已过期，当前EA心跳已越过有效期，旧指令不再阻塞新分析；历史执行结果仍需以MT5核对，不重发原指令。',source:'client_reconciliation',historical_result_unknown:true};
    if(!overrides[c.id]||overrides[c.id].status!==result.status){overrides[c.id]={...result,completed_utc:Math.floor(Date.now()/1000)};changed=true;}
   }
   return overrides[c.id]||raw;
  });
  if(changed)atomic(file,overrides);return rows;
 }
}
module.exports={Receipts};
