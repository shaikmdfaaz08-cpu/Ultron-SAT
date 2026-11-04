(()=>{"use strict";
function ready(){
 const el=document.createElement("div");el.id="ultronCloudStatus";
 el.style.cssText="position:fixed;right:12px;bottom:12px;z-index:999999;max-width:290px;padding:9px 12px;border:1px solid #447b9b;border-radius:10px;background:#0b2438ef;color:#e1f7ff;font:12px system-ui;box-shadow:0 4px 18px #0007";
 el.textContent="Mission control online · Checking browser oil AI…";
 document.body.appendChild(el);
 const url=new URL("models/oil_sar_unet.onnx",document.baseURI);
 fetch(url,{method:"HEAD",cache:"no-store"}).then(r=>{
  if(!r.ok)throw Error("model not published");
  el.textContent="Mission control online · Browser oil AI available · ESP32 USB local";
 }).catch(()=>{
  el.textContent="Mission control online · Oil AI model publishing pending · ESP32 USB local";
 });
 setTimeout(()=>{if(el.isConnected)el.style.opacity=".55"},13000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});else ready();
})();