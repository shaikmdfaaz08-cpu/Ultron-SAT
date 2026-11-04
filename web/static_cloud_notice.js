(()=>{"use strict";
function ready(){
 const el=document.createElement("div");
 el.id="ultronCloudStatus";
 // Lightweight status toast: never competes with the bottom navigation on phones.
 el.style.cssText="position:fixed;right:12px;bottom:12px;z-index:999995;max-width:290px;padding:9px 12px;border:1px solid #447b9b;border-radius:10px;background:#0b2438ef;color:#e1f7ff;font:12px/1.4 system-ui;box-shadow:0 4px 18px #0007;pointer-events:none;transition:opacity .35s ease";
 const stylesheet=document.createElement("style");
 stylesheet.textContent="@media(max-width:768px){#ultronCloudStatus{top:calc(66px + env(safe-area-inset-top))!important;bottom:auto!important;left:12px!important;right:12px!important;max-width:none!important;padding:8px 11px!important;font-size:11px!important;box-sizing:border-box!important;}}";
 document.head.appendChild(stylesheet);
 el.textContent="Mission control online · Checking browser oil AI…";
 document.body.appendChild(el);
 const url=new URL("models/oil_sar_unet.onnx",document.baseURI);
 fetch(url,{method:"HEAD",cache:"no-store"}).then(r=>{
   if(!r.ok)throw Error("model not published");
   el.textContent="Mission control online · Browser oil AI available · ESP32 USB local";
 }).catch(()=>{
   el.textContent="Mission control online · Oil AI model publishing pending · ESP32 USB local";
 });
 // Status is informational; never leave a large floating overlay on the phone.
 setTimeout(()=>{if(el.isConnected){el.style.opacity="0";setTimeout(()=>el.remove(),450)}},7000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});else ready();
})();