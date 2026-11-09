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
 // The old "Run AI model" invokes a Python /analyze endpoint and is disabled
 // by legacy power/hardware connection rules. Replace only its visible button
 // with an independent working browser SAR action.
 var oldSar=$('bai');
 if(oldSar){
   oldSar.style.display='none';
   var sarButton=document.createElement('button');
   sarButton.id='ultronSarBrowserRun';
   sarButton.type='button';sarButton.className='pri';
   sarButton.textContent='Analyze SAR image in browser';
   oldSar.insertAdjacentElement('afterend',sarButton);
   // Original Python-only download buttons cannot receive a result.
   for(var name of ['bmask','bann']){var b=$(name);if(b)b.style.display='none';}
   var msg=$('fi');
   if(msg&&!$('file')?.files?.length)msg.textContent='Choose a SAR-derived JPG or PNG tile. Analysis runs in your browser without an AI server.';
   sarButton.addEventListener('click',function(){
     var section=$('ultronInlineAI');
     if(!section){note('stt','SAR browser model panel not found. Refresh Mission Control.');return;}
     var choice=$('ity')?.value;
     if(choice==='other'){
       $('ultronRGBInline')?.scrollIntoView({behavior:'smooth',block:'start'});
       note('stt','Optical camera photographs belong in the RGB camera section below.',true);
       return;
     }
     var f=$('file')?.files?.[0];
     section.scrollIntoView({behavior:'smooth',block:'start'});
     if(!f){note('stt','Select a SAR-derived JPG or PNG in the browser SAR section below.',true);return;}
     if(!/^image\/(jpeg|png)$/.test(f.type)){
       note('stt','Browser SAR analysis accepts JPG or PNG. Choose one in the SAR section below.');
       return;
     }
     try{
       var picker=section.querySelector('input[type=file]'),run=findSarRun();
       pickFile(picker,f);
       if(!run)throw Error('SAR inference button unavailable.');
       note('stt','Running the trained SAR model in browser. See results below.',true);
       run.click();
     }catch(err){note('stt',err.message);}
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
