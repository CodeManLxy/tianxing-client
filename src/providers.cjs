// All seven provider entries from the original llm.mqh, plus compatible services.
const PRESETS = [
 {id:'openai',label:'OpenAI',baseUrl:'https://api.openai.com/v1/responses',protocol:'responses',model:'',models:['gpt-6-luna','gpt-5.5','gpt-5.4'],note:'支持 Responses 与 Chat Completions；填写账户可用的模型。'},
 {id:'deepseek',label:'DeepSeek',baseUrl:'https://api.deepseek.com',protocol:'chat',model:'deepseek-flash',models:['deepseek-flash','deepseek-v4-pro'],note:'DeepSeek 官方接口，保留工具调用中的 reasoning_content。'},
 {id:'anthropic',label:'Anthropic / Claude',baseUrl:'https://api.anthropic.com/v1/messages',protocol:'messages',model:'claude-opus-5-5',models:['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-4-5-20251001'],note:'原生 Claude Messages；支持思考签名与多工具结果回传。'},
 {id:'local',label:'Local / Ollama / LM Studio',baseUrl:'http://127.0.0.1:8080/v1/chat/completions',protocol:'chat',model:'',models:['qwen3.8:27b','qwen3.5:9b','llama3.2:3b'],note:'兼容服务；Ollama 通常使用端口 11434，LM Studio 通常为 1234。模型须支持工具调用。允许无密钥。'},
 {id:'xai',label:'xAI / Grok',baseUrl:'https://api.x.ai/v1/chat/completions',protocol:'chat',model:'',models:['grok-4.7','grok-4.6','grok-4.5'],note:'保留原版 xAI 入口，填写账户支持的模型名称。'},
 {id:'jblanked',label:'JBlanked',baseUrl:'https://www.jblanked.com/ai/v1/chat/completions',protocol:'chat',model:'',models:[],note:'保留原版 JBlanked 接口，模型名称以供应商提供的为准。'},
 {id:'ccswitch',label:'CC Switch / 原版代理',baseUrl:'http://127.0.0.1:15721/v1/messages',protocol:'auto',model:'claude-opus-5-5',models:['claude-opus-5-5','gpt-6-sol','gpt-6-astra'],note:'与原版一致：Claude 用 /v1/messages；Codex 路由用 /v1/responses。填写完整地址，代理须先启动。允许无密钥。'},
 {id:'gemini',label:'Google Gemini（兼容接口）',baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',protocol:'chat',model:'',models:['gemini-3.8-flash'],note:'使用 Gemini 官方 OpenAI 兼容入口。'},
 {id:'custom',label:'其他 / 自定义服务',baseUrl:'',protocol:'auto',model:'',models:[],note:'可接入 OpenRouter、通义千问、硅基流动等兼容服务；按服务商要求填写完整地址和模型 ID。'}
];
const PROTOCOLS=['auto','chat','messages','responses'];
function checkedURL(base){let u;try{u=new URL(base);}catch{throw Error('API 地址格式不正确');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('API 地址格式不正确');if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('远程 API 必须使用 HTTPS');return u;}
function resolveEndpoint(base,protocol='auto'){
 const u=checkedURL(base);let p=u.pathname.replace(/\/+$/,'');const suffix=p.endsWith('/chat/completions')?'chat':p.endsWith('/messages')?'messages':p.endsWith('/responses')?'responses':null;
 if(!PROTOCOLS.includes(protocol))throw Error('不支持的 API 协议');
 if(protocol!=='auto'&&suffix&&protocol!==suffix)throw Error('所选协议与接口地址不一致，请修改协议或 URL');
 const selected=protocol==='auto'?(suffix||'chat'):protocol;
 if(!suffix){if(!p&&selected!=='chat')p='/v1';p+={chat:'/chat/completions',messages:'/messages',responses:'/responses'}[selected];}
 u.pathname=p;return {url:u.href,protocol:selected};
}
function endpoint(base){return resolveEndpoint(base).url;}
function isLocal(base){return ['localhost','127.0.0.1','[::1]'].includes(checkedURL(base).hostname);}
function parseArguments(s){let a;try{a=typeof s==='string'?JSON.parse(s):s;}catch{throw Error('模型返回了不完整的工具参数，本轮已停止');}if(!a||Array.isArray(a)||typeof a!=='object')throw Error('模型工具参数必须是 JSON 对象');return JSON.stringify(a);}
function call(id,name,args){if(!id||!name)throw Error('模型工具调用缺少 ID 或名称');return {id,type:'function',function:{name,arguments:parseArguments(args)}};}
function toolsSchema(tools){return tools?.map(t=>({...t.function.parameters,additionalProperties:false}));}
function buildRequest(cfg,messages,tools){
 const target=resolveEndpoint(cfg.baseUrl,cfg.protocol||'auto'),headers={'Content-Type':'application/json'};
 if(cfg.apiKey){if(target.protocol==='messages')headers['x-api-key']=cfg.apiKey;else headers.Authorization='Bearer '+cfg.apiKey;}
 let body={model:cfg.model,stream:false};const thinking=cfg.thinking||'auto';const max=Number(cfg.maxTokens||16384);
 if(target.protocol==='messages'){
   headers['anthropic-version']='2023-06-01';body.max_tokens=max;body.system=messages.filter(m=>['system','developer'].includes(m.role)).map(m=>m.content).join('\n\n');body.messages=[];
   const append=(role,content)=>{if(!content.length)return;const prev=body.messages.at(-1);if(prev?.role===role)prev.content.push(...content);else body.messages.push({role,content});};
   for(const m of messages){if(['system','developer'].includes(m.role))continue;if(m.role==='tool'){let failed=false;try{failed=!!JSON.parse(m.content).error;}catch{}append('user',[{type:'tool_result',tool_use_id:m.tool_call_id,content:m.content,...(failed?{is_error:true}:{})}]);continue;}
     const content=m.anthropic_content?structuredClone(m.anthropic_content):[...(m.content?[{type:'text',text:m.content}]:[]),...(m.tool_calls||[]).map(t=>({type:'tool_use',id:t.id,name:t.function.name,input:JSON.parse(parseArguments(t.function.arguments))}))];append(m.role,content);
   }
   if(tools?.length){body.tools=tools.map((t,i)=>({name:t.function.name,description:t.function.description,input_schema:toolsSchema(tools)[i]}));body.tool_choice={type:'auto'};}
   if(thinking==='none')body.thinking={type:'disabled'};
   else if(thinking!=='auto'){
     const legacy=/claude-(?:3|haiku-4-5|sonnet-4-5|opus-4-1)/.test(cfg.model);
     if(legacy){const budget={low:1024,medium:2048,high:4096,max:8192}[thinking];body.thinking={type:'enabled',budget_tokens:budget};body.max_tokens=Math.max(max,budget+1024);}
     else {body.thinking={type:'adaptive'};body.output_config={effort:thinking==='max'&&!cfg.model.includes('opus')?'high':thinking};}
   }
 }else if(target.protocol==='responses'){
   body.store=false;body.include=['reasoning.encrypted_content'];body.max_output_tokens=max;body.input=[];
   for(const m of messages){if(m.response_items){body.input.push(...structuredClone(m.response_items));continue;}if(m.role==='tool'){body.input.push({type:'function_call_output',call_id:m.tool_call_id,output:m.content});continue;}if(m.content)body.input.push({role:m.role,content:m.content});for(const t of m.tool_calls||[])body.input.push({type:'function_call',call_id:t.id,name:t.function.name,arguments:parseArguments(t.function.arguments)});}
   if(tools?.length){body.tools=tools.map(t=>({type:'function',name:t.function.name,description:t.function.description,parameters:t.function.parameters,strict:false}));body.tool_choice='auto';}
   if(thinking!=='auto')body.reasoning={effort:thinking};
 }else{
   // Preserve provider-specific thought signatures / reasoning_content in chat messages.
   body.messages=messages.map(({anthropic_content,response_items,...m})=>m);
   if(tools?.length){body.tools=tools;body.tool_choice='auto';}
   if(cfg.provider==='deepseek'||checkedURL(cfg.baseUrl).hostname==='api.deepseek.com'){
     body.max_tokens=max;if(thinking==='none')body.thinking={type:'disabled'};else if(thinking!=='auto'){body.thinking={type:'enabled'};body.reasoning_effort=thinking==='medium'?'high':thinking;}
   }else if(thinking!=='auto')body.reasoning_effort=thinking;
 }
 return {...target,headers,body};
}
function decode(protocol,data){
 if(data.error)throw Error('模型服务返回错误，请检查配置或服务商状态');
 let m;
 if(protocol==='messages'){
   if(data.stop_reason==='max_tokens')throw Error('模型输出达到长度上限；请增加最大输出或缩小分析范围');
   if(!Array.isArray(data.content))throw Error('Claude 未返回有效的 content');
   m={role:'assistant',content:data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n'),anthropic_content:data.content,tool_calls:data.content.filter(b=>b.type==='tool_use').map(b=>call(b.id,b.name,b.input))};
 }else if(protocol==='responses'){
   if(data.status&&data.status!=='completed')throw Error('Responses 未完成：'+String(data.status));
   if(!Array.isArray(data.output))throw Error('Responses 未返回有效的 output');
   m={role:'assistant',content:data.output.filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text'||x.type==='refusal').map(x=>x.text||x.refusal).join('\n'),response_items:data.output,tool_calls:data.output.filter(x=>x.type==='function_call').map(x=>call(x.call_id,x.name,x.arguments))};
 }else{
   const c=data.choices?.[0];if(c?.finish_reason==='length')throw Error('模型输出被截断；请缩小分析范围后重试');if(!c?.message)throw Error('API 未返回兼容的聊天内容');
   m={...c.message,role:'assistant'};if(m.tool_calls){const ids=new Set();for(const t of m.tool_calls){call(t.id,t.function?.name,t.function?.arguments);if(ids.has(t.id))throw Error('模型返回重复工具 ID');ids.add(t.id);}}
 }
 if(!m.content&&!m.tool_calls?.length)throw Error('模型没有返回文字或工具调用');
 const ids=new Set();for(const t of m.tool_calls||[]){if(ids.has(t.id))throw Error('模型返回重复工具 ID');ids.add(t.id);}return m;
}
async function completion(cfg,messages,tools,signal){const req=buildRequest(cfg,messages,tools);const r=await fetch(req.url,{method:'POST',redirect:'error',signal,headers:req.headers,body:JSON.stringify(req.body)});const {providerError,readErrorBody}=require('./provider-errors.cjs');if(!r.ok)throw Error(providerError(r.status,req.protocol,await readErrorBody(r),cfg));let data;try{data=await r.json();}catch{throw Error('模型服务未返回有效 JSON，请检查接口地址和代理状态');}if(data.error)throw Error(providerError(r.status,req.protocol,data,cfg));return decode(req.protocol,data);}
module.exports={PRESETS,PROTOCOLS,checkedURL,resolveEndpoint,endpoint,isLocal,buildRequest,decode,completion};
