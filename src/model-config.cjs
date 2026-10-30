const {PRESETS,resolveEndpoint,checkedURL}=require('./providers.cjs');
const preset=id=>{const p=PRESETS.find(p=>p.id===id);if(!p)throw Error('未知服务商');return p;};
function defaults(id){const {baseUrl,model,protocol}=preset(id);return {baseUrl,model,protocol,thinking:'auto',maxTokens:16384};}
function normalizeSettings(raw,commonRoot){
 if(raw.schema===2){preset(raw.activeProvider);return raw;}
 const oldUrl=raw.baseUrl||'https://api.openai.com/v1';let id=raw.provider;try{const host=checkedURL(oldUrl).hostname;if(!id)id=host==='api.deepseek.com'?'deepseek':host==='api.anthropic.com'?'anthropic':host==='api.openai.com'?'openai':host==='api.x.ai'?'xai':host==='www.jblanked.com'?'jblanked':host==='127.0.0.1'&&oldUrl.includes('15721')?'ccswitch':'custom';}catch{id='custom';}
 return {schema:2,activeProvider:id,commonRoot:raw.commonRoot||commonRoot,bridgeId:raw.bridgeId||'default',profiles:{[id]:{...defaults(id),baseUrl:oldUrl,model:raw.model||'',protocol:raw.protocol||'auto',...(raw.key?{key:raw.key,keyOrigin:checkedURL(oldUrl).origin}:{})}}};
}
function selected(settings,id=settings.activeProvider){return {...defaults(id),...settings.profiles[id],provider:id};}
function exposed(settings){const profiles={};for(const p of PRESETS){const {key,keyOrigin,...c}=selected(settings,p.id);profiles[p.id]={...c,hasKey:!!key};}return {...profiles[settings.activeProvider],profiles,activeProvider:settings.activeProvider,commonRoot:settings.commonRoot,bridgeId:settings.bridgeId};}
function updateSettings(settings,value,encryptedKey){
 const id=value.provider||settings.activeProvider,old=selected(settings,id),baseUrl=value.baseUrl.trim();preset(id);resolveEndpoint(baseUrl,value.protocol||'auto');
 if(!value.model?.trim()&&id!=='local')throw Error('请填写模型名称');
 if(!['auto','none','low','medium','high','max'].includes(value.thinking||'auto'))throw Error('思考级别无效');
 const maxTokens=Number(value.maxTokens||16384);if(!Number.isInteger(maxTokens)||maxTokens<1024||maxTokens>131072)throw Error('最大输出须在 1024～131072 之间');
 const origin=checkedURL(baseUrl).origin;
 const key=value.clearKey?undefined:encryptedKey||(old.keyOrigin===origin?old.key:undefined);
 return {...settings,activeProvider:id,commonRoot:value.commonRoot,bridgeId:value.bridgeId,profiles:{...settings.profiles,[id]:{baseUrl,model:value.model.trim(),protocol:value.protocol||'auto',thinking:value.thinking||'auto',maxTokens,key,keyOrigin:key?origin:undefined}}};
}
module.exports={defaults,normalizeSettings,selected,exposed,updateSettings};
