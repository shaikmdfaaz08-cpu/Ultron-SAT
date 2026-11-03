(function(){
"use strict";
function ready(){
 // Rename only rendered UI text, never raw HTML, scripts, 3D code or shaders.
 try{
   const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   const edits=[];
   while(walk.nextNode()){
     const node=walk.currentNode, parent=node.parentElement;
     if(parent && !parent.closest('script,style,svg,canvas,textarea,code,pre') && /arducam/i.test(node.nodeValue||'')) edits.push(node);
   }
   edits.forEach(node=>{node.nodeValue=node.nodeValue.replace(/arducam/gi,'ESP32 Cam')});
   document.querySelectorAll('[title],[alt],[aria-label]').forEach(el=>{
     for(const attr of ['title','alt','aria-label']){
       const value=el.getAttribute(attr);
       if(value && /arducam/i.test(value))el.setAttribute(attr,value.replace(/arducam/gi,'ESP32 Cam'));
     }
   });
 }catch(e){console.warn('ESP32 camera label update skipped',e)}
 const detect=document.getElementById("detect"), stage=document.getElementById("stage"), canvas=document.getElementById("map"), slider=document.getElementById("ath"), value=document.getElementById("athV");
 if(!detect||!stage||!canvas||!slider||document.getElementById("ultronDetectionTools"))return;
 const css=document.createElement("style");css.textContent=`
 #ultronDetectionTools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:13px 0 9px;padding:12px 14px;border:1px solid rgba(113,216,239,.28);border-radius:16px;background:rgba(12,31,51,.85);color:#d5f3ff}
 #ultronDetectionTools label{display:flex;gap:7px;align-items:center;margin:0;flex-wrap:wrap}
 #ultronDetectionTools button{background:#18334b;color:#eafaff;border:1px solid #4b7791;border-radius:12px;padding:9px 12px;font:inherit;font-size:13px;cursor:pointer}
 #ultronDetectionTools button.active{background:linear-gradient(110deg,#32cad1,#559afe);color:#06182c;border-color:transparent;font-weight:700}
 #ultronDetectionTools .hint{font-size:12px;color:#acd0e1;line-height:1.5;flex-basis:100%}
 #ultronDetectionTools input[type=range]{width:100px;accent-color:#47dae1}
 #stage{touch-action:pan-y}
 #stage canvas#map{transition:transform .28s ease;transform-origin:center;will-change:transform}
 @media(max-width:740px){#ultronDetectionTools{gap:8px;padding:10px}#ultronDetectionTools button{padding:9px 10px}#ultronDetectionTools input[type=range]{width:90px}}
 `;document.head.appendChild(css);
 const tools=document.createElement("div");tools.id="ultronDetectionTools";
 tools.innerHTML='<strong>Detection view</strong><label>Zoom <input aria-label="Detection zoom" id="ultronZoom" type="range" min="1" max="3" step=".25" value="1"><b id="ultronZoomValue">1×</b></label><button type="button" id="ultronResetZoom">Reset zoom</button><button type="button" id="ultronSensitive">Higher sensitivity</button><button type="button" id="ultronStandard" class="active">Standard</button><div class="hint" id="ultronDetectionHint">The colored pixels are the model’s predicted mask. Zoom changes display only; sensitivity changes the AI threshold and may add false positives. Results are not confirmed oil spills.</div>';
 stage.insertAdjacentElement("afterend",tools);
 const zoom=tools.querySelector("#ultronZoom"),zv=tools.querySelector("#ultronZoomValue");
 function setZoom(x){zoom.value=String(x);zv.textContent=Number(x).toFixed(x%1?2:0).replace(/\.00$/,"")+"×";canvas.style.transform="scale("+x+")"}
 zoom.addEventListener("input",()=>setZoom(+zoom.value));
 tools.querySelector("#ultronResetZoom").addEventListener("click",()=>setZoom(1));
 function setThreshold(v){slider.value=v;value.textContent=Number(v).toFixed(2);tools.querySelector("#ultronSensitive").classList.toggle("active",v<.5);tools.querySelector("#ultronStandard").classList.toggle("active",v>=.5);const h=tools.querySelector("#ultronDetectionHint");h.textContent=v<.5?"Higher sensitivity (threshold 0.30): includes weaker AI signals, with greater false-positive risk. This is NOT verified oil detection.":"Standard (threshold 0.50): predicted pixels are shown at the original model threshold. The model may miss oil or identify unrelated patterns.";if(typeof window.remask==="function")window.remask();else if(typeof remask==="function")remask()}
 tools.querySelector("#ultronSensitive").addEventListener("click",()=>setThreshold(.30));
 tools.querySelector("#ultronStandard").addEventListener("click",()=>setThreshold(.50));
 async function refresh(){
  const badge=document.getElementById("cB");if(!badge)return;
  try {
   const controller=new AbortController(),t=setTimeout(()=>controller.abort(),15000);
   const response=await fetch("/health",{signal:controller.signal,cache:"no-store"});clearTimeout(t);
   if(!response.ok)throw Error("Health HTTP "+response.status);
   const h=await response.json();
   let msg=h.model_loaded?"AI backend online · SAR U-Net loaded":h.error?"AI model unavailable: "+h.error:"Backend online · SAR model initializing…";
   badge.title=msg;
   if(typeof window.ch==="function")window.ch(badge,h.model_loaded?"ok":h.error?"bad":"warn",msg);
   else badge.textContent=msg;
  }catch(e){badge.title="Model status check failed: "+e.message}
 }
 setTimeout(refresh,2000);setInterval(()=>{if(!document.hidden)refresh()},12000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();
})();