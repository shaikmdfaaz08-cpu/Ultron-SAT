(()=>{'use strict';
const STORAGE='ultron_ai_backend_https';
const endpoints=/^\/(?:health|analyze|remask|rgb\/health|rgb\/analyze)(?:\?|$)/;
let origin='';
try{origin=localStorage.getItem(STORAGE)||''}catch{}
const nativeFetch=window.fetch.bind(window);
window.fetch=function(resource,init){
  if(!origin)return nativeFetch(resource,init);
  let url=typeof resource==='string'?resource:resource instanceof URL?resource.href:resource?.url;
  try{
    const u=new URL(url,location.href);
    if(u.origin===location.origin && endpoints.test(u.pathname)){
      const remote=origin+u.pathname+u.search;
      if(typeof resource==='string'||resource instanceof URL)return nativeFetch(remote,init);
      return nativeFetch(new Request(remote,resource),init);
    }
  }catch{}
  return nativeFetch(resource,init);
};
function init(){
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:12px;bottom:12px;z-index:999999;display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:#0b2438ef;color:#e1f7ff;padding:7px 9px;border:1px solid #477c9c;border-radius:11px;font:12px system-ui;max-width:330px';
  const b=document.createElement('button');
  b.textContent='Connect AI backend';b.type='button';
  b.style.cssText='border:1px solid #77b7d4;background:#144967;color:white;padding:7px 9px;border-radius:7px;cursor:pointer;font:inherit';
  const state=document.createElement('span');state.textContent=origin?'AI endpoint configured':'AI offline · USB telemetry available';
  b.addEventListener('click',()=>{
    const input=window.prompt('Enter your HTTPS AI server URL (e.g. https://example.trycloudflare.com). Leave blank to disconnect.',origin);
    if(input===null)return;
    const v=input.trim().replace(/\/$/,'');
    if(v){
      try{let u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error();
      }catch{alert('Enter an HTTPS origin only, without a path, query, or password.');return}
    }
    try{if(v)localStorage.setItem(STORAGE,v);else localStorage.removeItem(STORAGE)}catch{}
    origin=v;state.textContent=v?'AI endpoint configured':'AI offline · USB telemetry available';
    if(v)nativeFetch(v+'/health',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(x=>state.textContent=x.model_loaded?'AI connected · model ready':x.model_loading?'AI connected · model loading':'AI backend online · model unavailable').catch(e=>state.textContent='AI connection failed: '+e.message);
  });
  wrap.id='ultronRemoteAiControls';
  // Browser ONNX AI works independently; keep the optional remote-backend control
  // on desktop while removing its oversized floating toolbar from phone layouts.
  const style=document.createElement('style');
  style.textContent='@media(max-width:768px){#ultronRemoteAiControls{display:none!important}}';
  document.head.append(style);
  wrap.append(b,state);document.body.append(wrap);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();