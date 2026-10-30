const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ID = /^[a-zA-Z0-9_-]{1,64}$/;
function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, typeof value === 'string' ? value : JSON.stringify(value,null,2), 'utf8');
  for(let attempt=0;;attempt++){try{fs.renameSync(tmp,file);break;}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||attempt===7){fs.rmSync(tmp,{force:true});throw e;}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10*(attempt+1));}}
}
function json(file, fallback) { try { return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')); } catch(e) { if (fallback !== undefined) return fallback; throw e; } }
function copyTree(source,destination){const s=path.resolve(source),d=path.resolve(destination);if(d===s||d.startsWith(s+path.sep))throw Error('复制目标不能位于源目录内');const walk=(from,to)=>{const st=fs.lstatSync(from);if(st.isSymbolicLink())throw Error('不复制符号链接');if(st.isDirectory()){fs.mkdirSync(to,{recursive:true});for(const name of fs.readdirSync(from))walk(path.join(from,name),path.join(to,name));}else{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}};walk(s,d);}
function safe(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || /[:\\]/.test(rel)) throw Error('文件路径无效');
  const target = path.resolve(root,rel); const base = path.resolve(root);
  if (!target.startsWith(base + path.sep)) throw Error('文件必须位于技能目录内');
  let cur=target; while(cur !== base) { if(fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) throw Error('不支持符号链接'); cur=path.dirname(cur); }
  return target;
}
class Skills {
  constructor(root) { this.root=root; fs.mkdirSync(root,{recursive:true}); }
  location(id, resource='SKILL.md') { if(!ID.test(id)) throw Error('技能 ID 仅支持字母、数字、横线和下划线'); return safe(this.root,`${id}/${resource}`); }
  read(id,resource='SKILL.md') { if(!/\.(md|txt|json)$/i.test(resource)) throw Error('只读取 md、txt、json 文件'); const p=this.location(id,resource); if(fs.statSync(p).size>256*1024) throw Error('单个技能文件不能超过 256 KB'); const b=fs.readFileSync(p); return b[0]===255 && b[1]===254 ? b.subarray(2).toString('utf16le') : b.toString('utf8').replace(/^\uFEFF/,''); }
  list() { const cfg=json(path.join(this.root,'enabled.json'),{}); return fs.readdirSync(this.root,{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('_')&&ID.test(d.name)).map(d=>{try{const content=this.read(d.name); return {id:d.name,description:content.match(/^description:\s*(.*)$/m)?.[1]||'',enabled:cfg[d.name]===true,content};}catch(e){return {id:d.name,error:e.message,enabled:false};}}); }
  save(id,content) { if(typeof content!=='string'||Buffer.byteLength(content)>256*1024) throw Error('技能内容过长'); atomic(this.location(id),content); }
  toggle(id,enabled) { this.read(id); const file=path.join(this.root,'enabled.json'); const cfg=json(file,{}); cfg[id]=!!enabled; atomic(file,cfg); }
  remove(id) { const p=path.dirname(this.location(id)); if(!fs.existsSync(p)) return; const trash=path.join(this.root,'_trash'); fs.mkdirSync(trash,{recursive:true}); fs.renameSync(p,path.join(trash,id+'-'+Date.now())); }
  resources(id) {const root=path.dirname(this.location(id)); const out=[]; const walk=(dir,prefix='')=>{for(const d of fs.readdirSync(dir,{withFileTypes:true})){if(d.isSymbolicLink())continue; const r=prefix+d.name; if(d.isDirectory())walk(path.join(dir,d.name),r+'/');else if(/\.(md|txt|json)$/i.test(d.name))out.push(r);}};walk(root);return out;}
}
class Bridge {
  constructor(root,id='default') {if(!ID.test(id))throw Error('通信名称格式无效');this.dir=path.join(root,'TXJ_Client',id);}
  state() { const s=json(path.join(this.dir,'state.json'),{}); const age=Date.now()/1000-(s.published_utc||0); return {...s,bridge_online:s.schema==='txj.client.state.v1'&&age>=-3&&age<30,sync_delayed:age>=5,age_seconds:age}; }
  diagnostics(){const s=this.state(),parent=path.dirname(this.dir),now=Date.now()/1000;const candidates=fs.existsSync(parent)?fs.readdirSync(parent,{withFileTypes:true}).filter(d=>d.isDirectory()&&ID.test(d.name)).map(d=>{const v=json(path.join(parent,d.name,'state.json'),{});return {bridge_id:d.name,age_seconds:now-(v.published_utc||0),connected:!!v.connected,bridge_version:v.bridge_version};}).filter(v=>v.age_seconds>=-3&&v.age_seconds<60):[];return {directory:this.dir,state_present:!!s.schema,age_seconds:s.published_utc?s.age_seconds:null,bridge_online:s.bridge_online,connected:!!s.connected,bridge_version:s.bridge_version,publish_duration_ms:s.publish_duration_ms,candidates,setup:'同一终端只挂一个通信EA；M5/M15/H1各开一个图表并挂SMC指标，客户端与EA通信名称一致。'};}
  requireLive() {const s=this.state();if(!s.bridge_online||!s.connected)throw Error('MT5 未连接或数据已过期，请检查通信 EA');return s;}
  snapshot(id) { const s=this.requireLive();const c=s.sources?.find(x=>x.chart_id===String(id));if(!c||!c.bridge_ready)throw Error(c?.error||'未找到可读的 SMC 图表');const data=json(safe(this.dir,`snapshots/${id}.json`));if(data.snapshot_id!==c.snapshot_id||data.chart_id!==String(id))throw Error('指标刚刚重算，请重新读取');if(Date.now()/1000-(data.relay_utc||0)>10)throw Error('指标转发已过期');return data; }
  command(action,args) { const s=this.requireLive();if(!s.trading_allowed)throw Error('EA 当前为只读模式，请在 EA 参数中允许交易并开启 MT5 算法交易');const id=crypto.randomUUID();const cmd={schema:'txj.client.command.v1',id,session:s.session,account:s.account.login,server:s.account.server,created_utc:Math.floor(Date.now()/1000),expires_utc:Math.floor(Date.now()/1000)+30,action,args};atomic(path.join(this.dir,'inbox',id+'.json'),JSON.stringify(cmd));return cmd; }
  receipt(cmd) {
    if(!/^[a-f0-9-]{36}$/.test(cmd.id))throw Error('指令ID无效');
    const dir=cmd.bridge_dir||this.dir;const out=json(path.join(dir,'outbox',cmd.id+'.json'),null),journal=json(path.join(dir,'journal',cmd.id+'.json'),null);
    const result=out||journal,age=Date.now()/1000-cmd.created_utc;
    if(result&&['accepted','rejected','unconfirmed'].includes(result.status))return {...result,age_seconds:age};
    const status=age>35?'unconfirmed':result?'processing':'submitted';
    const message=age>35?'指令已超过有效期且无最终回执，请回查MT5；不要重发。请确认通信EA已更新。':result?'EA正在处理，尚未确认券商结果':age>6?'EA尚未返回接收确认，请检查通信EA版本及日志':'已写入通信队列，等待EA接收';
    return {id:cmd.id,status,message,age_seconds:age,ea_received:!!journal,expires_utc:cmd.expires_utc};
  }
  results() { const dir=path.join(this.dir,'outbox');if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(n=>json(path.join(dir,n),null)).filter(Boolean).sort((a,b)=>b.completed_utc-a.completed_utc).slice(0,100); }
}
const {endpoint,completion}=require('./providers.cjs');
const {POLICY,riskBudget,estimateTradeRisk}=require('./risk.cjs');
const tool = (name,description,properties={})=>({type:'function',function:{name,description,parameters:{type:'object',properties}}});
const TOOLS=[tool('estimate_trade_risk','按真实账户净值及合约估算单笔风险和建议手数；默认1%，可选1–2%；只读不下单',{chart_id:{type:'string',description:'联合分析时必填，要估算的目标周期图表'},symbol:{type:'string'},type:{type:'string',enum:['BUY_LIMIT','SELL_LIMIT']},price:{type:'number'},sl:{type:'number'},risk_percent:{type:'number',minimum:1,maximum:2}}),tool('list_smc_sources','列出实际挂载 SMC 指标的图表'),tool('get_smc_data','读取真实 SMC 快照；数组分页，后续页必须带 snapshot_id',{chart_id:{type:'string'},section:{type:'string'},offset:{type:'integer'},limit:{type:'integer'},snapshot_id:{type:'string'}}),...['get_account_info','get_terminal_info','get_chart_info','get_server_time','get_orders','get_positions','get_history'].map(n=>tool(n,'读取 MT5 当前数据')),tool('get_symbol_info','读取已打开图表品种的合约和报价',{symbol:{type:'string'}}),tool('list_local_skills','列出本地技能及参考文件'),tool('read_local_skill','读取已启用的本地技能或参考文件',{skill_id:{type:'string'},resource:{type:'string'}})];
function readTool(name,a,bridge,skills) {
  if(name==='list_local_skills')return skills.list().map(x=>({id:x.id,enabled:x.enabled,description:x.description,resources:x.error?[]:skills.resources(x.id)}));
  if(name==='read_local_skill'){if(!skills.list().some(x=>x.id===a.skill_id&&x.enabled))throw Error('技能未启用');return skills.read(a.skill_id,a.resource||'SKILL.md');}
  if(name==='get_terminal_info'){const s=bridge.state();return {connected:!!s.connected,bridge_online:s.bridge_online,trading_allowed:!!s.trading_allowed,session:s.session,heartbeat_age_seconds:s.age_seconds,publish_duration_ms:s.publish_duration_ms,diagnostics:bridge.diagnostics(),client_execution_interface:'trade_form_then_native_confirmation_then_bridge_EA',client_has_execution_interface:true,bridge_version:s.bridge_version||'2.00',command_protocol:s.command_protocol||'legacy',ai_direct_execution:false,execution_status:!s.bridge_online||!s.connected?'offline':s.trading_allowed?'awaiting_user_confirmation':'read_only'};}
  const s=bridge.requireLive();
  if(name==='estimate_trade_risk')return estimateTradeRisk(s,a);
  if(name==='list_smc_sources')return s.sources;
  if(name==='get_smc_data') {const id=String(a.chart_id||s.chart_id);const d=bridge.snapshot(id);if(a.snapshot_id&&a.snapshot_id!==d.snapshot_id)throw Error('SNAPSHOT_CHANGED');const section=a.section||'summary';const arrays=['structure_breaks','order_blocks','fair_value_gaps','swing_pivots','internal_pivots','equal_levels','liquidity_sweeps','targets','trend_timeline','candles','objects'];const out=Object.fromEntries(Object.entries(d).filter(([k])=>!arrays.includes(k)&&k!=='settings'));out.counts=Object.fromEntries(arrays.map(k=>[k,(d[k]||[]).length]));if(section==='settings'||section==='all')out.settings=d.settings;if(section!=='summary'&&section!=='settings'&&section!=='all'&&!arrays.includes(section))throw Error('未知 section');let offset=a.offset||0,limit=a.limit||100;if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>200)throw Error('分页范围无效');if(offset&&!a.snapshot_id)throw Error('SNAPSHOT_ID_REQUIRED');out.pages={};for(const k of arrays.filter(k=>section==='all'||k===section)){const rows=d[k]||[];out[k]=rows.slice(offset,offset+limit);out.pages[k]={total:rows.length,next_offset:Math.min(offset+limit,rows.length),has_more:offset+limit<rows.length};}return out;}
  if(name==='get_account_info')return {...s.account,risk_policy:POLICY,default_risk_budget:Number.isFinite(s.account?.equity)&&s.account.equity>0?riskBudget(s.account):null};
  if(name==='get_chart_info')return {chart_id:s.chart_id,sources:s.sources,symbols:s.symbols};
  if(name==='get_server_time')return {server_time:s.server_time,published_utc:s.published_utc};
  if(name==='get_orders')return s.orders;
  if(name==='get_positions')return s.positions;
  if(name==='get_history')return {deals:s.deals,from:s.history_from,truncated:s.history_truncated};
  if(name==='get_symbol_info'){const v=s.symbols?.find(x=>x.symbol===a.symbol);if(!v)throw Error('品种未在 MT5 图表打开');return v;}
  throw Error('不支持的工具；模型无交易执行权限');
}
module.exports={atomic,json,copyTree,safe,Skills,Bridge,endpoint,TOOLS,readTool,completion};
