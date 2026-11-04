(()=>{'use strict';
/* ULTRON-SAT: reuse the SAME verified browser U-Net detection in original
   Mission Control panels. No duplicate model/no fake masks. */
let latest=null,forecast=null,compare=.96,frame=48;
const hours=[6,12,24,48],hues=['#4be5e8','#5fb8ff','#a88bff','#ff7f9a'];
const $=(selector,root=document)=>root.querySelector(selector);
function make(tag,text,parent){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(parent)parent.appendChild(el);return el}
function canvasStyle(el){el.style.cssText='display:block;width:100%;height:auto;max-width:100%;border-radius:12px;background:#071625;border:1px solid #325a76';}
function getControls(){
 const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,strong')];
 const heading=headings.find(x=>/^Drift\s*\(experimental estimate\)$/i.test(x.textContent.trim()) && !x.closest('#ultronInlineAI'));
 let section=heading;
 for(let i=0;i<6&&section;i++,section=section.parentElement){
  const sliders=section.querySelectorAll('input[type=range]');
  if(sliders.length>=4&&sliders.length<20)return{section,heading,sliders:[...sliders]};
 }
 return{section:heading?.parentElement,heading,sliders:[]};
}
function vector(speedKmPerHr,toDeg){const a=toDeg*Math.PI/180;return{x:Math.sin(a)*speedKmPerHr,y:Math.cos(a)*speedKmPerHr}}
function selectedManual(){
 const c=getControls(),sl=c.sliders;let values=[6,260,.25,110];
 if(sl.length>=4)values=sl.slice(0,4).map((input,i)=>{
  const v=Number(input.value);
  return Number.isFinite(v)?v:values[i]
 });
 return{wind:values[0],windFrom:values[1],current:values[2],currentTo:values[3]};
}
function imageView(ctx,cv,width,height){
 const w=width,h=height;
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#041321';ctx.fillRect(0,0,w,h);
 if(latest?.sourceCanvas)ctx.drawImage(latest.sourceCanvas,0,0,w,h);
}
function drawMask(ctx,w,h,color,shiftX=0,shiftY=0,alpha=.48){
 if(!latest)return;
 const m=document.createElement('canvas');m.width=m.height=256;
 const c=m.getContext('2d'),img=c.createImageData(256,256);
 const rgb=color.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16));
 const a=latest.mask;
 for(let j=0;j<65536;j++)if(a[j]){const k=j*4;img.data[k]=rgb[0];img.data[k+1]=rgb[1];img.data[k+2]=rgb[2];img.data[k+3]=255}
 c.putImageData(img,0,0);
 ctx.globalAlpha=alpha;
 ctx.drawImage(m,shiftX,shiftY,w,h);
 ctx.globalAlpha=1;
}
function seeds(){
 if(!latest)return[];
 const out=[],a=latest.mask;
 for(let i=0;i<a.length&&out.length<140;i+=23)if(a[i])out.push({x:(i%256+.5)/256,y:(Math.floor(i/256)+.5)/256});
 return out;
}
function shift(hour,w,h){
 if(forecast?.[hour]){
  const scale=Number(forecast.scale);
  if(scale>0)return{x:forecast[hour].east/scale*w/latest.width,y:-forecast[hour].north/scale*h/latest.height};
 }
 const v=selectedManual(),a=vector(.03*v.wind*3.6,(v.windFrom+180)%360),b=vector(v.current*3.6,v.currentTo);
 // Manual sliders are m/s (convert to km/h); without georeferencing this is
 // display-only movement in fractional canvas coordinates.
 const dx=(a.x+b.x)*hour,dy=(a.y+b.y)*hour;
 return{x:dx*.32,y:-dy*.32};
}
let originalOverlay=null,originalFrame=null,driftCanvas=null,driftStatus=null;
function redrawOriginal(){
 if(!latest||!originalOverlay)return;
 const cv=originalOverlay,w=cv.width,h=cv.height,ctx=cv.getContext('2d');
 imageView(ctx,cv,w,h);
 ctx.save();ctx.beginPath();ctx.rect(0,0,Math.round(w*compare),h);ctx.clip();
 drawMask(ctx,w,h,'#ff9b38',0,0,.63);ctx.restore();
 const pos=w*compare;ctx.fillStyle='#58e4ee';ctx.fillRect(Math.max(0,pos-2),0,4,h);
 ctx.fillStyle='#e5fcff';ctx.font='bold '+Math.max(12,Math.round(w/55))+'px system-ui';
 ctx.fillText('Detected mask',12,24);ctx.textAlign='right';ctx.fillText('Original',w-12,24);ctx.textAlign='left';
}
function redrawDrift(){
 if(!latest||!driftCanvas)return;
 const cv=driftCanvas,w=cv.width,h=cv.height,ctx=cv.getContext('2d');
 imageView(ctx,cv,w,h);
 const ss=seeds();
 // Particle snapshots are seeded inside the model's actual flagged pixels.
 for(let k=0;k<hours.length;k++){
  const t=hours[k];if(t>frame)continue;
  const d=shift(t,w,h);ctx.fillStyle=hues[k];
  for(const p of ss){const x=p.x*w+d.x,y=p.y*h+d.y;if(x<0||y<0||x>w||y>h)continue;ctx.beginPath();ctx.arc(x,y,Math.max(1.3,w/360),0,Math.PI*2);ctx.fill()}
 }
 ctx.fillStyle='#021321ca';ctx.fillRect(8,7,Math.min(w-16,280),32);
 ctx.font='bold '+Math.max(12,Math.round(w/55))+'px system-ui';ctx.fillStyle='#e7f9ff';ctx.fillText('Detected slick drift · +'+frame+'h',17,28);
 if(driftStatus){
  const data=forecast?'Forecast-driven (Open-Meteo winds + marine currents)':'Manual slider scenario (not live weather)';
  driftStatus.textContent=data+' · '+ss.length+' particles sampled from AI mask · select 6/12/24/48 hours below';
 }
}
function setupOriginal(){
 const map=$('#map'),stage=$('#stage');
 if(!stage||!map||originalOverlay)return;
 // Overlay sits over original oil image without disturbing existing WebGL/3D code.
 if(getComputedStyle(stage).position==='static')stage.style.position='relative';
 originalOverlay=make('canvas',null,stage);
 originalOverlay.id='ultronOriginalMaskOverlay';
 originalOverlay.width=map.width||800;originalOverlay.height=map.height||500;
 originalOverlay.style.cssText='position:absolute;z-index:14;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none;border-radius:10px';
 const note=make('div','Oil detection overlay — same SAR U-Net results shown below',stage);
 note.id='ultronOriginalMaskNote';note.style.cssText='position:absolute;z-index:15;top:8px;left:8px;font:11px system-ui;background:#041828d9;color:#d6eff9;padding:5px 8px;border-radius:7px;display:none;pointer-events:none';
 // Read the existing original comparison slider when its label is available.
 const c=[...document.querySelectorAll('body *')].find(el=>el.children.length===0&&/Drag to compare:\s*detection overlay on the left/i.test(el.textContent||''));
 if(c){
  let parent=c.parentElement;
  for(let j=0;j<3&&parent;j++,parent=parent.parentElement){
   const range=parent.querySelector('input[type=range]');
   if(range){compare=(Number(range.value)-Number(range.min||0))/(Number(range.max||100)-Number(range.min||0));if(!Number.isFinite(compare))compare=.96;
    range.addEventListener('input',()=>{const den=Number(range.max||100)-Number(range.min||0);compare=den?(Number(range.value)-Number(range.min||0))/den:.5;redrawOriginal()});break}
  }
 }
}
function setupDrift(){
 if(driftCanvas)return;
 const {heading,section,sliders}=getControls();
 if(!heading||!section)return;
 driftCanvas=document.createElement('canvas');driftCanvas.id='ultronMainDriftCanvas';driftCanvas.width=800;driftCanvas.height=470;canvasStyle(driftCanvas);
 heading.insertAdjacentElement('afterend',driftCanvas);
 const status=make('p','Run the SAR AI to load the image and seed the drift model.',null);
 status.id='ultronMainDriftStatus';status.style.cssText='font:12px system-ui;color:#a8d4e7;margin:8px 0';
 driftCanvas.insertAdjacentElement('afterend',status);driftStatus=status;
 const buttons=make('div',null,null);buttons.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:10px 0';
 status.insertAdjacentElement('afterend',buttons);
 for(const h of hours){const b=make('button','+'+h+' hours',buttons);b.type='button';b.style.cssText='background:#1b516e;color:#eaffff;border:1px solid #4da1b5;border-radius:8px;padding:8px 12px;cursor:pointer';b.onclick=()=>{frame=h;redrawDrift()}}
 // Hide only the old blank drift canvas, not sliders or other explanation.
 const all=[...section.querySelectorAll('canvas')];for(const cv of all){if(cv!==driftCanvas && !cv.closest('#ultronInlineAI'))cv.style.display='none'}
 const old=[...section.querySelectorAll('*')].find(el=>el.children.length===0&&/Analyse an image to see the drift ensemble/i.test(el.textContent||''));
 if(old)old.style.display='none';
 sliders.slice(0,4).forEach(x=>x.addEventListener('input',()=>{forecast=null;redrawDrift()}));
}
function activate(e){
 latest=e.detail; if(!latest?.mask||latest.mask.length!==65536||!latest.sourceCanvas)return;
 forecast=null;setupOriginal();setupDrift();
 if(originalOverlay){originalOverlay.style.display='block';const n=$('#ultronOriginalMaskNote');if(n)n.style.display='block';originalOverlay.width=latest.width;originalOverlay.height=latest.height}
 if(driftCanvas){driftCanvas.width=800;driftCanvas.height=Math.max(300,Math.round(800*latest.height/latest.width))}
 redrawOriginal();redrawDrift();
}
document.addEventListener('ultron:sar-detection',activate);
document.addEventListener('ultron:drift-forecast',e=>{if(!latest)return;forecast=e.detail;redrawDrift()});
function init(){setupOriginal();setupDrift();window.addEventListener('resize',()=>{if(latest){redrawOriginal();redrawDrift()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
