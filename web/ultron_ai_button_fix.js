(()=>{'use strict';
/* Make the original mission-control Run AI model button use the trained, public
   browser ONNX detector instead of POST /analyze to a static Pages server. */
function clearOldError(){
 document.querySelectorAll('body *').forEach(el=>{
  if(el.children.length===0 && el.textContent && /Backend returned HTTP 405|Backend returned HTTP 404/i.test(el.textContent)){
   el.textContent='Browser oil detection is available. Use Run AI model to analyze directly on this device.';
  }
 });
}
function selectedImage(){
 for(const e of document.querySelectorAll('input[type="file"]')){
  const f=e.files?.[0];
  if(f && /^image\//.test(f.type))return f;
 }
 return null;
}
document.addEventListener('click',event=>{
 const btn=event.target?.closest?.('button, input[type="button"], [role="button"]');
 if(!btn)return;
 const label=(btn.textContent||btn.value||'').replace(/\s+/g,' ').trim();
 if(!/^Run AI model$/i.test(label))return;
 const launcher=document.getElementById('ultronAiLaunch');
 if(!launcher)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 launcher.click();
 const file=selectedImage();
 if(file){
  const panel=document.getElementById('ultronBrowserAI');
  const picker=panel?.querySelector('input[type="file"]');
  if(picker && typeof DataTransfer!=='undefined'){
   try{const dt=new DataTransfer();dt.items.add(file);picker.files=dt.files;picker.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
  }
 }
 clearOldError();
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clearOldError,{once:true});else clearOldError();
})();