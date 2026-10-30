const path=require('node:path'),crypto=require('node:crypto');
const {atomic,json}=require('./core.cjs');
class Strategies {
 constructor(home){this.home=home;this.file=path.join(home,'strategies.json');}
 list(){return json(this.file,[]);}
 ensure(state,chartId,bridgeDir){
  const source=state.sources?.find(s=>s.chart_id===String(chartId));if(!source)throw Error('请先选择已挂载指标的图表');
  const key=JSON.stringify([bridgeDir,state.account?.login,state.account?.server,source.symbol,source.timeframe]);
  const all=this.list();let item=all.find(s=>s.key===key);
  if(!item){item={id:crypto.createHash('sha256').update(key).digest('hex').slice(0,16),key,name:source.symbol+' · '+source.timeframe.replace('PERIOD_',''),symbol:source.symbol,timeframe:source.timeframe,riskPercent:1,skillIds:null};all.push(item);atomic(this.file,all);}
  return {...item,chartId:source.chart_id};
 }
 update(id,changes,availableSkills){
  const all=this.list(),item=all.find(s=>s.id===id);if(!item)throw Error('策略不存在');
  const {riskPercent,skillIds}=changes;
  if(riskPercent!==undefined){if(!Number.isFinite(riskPercent)||riskPercent<1||riskPercent>2)throw Error('单笔风险比例必须在1%–2%之间');item.riskPercent=riskPercent;}
  if(skillIds!==undefined){if(skillIds!==null&&(!Array.isArray(skillIds)||skillIds.some(id=>!availableSkills.some(s=>s.id===id&&!s.error))))throw Error('技能选择无效');item.skillIds=skillIds===null?null:[...new Set(skillIds)];}
  atomic(this.file,all);return item;
 }
 history(strategy){return json(path.join(this.home,'strategy-chats',strategy.id+'.json'),[]);}
 saveHistory(strategy,history){atomic(path.join(this.home,'strategy-chats',strategy.id+'.json'),history);}
 scope(state,selection,bridgeDir){
  if(typeof selection==='string'||!selection){const target=selection?this.ensure(state,selection,bridgeDir):null;return {multi:false,targets:target?[target]:[],historyKey:target,totalRiskPercent:target?.riskPercent||0};}
  if(selection.mode!=='multi'||!Array.isArray(selection.chart_ids)||selection.chart_ids.length<1||selection.chart_ids.length>8||selection.chart_ids.some(id=>typeof id!=='string'||!/^\d{1,24}$/.test(id)))throw Error('联合分析需明确勾选1至8个周期图表');
  const targets=[...new Set(selection.chart_ids)].map(id=>this.ensure(state,id,bridgeDir));
  if(new Set(targets.map(t=>t.id)).size!==targets.length)throw Error('同品种同周期只保留一个图表，避免重复策略');
  const key=targets.map(t=>t.id).sort().join(',');
  return {multi:true,targets,historyKey:{id:'batch-'+crypto.createHash('sha256').update(key).digest('hex').slice(0,16)},totalRiskPercent:targets.reduce((n,t)=>n+t.riskPercent,0)};
 }
 annotate(state,submitted,results){
  const byId=new Map(this.list().map(s=>[s.id,s])),receipts=new Map(results.map(r=>[r.id,r]));
  const orderMap=new Map(),positionMap=new Map(),commentMap=new Map();
  for(const c of submitted){const r=receipts.get(c.id);if(!c.strategy_id||(c.account&&c.account!==state.account?.login)||(c.server&&c.server!==state.account?.server))continue;const info={strategy_id:c.strategy_id,strategy_name:c.strategy_name||byId.get(c.strategy_id)?.name||c.strategy_id,strategy_timeframe:c.timeframe};if(r?.order&&r.order!=='0')orderMap.set(String(r.order),info);commentMap.set(c.id.slice(0,12),info);}
  const commentInfo=r=>{const tag=String(r.comment||'').split(':').pop();return commentMap.get(tag);};
  for(const d of state.deals||[]){const info=orderMap.get(String(d.order))||commentInfo(d);if(info&&d.position_id){const key=String(d.position_id),prev=positionMap.get(key);if(prev&&prev.strategy_id!==info.strategy_id){positionMap.set(key,{strategy_name:'多策略合并持仓',strategy_ids:[...new Set([...(prev.strategy_ids||[prev.strategy_id]),info.strategy_id])]});}else positionMap.set(key,info);}}
  const decorate=(r,kind)=>({...r,...((kind==='positions'?positionMap.get(String(r.identifier)):null)||orderMap.get(String(kind==='deals'?r.order:r.ticket))||commentInfo(r)||{strategy_name:'其他 / 旧版订单'})});
  return {...state,orders:(state.orders||[]).map(r=>decorate(r,'orders')),positions:(state.positions||[]).map(r=>decorate(r,'positions')),deals:(state.deals||[]).map(r=>decorate(r,'deals'))};
 }
}
module.exports={Strategies};
