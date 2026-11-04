(()=>{'use strict';
/* Preserve original dashboard and 3-D elements; embed the working ONNX oil
   detector and 48h forecast inline with the existing detection controls. */
function ready(){
 const stage=document.getElementById('stage');
 const modal=document.getElementById('ultronBrowserAI');
 const ai=modal?.querySelector('.aiBox');
 if(!stage||!ai||document.getElementById('ultronInlineAI'))return;
 const host=document.createElement('section');host.id='ultronInlineAI';
 host.setAttribute('aria-label','Inline oil detection and forecast');
 const anchor=document.getElementById('ultronDetectionTools')||stage;
 anchor.insertAdjacentElement('afterend',host);
 host.appendChild(ai);
 modal.classList.remove('open');
 modal.style.display='none';
 const launcher=document.getElementById('ultronAiLaunch');
 if(launcher)launcher.style.display='none';
 const close=[...ai.querySelectorAll('button')].find(x=>x.textContent.trim()==='Close');
 if(close){close.textContent='Go to dashboard';close.onclick=()=>document.getElementById('stage')?.scrollIntoView({behavior:'smooth',block:'center'})}
 const css=document.createElement('style');
 css.textContent=`
 #ultronInlineAI{position:relative;width:100%;max-width:100%;margin:18px 0 25px;box-sizing:border-box;scroll-margin-top:24px}
 #ultronInlineAI .aiBox{box-sizing:border-box;width:100%;max-width:none;padding:18px;background:linear-gradient(140deg,#102a40,#0b1f33);border:1px solid #427b9b;border-radius:16px;box-shadow:none}
 #ultronInlineAI .imageRow{grid-template-columns:repeat(2,minmax(0,1fr))}
 #ultronInlineAI .imageRow canvas{max-width:100%;width:100%;height:auto}
 #ultronInlineAI input[type=file]{max-width:100%}
 #ultronComparison{display:none;margin:15px 0}
 #ultronComparison.active{display:block}
 #ultronComparison canvas{width:100%;height:auto;aspect-ratio:auto;max-width:none;border-radius:12px;border:1px solid #4e859e;background:#091d2e}
 #ultronComparison label{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:9px 0;color:#cce6f1;flex-wrap:wrap}
 #ultronComparison input[type=range]{width:100%;accent-color:#5ddce5;cursor:ew-resize}
 #ultronInlineAI #ultronDriftControls{max-width:100%}
 @media(max-width:700px){#ultronInlineAI .imageRow{grid-template-columns:1fr}#ultronInlineAI .aiBox{padding:12px}}
 `;
 document.head.appendChild(css);
 // The very same model-generated original/overlay canvases are used to render
 // the swipe comparison, so the slider never displays a fabricated mask.
 const row=ai.querySelector('.imageRow');
 const first=row?.querySelector('canvas');
 const second=row?.querySelectorAll('canvas')[1];
 if(row&&first&&second){
  const comp=document.createElement('div');comp.id='ultronComparison';
  const header=document.createElement('strong');header.textContent='Main detection comparison · slide to reveal the oil overlay';
  comp.appendChild(header);
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;canvas.setAttribute('aria-label','Before and after detected oil comparison');
  comp.appendChild(canvas);
  const label=document.createElement('label');label.textContent='Candidate oil overlay (left)  ← Drag →  Original image (right)';
  const pct=document.createElement('span');pct.textContent='50%';label.append(pct);comp.append(label);
  const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value='50';slider.setAttribute('aria-label','Slide to compare original image and AI oil mask');comp.append(slider);
  row.insertAdjacentElement('beforebegin',comp);
  function draw(){
    if(!first.width||!second.width)return;
    const W=Math.min(1100,Math.max(320,first.width)),H=Math.round(W*first.height/first.width);
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(first,0,0,W,H);
    const share=Number(slider.value)/100,split=Math.round(W*share);
    ctx.save();ctx.beginPath();ctx.rect(0,0,split,H);ctx.clip();ctx.drawImage(second,0,0,W,H);ctx.restore();
    ctx.fillStyle='#a1f6fb';ctx.fillRect(split-2,0,4,H);
    ctx.fillStyle='#0a2436';ctx.fillRect(Math.max(0,split-32),7,64,24);
    ctx.fillStyle='#f1ffff';ctx.font='bold 12px system-ui';ctx.fillText(share+'',Math.max(0,split-32)+15,23);
    pct.textContent=Math.round(share*100)+'% overlay';
  }
  slider.addEventListener('input',draw);
  document.addEventListener('ultron:sar-detection',()=>{comp.classList.add('active');draw();});
 }
 function focus(){
  modal.classList.remove('open');modal.style.display='none';
  if(launcher)launcher.style.display='none';
  host.scrollIntoView({behavior:'smooth',block:'start'});
  const f=host.querySelector('input[type=file]');
  if(f&&!f.files?.length)setTimeout(()=>f.focus({preventScroll:true}),240);
 }
 window.ultronFocusInlineAI=focus;
 // The original floating launch action now jumps to the same inline controls.
 if(launcher)launcher.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();focus()},true);
 // Some older HTML prints this duplicate heading and a literal 'canvas'.
 // Remove only that stale fragment; the actual 48h forecast is below the AI.
 function removeOldDrift(){
  const headers=[...document.querySelectorAll('h1,h2,h3,h4,h5,strong')];
  for(const el of headers){
   if(!/^Drift\s*\(experimental estimate\)$/i.test(el.textContent.trim()))continue;
   if(host.contains(el))continue;
   const next=el.nextElementSibling;
   if(next&&/^(canvas|<canvas>)$/i.test(next.textContent.trim())&&next.children.length===0)next.remove();
   if(next?.tagName==='CANVAS')next.remove();
   const parent=el.parentElement;
   if(parent&&parent.children.length<=2&&parent.textContent.trim().length<100){
     const ptext=parent.textContent.trim();
     if(/Drift\s*\(experimental estimate\)/i.test(ptext)&&(/canvas/i.test(ptext)||parent.children.length===1))parent.remove();
     else el.remove();
   }else el.remove();
  }
 }
 removeOldDrift();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
