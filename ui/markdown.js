/* Markdown content is untrusted model output. Raw HTML stays text; links require a click. */
(() => {
  const md = window.markdownit({html:false,breaks:true,linkify:true,typographer:false});
  md.renderer.rules.image = (tokens,index) => md.utils.escapeHtml('[图片：'+(tokens[index].content||'未加载')+']');
  const allowedTags=['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','s','del','blockquote','ul','ol','li','pre','code','a','table','thead','tbody','tr','th','td'];
  function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
  async function invoke(method,value,button){const original=button?.textContent;try{const r=await window.txj.call(method,value);if(!r.ok)throw Error(r.error);if(button){button.textContent='已复制';setTimeout(()=>{if(button.isConnected)button.textContent=original;},1200);}}catch(e){const area=document.getElementById('notice');area.hidden=false;area.classList.add('error');area.textContent=e.message;}}
  function renderInto(target,source){
    const html=md.render(source);
    target.innerHTML=window.DOMPurify.sanitize(html,{ALLOWED_TAGS:allowedTags,ALLOWED_ATTR:['href','title','class','start'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
    for(const a of target.querySelectorAll('a')){
      let url;try{url=new URL(a.getAttribute('href'));}catch{}
      if(!url||!['https:','http:'].includes(url.protocol)||url.username||url.password){a.replaceWith(node('span',a.textContent));continue;}
      a.title=url.href;a.rel='noopener noreferrer';a.addEventListener('click',e=>{e.preventDefault();invoke('openLink',url.href);});a.addEventListener('auxclick',e=>e.preventDefault());
    }
    for(const pre of target.querySelectorAll('pre')){
      const code=pre.querySelector('code');if(!code)continue;const block=node('div',undefined,'code-block'),bar=node('div',undefined,'code-toolbar');
      const language=code.className.match(/language-([a-zA-Z0-9_+-]+)/)?.[1]||'代码';const button=node('button','复制代码','quiet');button.type='button';button.addEventListener('click',()=>invoke('copyText',code.textContent,button));bar.append(node('span',language),button);pre.replaceWith(block);block.append(bar,pre);
    }
    for(const table of target.querySelectorAll('table')){const wrap=node('div',undefined,'markdown-table');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','分析表格，可横向滚动');table.replaceWith(wrap);wrap.append(table);}
  }
  window.TXJMarkdown={renderInto,copy:(text,button)=>invoke('copyText',text,button)};
})();
