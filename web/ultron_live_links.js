/* ULTRON-SAT live links: real sensor status and opt-in camera viewing.
 * Does not replace the original 3D mission control or open any serial port.
 * A direct HTTP ESP32-CAM stream cannot be embedded in GitHub Pages HTTPS.
 * Camera URLs are used only after the visitor clicks Start/Open. */
(function(root){
'use strict';
function parseCameraUrl(value,pageProtocol){
  if(typeof value!=='string'||!value.trim())throw Error('Enter a camera stream address.');
  var u;try{u=new URL(value.trim());}catch(e){throw Error('Enter a full http:// or https:// camera URL.');}
  if(u.protocol!=='http:'&&u.protocol!=='https:')throw Error('Only HTTP or HTTPS camera streams are supported.');
  if(u.username||u.password)throw Error('Do not put passwords in the camera URL.');
  return {url:u.href,inline:u.protocol==='https:'||pageProtocol==='http:',reason:u.protocol==='http:'&&pageProtocol==='https:'?'Local HTTP video cannot be embedded into GitHub Pages HTTPS. Open the stream in another tab, or use an authenticated HTTPS camera gateway.':null};
}
function fresh(time,now,limit){return Number.isFinite(time)&&time>0&&now-time>=0&&now-time<=limit;}
var api={parseCameraUrl:parseCameraUrl,fresh:fresh};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
if(root.__ultronLiveLinks)return;root.__ultronLiveLinks=true;
var latest=null,loading=false,playing=false,frameUrl=null;
var $=function(id){return document.getElementById(id);};
function value(x,digits,unit){return typeof x==='number'&&Number.isFinite(x)?x.toFixed(digits)+(unit||''):'—';}
function safeText(v){return typeof v==='string'?v:'—';}
function set(id,v){var e=$(id);if(e)e.textContent=v;}
function init(){
  if($('ultronLiveLinks'))return;
  var style=document.createElement('style');
  style.textContent='#ultronLiveLinks{margin:20px 0;color:#dff5ff;scroll-margin-top:85px}#ultronLiveLinks .ull-panel{background:linear-gradient(130deg,#0c2439,#0b1628);border:1px solid #417792;border-radius:18px;padding:18px}#ultronLiveLinks .ull-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(143px,1fr));gap:10px;margin:15px 0}#ultronLiveLinks .ull-cell{background:#12334a;border:1px solid #2d5871;border-radius:10px;padding:10px;min-width:0}#ultronLiveLinks .ull-cell small{display:block;color:#adcfde;font-size:11px;margin-bottom:5px}#ultronLiveLinks .ull-cell strong{font-size:14px;overflow-wrap:anywhere}#ultronLiveLinks .ull-meta{color:#b7d7e4;font-size:12px;line-height:1.55}#ultronLiveLinks .ull-camera{border-top:1px solid #31546e;padding-top:15px;margin-top:14px}#ultronLiveLinks .ull-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#ultronLiveLinks input[type=url]{width:min(100%,480px);min-width:180px;flex:1;padding:10px;background:#071c2e;border:1px solid #4b829a;border-radius:8px;color:white}#ultronLiveLinks button{border:1px solid #528eaa;background:#144360;color:white;padding:9px 12px;border-radius:8px;cursor:pointer}#ultronLiveLinks button:disabled{opacity:.45}#ultronLiveLinks img{display:block;max-width:100%;max-height:440px;margin:12px auto 2px;object-fit:contain;border-radius:10px;background:#081c2b}#ultronLiveLinks a{color:#91defd}';
  document.head.append(style);
  var section=document.createElement('section');section.id='ultronLiveLinks';
  section.innerHTML='<div class="ull-panel"><h2>ULTRON-SAT · Live links</h2><p class="ull-meta">Measured telemetry only. The orbit, battery animation and predicted oil drift are separate simulations. USB and a LoRa ground receiver both feed the existing USB reader; nothing is uploaded to the website.</p><div class="ull-grid">'+
  [['link','Telemetry link'],['age','Last live sample'],['valid','Valid sensor mask'],['i2c','I²C bus'],['temp','TMP102'],['bus','INA219 bus'],['imu','MPU6050'],['light','LDR raw ADC'],['storage','SD recording'],['radio','LoRa status'],['camstate','UART camera photo']].map(function(p){return '<div class="ull-cell"><small>'+p[1]+'</small><strong id="ull-'+p[0]+'">—</strong></div>';}).join('')+
  '</div><p id="ull-status" class="ull-meta" role="status">No physical telemetry received yet. Use Connect USB in the existing telemetry panel. A LoRa receiver plugged into the computer also connects there.</p><div class="ull-camera"><h3>ESP32-CAM · Live video viewer</h3><p class="ull-meta">A camera firmware with network streaming is required. The current UART camera sketch captures SD photos only; it does not stream video. On GitHub Pages, HTTP local-camera video opens in a separate tab; an HTTPS camera gateway can display inline.</p><div class="ull-tools"><input id="ull-camera-url" type="url" placeholder="https://your-secure-camera-gateway/stream or http://local-camera-ip:81/stream" aria-label="Camera stream URL" autocomplete="off"><button id="ull-camera-start" type="button">Start / Open camera</button><button id="ull-camera-stop" type="button" disabled>Stop video</button></div><p id="ull-camera-status" role="status" class="ull-meta">Camera video is not connected.</p><img id="ull-camera-image" alt="ESP32-CAM live camera feed, shown only when an HTTPS stream is connected" hidden referrerpolicy="no-referrer"></div></div>';
  (document.getElementById('page-comms')||document.querySelector('main')||document.body).append(section);
  var nav=document.querySelector('header nav');if(nav&&!nav.querySelector('a[href="#ultronLiveLinks"]')){var a=document.createElement('a');a.href='#ultronLiveLinks';a.textContent='Live links';nav.append(a);}
  $('ull-camera-start').addEventListener('click',startCamera);
  $('ull-camera-stop').addEventListener('click',stopCamera);
  $('ull-camera-image').addEventListener('load',function(){if(playing)set('ull-camera-status','Live HTTPS camera stream opened. Picture freshness depends on the camera feed.');});
  $('ull-camera-image').addEventListener('error',function(){if(playing)set('ull-camera-status','Video load failed. Check the secure camera URL, gateway authentication and network access.');});
  render();setInterval(render,4000);
}
function render(){
 if(!$('ultronLiveLinks'))return;
 var t=latest,portOK=t?.transport!=='USB'||!root.UltronApp?.usbConnected||root.UltronApp.usbConnected();
 var live=t&&t.source==='REAL HARDWARE'&&portOK&&fresh(t.received_at,Date.now(),90000);
 var link=t?(t.transport==='USB'&&(t.lora?.rssi!=null||t.lora?.snr!=null)?'LoRa → ground USB':t.transport):'Not connected';
 set('ull-link',live?link+' · LIVE':link+' · '+(t?'STALE':'OFFLINE'));
 set('ull-age',t?(t.source==='REPLAY'?'Historical (not live)':Math.max(0,Math.round((Date.now()-t.received_at)/1000))+' seconds'):'Never');
 var ok=Number.isInteger(t?.raw?.ok)?t.raw.ok:null;
 set('ull-valid',ok===null?'Not reported':ok+'/7'+(ok===0?' · no sensors valid':''));
 var i2c=t?.raw?.i2c;
 set('ull-i2c',live?(safeText(i2c?.state)+(Number.isInteger(i2c?.responding)?' · '+i2c.responding+' addr':'')):'—');
 set('ull-temp',live?value(t.environment?.temperature_C,2,' °C'):'—');
 set('ull-bus',live?value(t.power?.bus_voltage,2,' V'):'—');
 set('ull-imu',live&&t.accelerometer?.x!==null?value(t.accelerometer.x/9.80665,2,' g X'):'—');
 set('ull-light',live?value(t.light?.light1,0,' ADC'):'—');
 set('ull-storage',live?safeText(t.storage?.state):'—');
 set('ull-radio',live?safeText(t.lora?.state)+(t.lora?.rssi!=null?' · '+t.lora.rssi+' dBm':''):'—');
 set('ull-camstate',live?safeText(t.camera?.state):'—');
 set('ull-status',live?(i2c?.state&&i2c.state!=='SCANNED'?'Real '+link+' packet received, but I²C bus is '+i2c.state+'. Ignore sensor values until wiring is verified.':'Real '+link+' telemetry received. Sensor flags must match verified hardware; simulation is separate.'):t?'Readings are stale, disconnected or historical. Reconnect hardware; the simulation is not live telemetry.':'No physical telemetry received. Connect the ESP32 or the LoRa ground receiver through the existing USB controls.');
}
function startCamera(){
 var data;try{data=parseCameraUrl($('ull-camera-url').value,location.protocol);}catch(e){set('ull-camera-status',e.message);return;}
 if(!data.inline){
   stopCamera();
   set('ull-camera-status',data.reason+' A separate tab will open; the stream is not embedded or hosted by GitHub.');
   root.open(data.url,'_blank','noopener,noreferrer');
   return;
 }
 stopCamera();frameUrl=data.url;playing=true;loading=true;
 $('ull-camera-image').hidden=false;$('ull-camera-image').src=data.url;
 $('ull-camera-stop').disabled=false;
 set('ull-camera-status','Opening HTTPS camera feed... If the image stays blank, verify the endpoint provides MJPEG or JPEG.');
}
function stopCamera(){
 playing=false;loading=false;frameUrl=null;
 var img=$('ull-camera-image');if(img){img.removeAttribute('src');img.hidden=true;}
 var b=$('ull-camera-stop');if(b)b.disabled=true;
 set('ull-camera-status','Camera video stopped or not connected.');
}
document.addEventListener('ultron:normalized-sample',function(e){var t=e.detail;if(t&&['USB','WIFI','REPLAY'].includes(t.transport)){latest=t;render();}});
document.addEventListener('ultron:transport-reset',function(){latest=null;render();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
