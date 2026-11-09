/* Embed the public RGB water-tray experiment inside Mission Control.
 * Keep SAR detection intact; the RGB iframe is same-origin and uses no Python.
 * The camera visible to a remote visitor is still subject to actual camera networking.
 */
(function(){
'use strict';
function init(){
 if(document.getElementById('ultronRGBInline'))return;
 var anchor=document.getElementById('ultronInlineAI')||
   document.getElementById('ultronDetectionTools')||
   document.getElementById('stage')||
   document.getElementById('page-comms');
 if(!anchor)return;
 var style=document.createElement('style');
 style.textContent='#ultronRGBInline{box-sizing:border-box;position:relative;max-width:100%;width:100%;margin:22px 0 28px;padding:16px;border:1px solid #417b9d;border-radius:16px;background:linear-gradient(145deg,#0b283c,#071727);scroll-margin-top:32px;color:#e8f7ff}#ultronRGBInline *{box-sizing:border-box}#ultronRGBInline .rgb-heading{font:600 clamp(18px,2.6vw,24px) system-ui;margin:0 0 9px}#ultronRGBInline .rgb-note{font:13px/1.5 system-ui;color:#bad8e6;margin:0 0 14px}#ultronRGBInline iframe{display:block;width:100%;max-width:100%;min-height:760px;height:870px;border:0;border-radius:10px;background:#071422}#ultronRGBInline a{color:#8ad9ff}@media(max-width:700px){#ultronRGBInline{padding:10px;margin:14px 0 22px}#ultronRGBInline iframe{min-height:850px}}';
 document.head.appendChild(style);
 var section=document.createElement('section');
 section.id='ultronRGBInline';
 section.setAttribute('aria-label','Live RGB water tray demo within Mission Control');
 var heading=document.createElement('h2');heading.className='rgb-heading';
 heading.textContent='Live RGB camera · water-tray experiment';
 var note=document.createElement('p');note.className='rgb-note';
 note.textContent='Optical demonstration-substance detection, separate from satellite SAR oil analysis. Upload photos, use this device’s camera, or provide a secure HTTPS ESP32-CAM feed. The 20-frame visual model is experimental.';
 var frame=document.createElement('iframe');
 frame.id='ultronRGBFrame';
 frame.title='Live RGB camera image analysis and capture';
 frame.src='rgb_live.html?embed=1';
 frame.loading='lazy';
 frame.allow='camera';
 frame.referrerPolicy='same-origin';
 section.append(heading,note,frame);
 anchor.insertAdjacentElement('afterend',section);
 // Accept only this same-origin embedded document's resize requests.
 window.addEventListener('message',function(ev){
   if(ev.source!==frame.contentWindow||ev.origin!==location.origin)return;
   if(!ev.data||ev.data.type!=='ultron-rgb-height')return;
   var h=Number(ev.data.height);
   if(!Number.isFinite(h))return;
   frame.style.height=Math.max(620,Math.min(2600,Math.ceil(h+15)))+'px';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
