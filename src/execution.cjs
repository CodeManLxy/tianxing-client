const {atomic,json}=require('./core.cjs');
const {prepareRiskOrder}=require('./risk.cjs');
const path=require('node:path');
const {Receipts}=require('./receipts.cjs');
const AI_ORDER_TOOL={type:'function',function:{name:'place_limit_order',description:'开关允许时，按真实有效OB或FVG和账户风险提交限价挂单；两者都须分析后选优。提供zone_type及对应ob_index或fvg_index；手数和预算由客户端计算。返回回执，不将已发送冒充已成交。',parameters:{type:'object',properties:{chart_id:{type:'string'},snapshot_id:{type:'string'},zone_type:{type:'string',enum:['OB','FVG']},ob_index:{type:'integer',minimum:0},fvg_index:{type:'integer',minimum:0},type:{type:'string',enum:['BUY_LIMIT','SELL_LIMIT']},price:{type:'number'},sl:{type:'number'},tp:{type:'number'},reason:{type:'string'}},required:['chart_id','snapshot_id','type','price','sl','tp','reason'],additionalProperties:false}}};
const RESULT_TOOL={type:'function',function:{name:'get_command_result',description:'查询本客户端交易指令回执，区分发送、EA处理、券商接受、拒绝及未确认；不会重发。',parameters:{type:'object',properties:{id:{type:'string'}},required:['id']}}};
const fingerprint=a=>JSON.stringify(Object.fromEntries(['symbol','type','ticket','volume','price','sl','tp'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]])));
class Execution {
 constructor(home,getBridge){this.home=home;this.getBridge=getBridge;this.receipts=new Receipts(home,getBridge,()=>this.saved());}
 saved(){return json(path.join(this.home,'submitted.json'),[]);}
 policy(){return {enabled:false,riskPercent:1,...json(path.join(this.home,'execution.json'),{})};}
 setPolicy(enabled,riskPercent){
  if(typeof enabled!=='boolean')throw Error('开关状态无效');
  if(!enabled&&!(typeof riskPercent==='number'&&Number.isFinite(riskPercent)&&riskPercent>=1&&riskPercent<=2))riskPercent=this.policy().riskPercent||1;
  if(typeof riskPercent!=='number'||!Number.isFinite(riskPercent)||riskPercent<1||riskPercent>2){if(enabled)throw Error('风险比例无效（允许1%–2%）');riskPercent=1;}
  const b=this.getBridge(),s=enabled?b.requireLive():b.state();const policy={enabled,riskPercent,account:s.account?.login,server:s.account?.server,bridgeDir:b.dir};
  atomic(path.join(this.home,'execution.json'),policy);return this.status();
 }
 status(){
  const p=this.policy(),b=this.getBridge(),s=b.state();const bound=p.account===s.account?.login&&p.server===s.account?.server&&p.bridgeDir===b.dir;
  const ready=s.bridge_online&&s.connected,protocol=s.command_protocol==='json_multiline_v2';
  const reason=!p.enabled?'开关关闭':!ready?'MT5离线':!bound?'账户或通信目录已改变，需重新开启':!protocol?'请更新并重新挂载通信EA 2.50':!s.trading_allowed?'EA或终端未允许交易':'AI可直接提交限价挂单';
  return {enabled:p.enabled,risk_percent:p.riskPercent,account:p.account,server:p.server,ai_direct_execution:!!(p.enabled&&bound&&ready&&protocol&&s.trading_allowed),execution_status:reason,scope:'place_limit_order',per_analysis_limit:1};
 }
 result(id){
  const cmd=this.saved().find(c=>c.id===id);if(!cmd)throw Error('未找到本客户端指令');return this.receipts.results([cmd])[0];
 }
 commit(action,args,meta={},expected){
  const b=this.getBridge(),s=b.requireLive();if(expected&&(s.account.login!==expected.account.login||s.account.server!==expected.account.server||s.session!==expected.session))throw Error('账户或EA会话已改变，请重新分析');
  if(action==='place')args=prepareRiskOrder(s,args);
  const saved=this.saved(),receipts=new Map(this.receipts.results(saved).map(r=>[r.id,r]));const sameAccount=c=>c.account===s.account.login&&c.server===s.account.server&&(!c.bridge_dir||c.bridge_dir===b.dir);
  if(saved.some(c=>sameAccount(c)&&c.session===s.session&&c.action===action&&(!meta.strategy_id||!c.strategy_id||meta.strategy_id===c.strategy_id)&&fingerprint(c.args)===fingerprint(args)&&Date.now()/1000-c.created_utc<60))throw Error('相同策略指令刚刚提交过，60秒内不重复发送');
  if(meta.origin==='ai'){
   if(!this.status().ai_direct_execution)throw Error('AI直接挂单已禁用：'+this.status().execution_status);
   if(saved.some(c=>sameAccount(c)&&['submitted','processing','unconfirmed'].includes(receipts.get(c.id).status)))throw Error('已有未确认指令，先查看回执和MT5实际订单，不重复提交');
   if(saved.some(c=>sameAccount(c)&&((meta.zone_key&&c.zone_key===meta.zone_key)||(meta.ob_key&&c.ob_key===meta.ob_key))&&receipts.get(c.id).status!=='rejected'))throw Error('此OB/FVG已有提交记录，不重复挂单');
  }
  this.receipts.clear(null,meta.analysis_id||null);
  const cmd={...b.command(action,args),...meta,bridge_dir:b.dir};atomic(path.join(this.home,'submitted.json'),[cmd,...saved].slice(0,500));return cmd;
 }
 async place(args,context,signal){
  if(signal?.aborted)throw Error('分析已停止');if(context.noExecution)throw Error('本轮消息要求仅分析或不下单，禁止执行');if(context.autoSubmitted)throw Error('每次分析最多直接提交一笔新挂单');
  const permission=this.status();if(!permission.ai_direct_execution)throw Error('AI直接挂单未允许：'+permission.execution_status);
  if(context.chartId&&String(context.chartId)!==String(args.chart_id))throw Error('自动挂单图表与当前选择不一致');
  const b=this.getBridge(),state=b.requireLive();if(context.initialAccount&&(context.initialAccount!==state.account.login||context.initialServer!==state.account.server||context.initialSession!==state.session))throw Error('分析期间账户或EA会话已改变，请重新分析');const snapshot=b.snapshot(args.chart_id);
  if(snapshot.snapshot_id!==args.snapshot_id)throw Error('快照已更新，请重新读取OB/FVG后分析');
  if(snapshot.analysis_ready!==true||snapshot.market_evidence_stale!==false)throw Error('指标证据未就绪或已过期');
  const zoneType=args.zone_type||(args.fvg_index!==undefined&&args.ob_index===undefined?'FVG':'OB');if(!['OB','FVG'].includes(zoneType))throw Error('区域类型只能是OB或FVG');
  const index=zoneType==='FVG'?args.fvg_index:args.ob_index;if(!Number.isInteger(index)||index<0)throw Error(zoneType+'下标无效');
  const ob=(zoneType==='FVG'?snapshot.fair_value_gaps:snapshot.order_blocks)?.[index];
  if(!ob||ob.mitigated!==false||!['fresh','tested'].includes(ob.status))throw Error(zoneType+'不存在、状态不明或已失效/完全回补');
  if(typeof ob.bullish!=='boolean'||!Number.isFinite(ob.top)||!Number.isFinite(ob.bottom)||ob.top<=ob.bottom)throw Error(zoneType+'边界或方向无效');
  if((ob.bullish?'BUY_LIMIT':'SELL_LIMIT')!==args.type)throw Error('挂单方向与'+zoneType+'不符');
  const symbol=state.symbols?.find(s=>s.symbol===snapshot.symbol),tick=symbol?.tick_size;if(!Number.isFinite(tick)||tick<=0)throw Error('缺少合约跳动参数');
  for(const k of ['price','sl','tp'])if(typeof args[k]!=='number'||!Number.isFinite(args[k])||args[k]<=0)throw Error('交易价格无效');
  const round=(v,up)=>Number(((up?Math.ceil(v/tick-1e-8):Math.floor(v/tick+1e-8))*tick).toFixed(10));
  const price=round(args.price,!ob.bullish),sl=round(args.sl,!ob.bullish),tp=round(args.tp,!ob.bullish);
  if(price<ob.bottom||price>ob.top)throw Error(zoneType+'挂单价格必须位于所选'+zoneType+'区域内');
  if(ob.bullish?sl>ob.bottom-tick+1e-8:sl<ob.top+tick-1e-8)throw Error('止损必须在'+zoneType+'失效边界外，至少留一个最小跳动');
  if(ob.bullish?price>=symbol.ask:price<=symbol.bid)throw Error('限价挂单已越过当前报价，不自动追价');
  if(typeof args.reason!=='string'||args.reason.trim().length<4)throw Error('请提供OB/FVG有效性、入场选择与目标依据');
  const zoneKey=JSON.stringify([zoneType,snapshot.symbol,snapshot.timeframe,ob.timeframe,ob.time||ob.source_time||ob.bar_index,ob.confirmed_at,ob.top,ob.bottom,ob.bullish,ob.internal]);
  const key=zoneType==='OB'?JSON.stringify([args.chart_id,ob.internal,ob.bullish,ob.bar_index,ob.confirmed_at,ob.top,ob.bottom]):undefined;
  const strategy=context.strategy;if(strategy&&(strategy.symbol!==snapshot.symbol||strategy.timeframe!==snapshot.timeframe))throw Error('指标周期与当前策略不一致');
  const percent=strategy?.riskPercent??permission.risk_percent;
  const cmd=this.commit('place',{symbol:snapshot.symbol,type:args.type,price,sl,tp,risk_percent:percent,...(strategy?{strategy_id:strategy.id,strategy_timeframe:strategy.timeframe}: {})},{origin:'ai',ob_key:key,zone_key:zoneKey,zone_type:zoneType,zone_index:index,zone_timeframe:ob.timeframe||snapshot.timeframe,reason:args.reason.slice(0,2000),chart_id:args.chart_id,snapshot_id:args.snapshot_id,...(strategy?{strategy_id:strategy.id,strategy_name:strategy.name,timeframe:strategy.timeframe}: {}),...(context.analysisId?{analysis_id:context.analysisId}:{}),...(context.batchScopeId?{batch_scope_id:context.batchScopeId}:{})},state);
  context.autoSubmitted=cmd.id;
  const until=Date.now()+8000;let result;
  do{result=this.result(cmd.id);if(['accepted','rejected','unconfirmed'].includes(result.status))break;if(signal?.aborted)break;await new Promise(r=>setTimeout(r,200));}while(Date.now()<until);
  return {command_id:cmd.id,order_parameters:cmd.args,...result,reminder:result.status==='accepted'?'券商已接受，请结合订单编号与持仓确认最终状态':'已提交不等于已成交；禁止自动重发'};
 }
}
module.exports={Execution,AI_ORDER_TOOL,RESULT_TOOL};
