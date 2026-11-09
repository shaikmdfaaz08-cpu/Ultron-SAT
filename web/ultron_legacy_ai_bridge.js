/* ULTRON-SAT legacy controls compatibility bridge.
 * Keep the old on-page layout, but never send RGB/SAR files to nonexistent
 * Python endpoints on GitHub Pages. Uses the existing browser AI UIs.
 */
(function(){
'use strict';
function $(id){return document.getElementById(id);}
function note(id,message,ok){var e=$(id);if(e){e.textContent=message;e.style.color=ok?'#b4f9d9':'#ffe5a1';}}
function pickFile(input,file){
 if(!input||!file)throw Error('Image uploader not ready');
 if(typeof DataTransfer==='undefined')throw Error('This browser cannot transfer the selected file automatically. Use the file picker in the viewer below.');
 var transfer=new DataTransfer();transfer.items.add(file);
 input.files=transfer.files;
 input.dispatchEvent(new Event('change',{bubbles:true}));
}
function findSarRun(){
 var box=document.querySelector('#ultronInlineAI .aiBox');
 return box&&Array.from(box.querySelectorAll('button')).find(function(b){return b.textContent.trim()==='Analyze image'});
}
function init(){
 if(window.__ultronLegacyAiBridge)return;window.__ultronLegacyAiBridge=true;
 var rgbCard=$('rgbCameraCard'),rgbFile=$('rgbCameraFile'),rgbBtn=$('rgbAnalyzeBtn'),link=$('rgbStandaloneLink');
 var rgb=$('ultronRGBInline');
 if(rgbCard&&rgbBtn){
   var heading=rgbCard.querySelector('h2');
   if(heading)heading.innerHTML='RGB Camera AI <small>Water-tray demonstration · browser-based model</small>';
   var mode=rgbCard.querySelector('.rgb-mode strong');
   if(mode)mode.textContent='ESP32-CAM optical experiment';
   var info=rgbCard.querySelector('p.note');
   if(info)info.textContent='This camera-photo demonstration uses the experimental 20-frame visible dark-patch model in Mission Control below. It does not use the old six-class Python server or SAR model.';
   if(rgbFile)rgbFile.accept='.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
   var drop=rgbFile?.closest('label');
   if(drop)drop.firstChild.textContent='Choose a color photo (JPG or PNG) ';
   rgbBtn.textContent='Analyze RGB photo in dashboard';
   if(link){link.href='#ultronRGBInline';link.textContent='Go to live camera and RGB results';}
   var oldCompare=$('rgbCompare'),oldClasses=$('rgbClasses');
   if(oldCompare)oldCompare.hidden=true;
   if(oldClasses)oldClasses.hidden=true;
   note('rgbCameraStatus','Select a camera photograph to analyze with the experimental browser model below.',true);
   // The original inline HTML attaches its own POST /rgb/analyze handler.
   // A document capture listener stops that handler before it can run.
   document.addEventListener('click',async function(e){
     var button=e.target?.closest?.('#rgbAnalyzeBtn');
     if(!button)return;
     e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
     var f=rgbFile?.files?.[0];
     if(!f){note('rgbCameraStatus','Choose a JPG or PNG first.');return;}
     if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>15*1024*1024){note('rgbCameraStatus','Use a JPG or PNG under 15 MB.');return;}
     var section=$('ultronRGBInline'),frame=$('ultronRGBFrame');
     if(!section||!frame){note('rgbCameraStatus','RGB browser viewer is not available. Refresh the dashboard.');return;}
     section.scrollIntoView({behavior:'smooth',block:'start'});
     try{
       var tries=0,picker=null;
       // The embedded viewer uses lazy loading. Await that document.
       while(tries++<50){
         try{picker=frame.contentDocument?.getElementById('upload');}catch{}
         if(picker)break;
         await new Promise(function(resolve){setTimeout(resolve,120);});
       }
       if(!picker)throw Error('RGB viewer did not load. Use its upload button after refreshing.');
       pickFile(picker,f);
       note('rgbCameraStatus','Image sent to the RGB model below. Read the experimental result there.',true);
     }catch(err){note('rgbCameraStatus',err.message);}
   },true);
 }
 // Restore the original Run AI model action rather than hiding it.
 // Clone its DOM node to discard stale Python-backend listeners and hardware
 // disabled-state gating; this browser SAR ONNX action needs no USB connection.
 var oldSar=$('bai');
 if(oldSar){
   var restored=oldSar.cloneNode(true);
   restored.id='bai';
   restored.textContent='Run AI model';
   restored.disabled=false;
   restored.hidden=false;
   restored.style.display='';
   oldSar.replaceWith(restored);
   var msg=$('fi');
   if(msg)msg.textContent='Upload a SAR-derived JPG/PNG tile and press Run AI model. Trained SAR inference runs in your browser (no CubeSat connection necessary).';
   // Old Python-only download links cannot return an offline browser mask.
   for(var name of ['bmask','bann']){var b=$(name);if(b)b.style.display='none';}
   var sarStatus=document.createElement('p');
   sarStatus.id='ultronSarRunStatus';
   sarStatus.setAttribute('role','status');
   sarStatus.style.cssText='font:12px/1.5 system-ui;color:#bde6f3;margin:9px 0';
   sarStatus.textContent='SAR browser model ready to start after you select an image. No AI server or USB hardware needed.';
   restored.insertAdjacentElement('afterend',sarStatus);
   function report(message,good){
     sarStatus.textContent=message;
     sarStatus.style.color=good?'#aff6db':'#ffd99b';
     note('stt',message,good);
   }
   restored.addEventListener('click',function(event){
     event.preventDefault();
     var section=$('ultronInlineAI');
     if(!section){report('SAR browser detector missing. Refresh the dashboard.',false);return;}
     var choice=$('ity')?.value;
     if(choice==='other'){
       $('ultronRGBInline')?.scrollIntoView({behavior:'smooth',block:'start'});
       report('Camera photographs belong in the separate RGB section; choose SAR-derived RGB tile for this model.',false);
       return;
     }
     var f=$('file')?.files?.[0];
     if(!f){report('Select a SAR-derived JPG or PNG first.',false);return;}
     if(!/^image\/(jpeg|png)$/.test(f.type)||f.size>15*1024*1024){
       report('Choose a valid SAR-derived JPG or PNG under 15 MB.',false);return;
     }
     window.ultronActiveDetectionMode='sar';
     section.scrollIntoView({behavior:'smooth',block:'start'});
     try{
       var picker=section.querySelector('input[type=file]'),run=findSarRun();
       if(!picker||!run)throw Error('The embedded SAR model controls could not be found.');
       pickFile(picker,f);
       report('Loading trained SAR U-Net and analyzing '+f.name+' in your browser. The result and 48-hour tools appear below.',true);
       run.click();
     }catch(err){report('SAR analysis could not start: '+err.message,false);}
   });
   // The original hardware may be disconnected. It must not disable web-only analysis.
   var enable=new MutationObserver(function(){
     if(restored.disabled)restored.disabled=false;
     if(restored.hidden)restored.hidden=false;
   });
   enable.observe(restored,{attributes:true,attributeFilter:['disabled','hidden']});
 }
 document.addEventListener('ultron:sar-detection',function(e){
   var mask=e.detail?.mask;
   if(!mask||mask.length!==65536)return;
   var pixels=0;for(var i=0;i<mask.length;i++)pixels+=mask[i]===1?1:0;
   var pct=(pixels/65536*100).toFixed(2);
   var status=$('ultronSarRunStatus');
   if(status){
     status.style.color='#b5f6d7';
     status.textContent='Trained SAR U-Net finished · candidate mask '+pct+'% of image. Overlay and 48-hour illustration updated. A weather-based forecast requires real location and km/pixel scale.';
   }
 });
 var originalUpload=$('file');
 if(originalUpload){
   originalUpload.addEventListener('change',function(){
     var f=originalUpload.files?.[0];
     if(!f)return;
     window.ultronActiveDetectionMode='sar';
     document.dispatchEvent(new CustomEvent('ultron:sar-file-selected',{detail:{file:f}}));
     var status=$('ultronSarRunStatus');
     if(status)status.textContent='Selected '+f.name+'. Click Run AI model to compute the actual trained SAR mask; the previous RGB overlay is cleared.';
   });
 }
 // Legacy settings still reference this DOM input, so do not remove it.
 // It does not configure the independent browser-based models.
 var backend=$('api');
 if(backend){var group=backend.closest('label');if(group)group.style.display='none';}
 var power=$('enf')?.closest('label');if(power)power.style.display='none';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
