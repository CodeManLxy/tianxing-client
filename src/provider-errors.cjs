function redact(value,secret=''){
 let text=String(value||'');if(secret)text=text.split(secret).join('[密钥已隐藏]');
 return text.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi,'Bearer [密钥已隐藏]').replace(/\bsk-[A-Za-z0-9_-]{8,}/g,'[密钥已隐藏]').replace(/((?:api[_-]?key|authorization|password|access_token)\s*[=:]\s*["']?)[^\s"',;]+/gi,'$1[已隐藏]').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,1200);
}
function providerError(status,protocol,raw,cfg={}){
 let data;try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch{}
 const err=data?.error;let detail=typeof err==='string'?err:err?.message||data?.message||data?.detail||'';
 const code=err?.code||err?.type;const param=err?.param;
 if(!detail&&typeof raw==='string'&&!/<(?:!doctype|html|head|body)\b/i.test(raw))detail=raw;
 let message=`API HTTP ${status}（${protocol}）`;
 if(detail)message+='\n'+redact(typeof detail==='string'?detail:JSON.stringify(detail),cfg.apiKey);
 if(code)message+='\n错误类型：'+redact(code,cfg.apiKey);if(param)message+='；参数：'+redact(param,cfg.apiKey);
 if(status===400&&/model.*(?:not|invalid|unknown|exist)|(?:invalid|unknown).*model/i.test(String(detail)+' '+String(code))){
   message+='\n请核对模型的 API ID，而非网页展示名称。';
   if(cfg.provider==='deepseek')message+='DeepSeek Flash 请填写 deepseek-flash。';
 }else if(status===401||status===403)message+='\n请检查当前服务商的密钥和模型访问权限。';
 else if(status===429)message+='\n请检查服务商的请求频率或额度限制。';
 else if(!detail)message+='\n服务商未返回可读错误详情，请检查接口地址与服务状态。';
 return message;
}
async function readErrorBody(response){
 if(!response.body?.getReader)return '';const reader=response.body.getReader();const chunks=[];let bytes=0;
 try{while(bytes<16384){const {value,done}=await reader.read();if(done)break;const slice=value.subarray(0,16384-bytes);chunks.push(Buffer.from(slice));bytes+=slice.length;}if(bytes>=16384)await reader.cancel();}finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
module.exports={providerError,readErrorBody,redact};
