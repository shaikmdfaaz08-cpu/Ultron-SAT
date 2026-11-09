(()=>{'use strict';
/* SAR U-Net mask and SEPARATE RGB color-rule visual proxy on original stage.
   Optical mask is NOT trained segmentation and NOT physical drift. */
let latest=null,forecast=null,compare=.5,frame=48,playing=false,clock=0,lastTick=0,animationId=0,particleSeed=[];
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
 if(latest?.kind==='rgb'){
   return{x:w*.13*(hour/48),y:-h*.055*(hour/48)}; // visual illustration only
 }
 if(forecast?.[6]&&forecast.scale>0){
  const a=Math.max(0,Math.min(48,hour));
  const lo=Math.floor(a),hi=Math.ceil(a);
  // Hourly forecast vectors, if supplied; otherwise interpolate the existing milestones.
  const milestones=[0,6,12,24,48];
  let left=0,right=48;
  for(let i=0;i<milestones.length-1;i++)if(a>=milestones[i]&&a<=milestones[i+1]){left=milestones[i];right=milestones[i+1];break}
  const p=forecast[left]||{east:0,north:0},n=forecast[right]||p,f=right===left?0:(a-left)/(right-left);
  const east=p.east+(n.east-p.east)*f,north=p.north+(n.north-p.north)*f;
  return{x:east/forecast.scale*w/latest.width,y:-north/forecast.scale*h/latest.height};
 }
 const v=selectedManual(),a=vector(.03*v.wind*3.6,(v.windFrom+180)%360),b=vector(v.current*3.6,v.currentTo);
 const dx=(a.x+b.x)*hour,dy=(a.y+b.y)*hour;
 return{x:dx*.32,y:-dy*.32};
}
let originalOverlay=null,originalFrame=null,originalDivider=null,originalRange=null,driftCanvas=null,driftStatus=null,previewRequest=0;
function setComparison(value){
 compare=Math.max(0,Math.min(1,Number(value)||0));
 if(originalRange){
   const a=Number(originalRange.min||0),b=Number(originalRange.max||100);
   if(b>a)originalRange.value=String(a+compare*(b-a));
 }
 redrawOriginal();
}
function moveDividerToClientX(clientX){
 if(!originalOverlay)return;
 const rect=originalOverlay.getBoundingClientRect();
 if(!rect.width)return;
 setComparison((clientX-rect.left)/rect.width);
}
function redrawOriginal(){
 if(!latest||!originalOverlay)return;
 const cv=originalOverlay,w=cv.width,h=cv.height,ctx=cv.getContext('2d');
 imageView(ctx,cv,w,h);
 ctx.save();ctx.beginPath();ctx.rect(0,0,Math.round(w*compare),h);ctx.clip();
 drawMask(ctx,w,h,'#ff9b38',0,0,.63);ctx.restore();
 const pos=w*compare;ctx.fillStyle='#58e4ee';ctx.fillRect(Math.max(0,pos-2),0,4,h);
 if(originalDivider){
   originalDivider.style.left=(compare*100)+'%';
   originalDivider.setAttribute('aria-valuenow',String(Math.round(compare*100)));
   originalDivider.setAttribute('aria-valuetext',Math.round(compare*100)+' percent highlighted left, original right');
 }
 ctx.fillStyle='#e5fcff';ctx.font='bold '+Math.max(12,Math.round(w/55))+'px system-ui';
 ctx.fillText(latest.kind==='rgb'?'Colour-rule overlay':'SAR model mask',12,24);ctx.textAlign='right';ctx.fillText('Original',w-12,24);ctx.textAlign='left';
}
function redrawDrift(){
 if(!latest||!driftCanvas)return;
 const cv=driftCanvas,w=cv.width,h=cv.height,ctx=cv.getContext('2d');
 imageView(ctx,cv,w,h);
 const ss=particleSeed;
 const hoursNow=Math.max(0,Math.min(48,clock));
 const path=shift(hoursNow,w,h);
 const t=hoursNow/48;
 // SAR model mask or separate RGB colour-rule candidate area.
 drawMask(ctx,w,h,'#f7a94a',0,0,.24);
 // Animated illustrative particles inside a model mask (SAR) or color-rule mask (RGB).
 for(let i=0;i<ss.length;i++){
  const p=ss[i],variation=1+0.06*Math.sin(i*14.19),spread=Math.sqrt(hoursNow/48)*Math.max(0,w*.017);
  const jx=spread*Math.sin(i*12.9898+hoursNow*.13),jy=spread*Math.cos(i*8.321+hoursNow*.13);
  const x=p.x*w+path.x*variation+jx,y=p.y*h+path.y*variation+jy;
  if(x<0||y<0||x>=w||y>=h)continue;
  ctx.beginPath();ctx.fillStyle=i%5===0?'#6beafd':'#ffab62';
  ctx.arc(x,y,i%7===0?3:2.2,0,Math.PI*2);ctx.fill();
 }
 // Mark reference seed and motion trail for readable evolution.
 const points=[0,6,12,24,48].filter(x=>x<=hoursNow);
 for(const hr of points.slice(1)){
  const p=shift(hr,w,h);
  ctx.strokeStyle=hr===48?'#fa86a5':'#56d7ea';ctx.lineWidth=1.6;ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.moveTo(w*.5,h*.5);ctx.lineTo(w*.5+p.x,h*.5+p.y);ctx.stroke();ctx.setLineDash([]);
 }
 ctx.fillStyle='#021321d9';ctx.fillRect(8,8,Math.min(w-16,345),55);
 ctx.fillStyle='#eaffff';ctx.font='bold 15px system-ui';ctx.fillText(latest.kind==='rgb'?'RGB visual movement demo · +'+hoursNow.toFixed(1)+'h':'Oil slick drift · +'+hoursNow.toFixed(1)+' of 48 h',18,28);
 ctx.font='12px system-ui';ctx.fillStyle='#93e4f3';
 ctx.fillText(latest.kind==='rgb'?'ILLUSTRATION ONLY · no weather or scale':forecast?'Forecast: hourly wind + ocean currents':'Scenario: adjustable wind + current sliders',18,48);
 if(driftStatus){
  driftStatus.textContent=latest.kind==='rgb'
    ? 'RGB colour-rule candidate only · '+ss.length+' illustrated particles. The 0–48h movement is NOT a forecast and has no physical scale.'
    : (forecast?'Forecast-driven experimental estimate':'Illustrative slider-driven scenario (not measured weather)')+' · '+ss.length+' moving particles originating in the SAR U-Net mask.';
 }
}
function animate(ts){
 if(!playing)return;
 if(lastTick){
  const dt=Math.min(.1,(ts-lastTick)/1000);
  clock+=dt*3.3; // 48 forecast hours in about 15 seconds
  if(clock>=48)clock=0;
 }
 lastTick=ts;redrawDrift();
 animationId=requestAnimationFrame(animate);
}
function startAnimation(){if(!latest)return;cancelAnimationFrame(animationId);lastTick=0;playing=true;animationId=requestAnimationFrame(animate)}
function pauseAnimation(){playing=false;cancelAnimationFrame(animationId);lastTick=0;redrawDrift()}
function setupOriginal(){
 const map=$('#map'),stage=$('#stage');
 if(!stage||!map||originalOverlay)return;
 // Overlay sits over original oil image without disturbing existing WebGL/3D code.
 if(getComputedStyle(stage).position==='static')stage.style.position='relative';
 originalOverlay=make('canvas',null,stage);
 originalOverlay.id='ultronOriginalMaskOverlay';
 originalOverlay.width=map.width||800;originalOverlay.height=map.height||500;
 originalOverlay.style.cssText='position:absolute;z-index:14;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none;border-radius:10px';
 // A narrow drag handle sits on the cyan divider. It does not block the
 // entire mission-control surface, and works with mouse, touch, or keyboard.
 originalDivider=make('div',null,stage);
 originalDivider.id='ultronComparisonDragHandle';
 originalDivider.setAttribute('role','slider');
 originalDivider.setAttribute('aria-label','Drag to compare original image with highlighted mask');
 originalDivider.setAttribute('aria-valuemin','0');
 originalDivider.setAttribute('aria-valuemax','100');
 originalDivider.setAttribute('aria-valuenow','50');
 originalDivider.tabIndex=0;
 originalDivider.style.cssText='position:absolute;z-index:16;top:0;left:50%;transform:translateX(-50%);width:44px;height:100%;display:none;touch-action:none;cursor:ew-resize;user-select:none;align-items:center;justify-content:center;outline-offset:3px';
 const grip=make('span','↔',originalDivider);
 grip.setAttribute('aria-hidden','true');
 grip.style.cssText='display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#073047ed;color:#dfffff;border:2px solid #55e4e8;box-shadow:0 1px 14px #0009;font:bold 21px system-ui;pointer-events:none';
 let dragging=false,activePointer=null;
 originalDivider.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   dragging=true;activePointer=e.pointerId;
   originalDivider.setPointerCapture(e.pointerId);
   moveDividerToClientX(e.clientX);
   e.preventDefault();
 });
 originalDivider.addEventListener('pointermove',e=>{
   if(dragging&&e.pointerId===activePointer){moveDividerToClientX(e.clientX);e.preventDefault();}
 });
 const endDrag=e=>{
   if(e.pointerId!==activePointer)return;
   dragging=false;activePointer=null;
   if(originalDivider.hasPointerCapture(e.pointerId))originalDivider.releasePointerCapture(e.pointerId);
 };
 originalDivider.addEventListener('pointerup',endDrag);
 originalDivider.addEventListener('pointercancel',endDrag);
 originalDivider.addEventListener('lostpointercapture',()=>{dragging=false;activePointer=null;});
 originalDivider.addEventListener('keydown',e=>{
   let next=compare;
   if(e.key==='ArrowLeft'||e.key==='ArrowDown')next-=.05;
   else if(e.key==='ArrowRight'||e.key==='ArrowUp')next+=.05;
   else if(e.key==='Home')next=0;
   else if(e.key==='End')next=1;
   else return;
   e.preventDefault();setComparison(next);
 });
 const note=make('div','Oil detection overlay — same SAR U-Net results shown below',stage);
 note.id='ultronOriginalMaskNote';note.style.cssText='position:absolute;z-index:15;top:8px;left:8px;font:11px system-ui;background:#041828d9;color:#d6eff9;padding:5px 8px;border-radius:7px;display:none;pointer-events:none';
 // Read the existing original comparison slider when its label is available.
 const c=[...document.querySelectorAll('body *')].find(el=>el.children.length===0&&/Drag to compare:\s*detection overlay on the left/i.test(el.textContent||''));
 if(c){
  let parent=c.parentElement;
  for(let j=0;j<3&&parent;j++,parent=parent.parentElement){
   const range=parent.querySelector('input[type=range]');
   if(range){
     originalRange=range;
     // Preserve the old comparison control, now synchronized with the image handle.
     range.addEventListener('input',()=>{
       const den=Number(range.max||100)-Number(range.min||0);
       setComparison(den?(Number(range.value)-Number(range.min||0))/den:.5);
     });
     break;
   }
  }
 }
}
function setupDrift(){
 if(driftCanvas)return;
 const {heading,section,sliders}=getControls();
 if(!heading)return;
 const parent=section||heading.parentElement;
 // Restore the original drift canvas with original photo behind moving AI particles.
 driftCanvas=document.createElement('canvas');driftCanvas.id='ultronMainDriftCanvas';driftCanvas.width=800;driftCanvas.height=480;canvasStyle(driftCanvas);
 heading.insertAdjacentElement('afterend',driftCanvas);
 const status=make('p','Analyze a SAR image above to animate the predicted oil-slick drift.',null);
 status.id='ultronMainDriftStatus';status.style.cssText='font:12px system-ui;color:#a8d4e7;margin:8px 0';
 driftCanvas.insertAdjacentElement('afterend',status);driftStatus=status;
 const toolbar=make('div',null,null);toolbar.id='ultronDriftTimeline';
 toolbar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 20px';
 status.insertAdjacentElement('afterend',toolbar);
 const play=make('button','Pause animation',toolbar);
 play.type='button';play.style.cssText='background:#267ca0;color:white;border:1px solid #4da1b5;border-radius:8px;padding:8px 12px;cursor:pointer';
 play.onclick=()=>{if(playing){pauseAnimation();play.textContent='Play animation'}else{startAnimation();play.textContent='Pause animation'}};
 for(const hr of [6,12,24,48]){const b=make('button','+'+hr+' h',toolbar);b.type='button';b.style.cssText='background:#1b516e;color:#eaffff;border:1px solid #4da1b5;border-radius:8px;padding:8px 12px;cursor:pointer';b.onclick=()=>{clock=hr;pauseAnimation();play.textContent='Play animation'};}
 const reset=make('button','Restart 0–48 h',toolbar);reset.type='button';reset.style.cssText='background:#1b516e;color:#eaffff;border:1px solid #4da1b5;border-radius:8px;padding:8px 12px;cursor:pointer';
 reset.onclick=()=>{clock=0;startAnimation();play.textContent='Pause animation'};
 // Remove old inactive output but keep functional manual weather sliders.
 const all=[...parent.querySelectorAll('canvas')];for(const cv of all){if(cv!==driftCanvas && !cv.closest('#ultronInlineAI'))cv.style.display='none'}
 const old=[...parent.querySelectorAll('*')].find(el=>el.children.length===0&&/Analyse an image to see the drift ensemble/i.test(el.textContent||''));
 if(old)old.style.display='none';
 sliders.slice(0,4).forEach(x=>x.addEventListener('input',()=>{forecast=null;redrawDrift()}));
}
function activate(e,kind){
 const incoming=e.detail;
 if(!incoming?.mask||incoming.mask.length!==65536||!incoming.sourceCanvas)return;
 if(kind==='rgb'&&incoming.maskType!=='color-rule-not-AI-segmentation')return;
 if(kind==='rgb'&&window.ultronActiveDetectionMode==='sar')return;
 previewRequest++;
 window.ultronActiveDetectionMode=kind;
 const continuing=kind==='rgb'&&latest?.kind==='rgb';
 latest=Object.assign({},incoming,{kind:kind});
 if(!continuing){forecast=null;clock=0;compare=.5;}
 particleSeed=seeds();setupOriginal();setupDrift();
 if(originalOverlay){
   originalOverlay.style.display='block';
   if(originalDivider)originalDivider.style.display='flex';
   const n=$('#ultronOriginalMaskNote');
   if(n){
     n.style.display='block';
     n.textContent=kind==='rgb'
       ? 'RGB photo · orange colour-rule candidate (NOT trained oil mask)'
       : 'Satellite SAR · trained U-Net detection mask';
   }
   originalOverlay.width=latest.width;originalOverlay.height=latest.height;
 }
 if(driftCanvas){driftCanvas.width=800;driftCanvas.height=Math.max(300,Math.round(800*latest.height/latest.width))}
 redrawOriginal();redrawDrift();
 if(!continuing)startAnimation();
}
// A newly selected SAR file must replace the stale RGB preview immediately.
// No mask is drawn until the trained SAR U-Net actually returns a result.
document.addEventListener('ultron:sar-file-selected',function(event){
 const file=event.detail?.file;
 if(!file||!/^image\/(png|jpeg)$/.test(file.type))return;
 const token=++previewRequest;
 window.ultronActiveDetectionMode='sar';
 pauseAnimation();latest=null;forecast=null;particleSeed=[];
 setupOriginal();
 if(originalDivider)originalDivider.style.display='none';
 const note=$('#ultronOriginalMaskNote');
 if(note){note.style.display='block';note.textContent='SAR image selected · original preview only · press Run AI model for trained detection';}
 if(driftStatus)driftStatus.textContent='SAR image selected. Run the model to create a detection mask before calculating any forecast.';
 if(driftCanvas){const dc=driftCanvas.getContext('2d');dc.clearRect(0,0,driftCanvas.width,driftCanvas.height);}
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{
   URL.revokeObjectURL(url);
   if(token!==previewRequest||window.ultronActiveDetectionMode!=='sar'||!originalOverlay)return;
   originalOverlay.width=img.naturalWidth;
   originalOverlay.height=img.naturalHeight;
   const ctx=originalOverlay.getContext('2d');
   ctx.drawImage(img,0,0,originalOverlay.width,originalOverlay.height);
   originalOverlay.style.display='block';
 };
 img.onerror=()=>{URL.revokeObjectURL(url);
   if(note&&token===previewRequest)note.textContent='Could not preview SAR image. Choose a valid JPG/PNG.';
 };
 img.src=url;
});
document.addEventListener('ultron:sar-detection',e=>activate(e,'sar'));
document.addEventListener('ultron:rgb-visual-demo',e=>activate(e,'rgb'));
document.addEventListener('ultron:drift-forecast',e=>{if(!latest||latest.kind!=='sar')return;forecast=e.detail;clock=0;startAnimation()});
function init(){setupOriginal();setupDrift();window.addEventListener('resize',()=>{if(latest){redrawOriginal();redrawDrift()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
