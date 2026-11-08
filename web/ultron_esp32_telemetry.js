(()=>{'use strict';if(window.__ultronHW)return;window.__ultronHW=true;
let rows=[],keys=new Set(),last=0,connected=false,receivedLines=0,rejectedLines=0,sampleSequence=0;
const $=x=>document.getElementById(x), val=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
function init(){const style=document.createElement('style');style.textContent='#espHw{margin:20px 0;color:#edf8ff;scroll-margin-top:78px}#espHw .hwbox{border:1px solid #3b7899;border-radius:20px;background:linear-gradient(130deg,#0c263e,#091a30);padding:18px}#espHw .hwtools{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}#espHw button,#espHw label{border:1px solid #4384aa;background:#164562;border-radius:10px;padding:9px 12px;color:#ecf8ff;cursor:pointer;font-size:13px}#espHw button:disabled{opacity:.4}#espHw label input{display:none}#espHw .hwgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin:15px 0}#espHw .hwm{background:#103550;border:1px solid #325f7c;border-radius:12px;padding:13px;min-width:0}#espHw .hwm small{display:block;color:#a9d4eb;margin-bottom:7px}#espHw .hwm b{font-size:20px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}#espHw .hwinfo{font-size:12px;color:#b1cfdd;line-height:1.65}#espHw table{border-collapse:collapse;font-size:12px;min-width:650px}#espHw td,#espHw th{border-bottom:1px solid #31516b;padding:7px}@media(max-width:700px){#espHw .hwgrid{grid-template-columns:repeat(2,minmax(0,1fr))}#espHw .hwm b{font-size:17px}}';document.head.append(style);
const el=document.createElement('section');el.id='espHw';el.innerHTML='<div class="hwbox"><h2>ESP32 CubeSat · Live Hardware Readings</h2><div class="hwtools"><span id="hwconn">Not connected</span><button id="hwopen">Connect USB (115200)</button><button id="hwclose" disabled>Disconnect</button><label>Import SD .log<input id="hwfile" type="file" multiple accept=".log,.txt,.jsonl,.json"></label><button id="hwexport" disabled>Export CSV</button><button id="hwclear">Clear</button></div><p id="hwmessage" class="hwinfo" role="status">Connect the main ESP32 or ground LoRa receiver using Chrome/Edge Web Serial, or import an SD .log file. No device readings are sent to Render.</p><div class="hwgrid">'+[['t','TMP102 temperature'],['v','INA219 5V bus'],['i','INA219 current'],['p','INA219 power'],['l','LDR raw light ADC'],['a','MPU6050 acceleration X/Y/Z'],['g','MPU6050 gyro X/Y/Z'],['n','Sample and validity mask']].map(x=>'<div class="hwm"><small>'+x[1]+'</small><b id="hwr'+x[0]+'">—</b></div>').join('')+'</div><p class="hwinfo"><b>Origin:</b> <span id="hworigin">None</span> · <b>Age:</b> <span id="hwage">Never</span> · <span id="hwcount">0 samples</span>. Sensor fields are real only when received from the ESP32 or imported from SD. Orbit simulation runs independently. If firmware reports solar, battery, LoRa, camera or SD data, their ACTUAL measurements appear beside the orbit model states. Voltage/current/power describe the monitored 5 V rail, not the battery state of charge. Clock, radio and camera availability depend on your firmware. Unreported values remain unavailable.</p><details><summary>Recent received samples</summary><div style="overflow:auto"><table><thead><tr><th>Source</th><th>Boot</th><th>Sample</th><th>Temp °C</th><th>Bus V</th><th>Current mA</th><th>Power mW</th><th>LDR</th><th>Valid</th></tr></thead><tbody id="hwtable"></tbody></table></div></details><details id="hwSerialDebug"><summary>USB diagnostics · last raw serial line</summary><p id="hwSerialCounts" class="hwinfo">0 serial lines received · 0 ignored</p><pre id="hwSerialRaw" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;padding:10px;background:#071b2e;color:#d6ecf4">No serial data received yet</pre><p class="hwinfo">Send one packet per newline. JSON, supported seven-field CSV and sensor key=value lines use the same parser as Mission Control. Rejected packets show a reason below. Close Serial Monitor before connecting in the browser.</p></details></div>';
(document.getElementById('page-comms')||document.querySelector('main')||document.body).append(el);
const nav=document.querySelector('header nav');if(nav){const a=document.createElement('a');a.href='#espHw';a.textContent='ESP32 telemetry';nav.append(a)}
$('hwopen').onclick=connect;$('hwclose').onclick=disconnect;$('hwfile').onchange=importLog;$('hwexport').onclick=exportCSV;$('hwclear').onclick=()=>{rows=[];keys.clear();last=0;window.ULTRON_HW_LATEST=null;window.ULTRON_HW_PREVIOUS=null;window.UltronApp?.clearTelemetry?.();render()};render();setInterval(age,3000)}


function msg(t){if($('hwmessage'))$('hwmessage').textContent=t;if(/failed|error|ignored|unavailable/i.test(t)&&$('hwSerialDebug'))$('hwSerialDebug').open=true}
function showSample(t){
 const origin=t.transport==='REPLAY'?'SD log':t.transport;
 const p=t.power,a=t.accelerometer,g=t.gyroscope;
 const r={...t.raw,power:{...t.raw?.power,...p},environment:{...t.raw?.environment,...t.environment},light:{...t.raw?.light,...t.light},
  solar:{...t.solar},battery:{...t.battery},eps:{...t.eps},lora:{...t.raw?.lora,...t.lora},camera:{...t.raw?.camera,...t.camera},storage:{...t.raw?.storage,...t.storage},
  b:t.boot,n:t.sequence??++sampleSequence,ms:t.uptime_ms,t:t.environment.temperature_C,v:p.bus_voltage,i:p.current_mA,
  p:p.power_mW??(p.bus_voltage!==null&&p.current_mA!==null?p.bus_voltage*p.current_mA:null),l:t.light.light1,
  ax:a.x===null?null:a.x/9.80665,ay:a.y===null?null:a.y/9.80665,az:a.z===null?null:a.z/9.80665,gx:g.x,gy:g.y,gz:g.z,origin,when:t.received_at};
 r.ok=(r.t!==null?1:0)|([r.v,r.i,r.p].some(x=>x!==null)?2:0)|([r.ax,r.ay,r.az,r.gx,r.gy,r.gz].some(x=>x!==null)?4:0);
 rows.push(r);if(rows.length>2000)rows.shift();if(origin!=='SD log')last=r.when;
 const snapshot={packet:r,raw:t.raw,origin,when:r.when};window.ULTRON_HW_PREVIOUS=window.ULTRON_HW_LATEST||null;window.ULTRON_HW_LATEST=snapshot;
 render();document.dispatchEvent(new CustomEvent('ultron:hardware-sample',{detail:snapshot}));
}
document.addEventListener('ultron:normalized-sample',e=>{if(['USB','WIFI','REPLAY'].includes(e.detail.transport))showSample(e.detail)});
document.addEventListener('ultron:serial-line',e=>{
 receivedLines++;if($('hwSerialRaw'))$('hwSerialRaw').textContent=e.detail.transport+': '+e.detail.line.slice(0,4000);counts();
});
document.addEventListener('ultron:packet-result',e=>{if(!e.detail.accepted){rejectedLines++;msg('Ignored packet: '+e.detail.reason)}else msg('Receiving '+e.detail.transport+' telemetry.');counts()});
document.addEventListener('ultron:transport-reset',()=>{last=0;window.ULTRON_HW_LATEST=null;window.ULTRON_HW_PREVIOUS=null;age()});
function counts(){if($('hwSerialCounts'))$('hwSerialCounts').textContent=receivedLines+' lines received · '+rejectedLines+' rejected'}
function render(){
 if(!$('espHw'))return;const r=rows.at(-1),ok=r?.ok||0;const set=(k,v)=>$('hwr'+k).textContent=v;
 set('t',ok&1?val(r.t)+' °C':'—');set('v',ok&2?val(r.v)+' V':'—');set('i',ok&2?val(r.i,1)+' mA':'—');set('p',ok&2?val(r.p,1)+' mW':'—');set('l',r?val(r.l,0):'—');
 set('a',ok&4?[r.ax,r.ay,r.az].map(x=>val(x)).join(' / ')+' g':'—');set('g',ok&4?[r.gx,r.gy,r.gz].map(x=>val(x)).join(' / ')+' °/s':'—');set('n',r?r.n+' · '+r.ok+'/7':'—');
 $('hworigin').textContent=r?.origin||'None';$('hwcount').textContent=rows.length+' samples';$('hwexport').disabled=!rows.length;
 $('hwtable').replaceChildren();for(const x of rows.slice(-12).reverse()){const tr=document.createElement('tr');for(const v of [x.origin,x.b??'—',x.n,val(x.t),val(x.v),val(x.i),val(x.p),val(x.l,0),x.ok+'/7']){const td=document.createElement('td');td.textContent=v;tr.append(td)}$('hwtable').append(tr)}age();
}
function age(){
 if(!$('hwage'))return;const app=window.UltronApp,r=rows.at(-1),usb=!!app?.usbConnected?.(),wifi=!!app?.isConnected?.('WIFI');connected=usb||wifi;
 $('hwopen').disabled=usb||['connecting','disconnecting'].includes(app?.usbState?.());$('hwclose').disabled=!usb&&app?.usbState?.()!=='connecting';
 $('hwage').textContent=r?(r.origin==='SD log'?'Historical log':Math.max(0,Math.round((Date.now()-r.when)/1000))+' s ago'):'Never';
 const transport=r?.origin==='WIFI'?'WIFI':'USB',active=transport==='USB'?usb:wifi,limit=window.MC4?.staleMs?.()||90000;
 $('hwconn').textContent=!connected?'Not connected':!last||!r||r.origin==='SD log'||!active?(usb?'USB':'WIFI')+' open · awaiting data':Date.now()-r.when>limit?transport+' open · data stale':transport+' live readings';
}
async function connect(){
 if(!window.UltronApp?.connectUSB){msg('Main dashboard unavailable. Reload the hosted dashboard.');return}
 if(!navigator.serial||!window.isSecureContext){msg('Web Serial unavailable. Use desktop Chrome/Edge on HTTPS or localhost, or import a log.');return}
 msg('Select the USB receiver at 115200 baud. Close Serial Monitor first.');
 try{await window.UltronApp.connectUSB()}catch(e){msg('USB connection failed: '+e.message)}finally{age()}
}
async function disconnect(){await window.UltronApp?.disconnectUSB?.();msg('USB disconnected; previous readings retained.');age()}
async function importLog(e){
 const files=[...e.target.files];e.target.value='';if(window.UltronApp?.hasHardware()){msg('Disconnect hardware before importing historical logs.');return}
 let accepted=0,rejected=0,reason='';for(const f of files){
  if(f.size>20*1024*1024){reason=f.name+' exceeds 20 MB';rejected++;continue}
  try{const text=await f.text();let packets;
   try{const json=JSON.parse(text);packets=Array.isArray(json)?json:[json]}catch{packets=text.split(/\r?\n/).filter(x=>x.trim())}
   for(const packet of packets){try{const t=window.UltronCore.normalize(packet,'REPLAY');window.UltronApp.acceptReplay(t);accepted++;if(accepted%100===0)await new Promise(resolve=>setTimeout(resolve,0))}catch(err){rejected++;reason=err.message}}
  }catch(err){rejected++;reason=err.message}
 }
 msg('Imported '+accepted+' historical readings; '+rejected+' rejected.'+(reason?' Last reason: '+reason:''));
}
function exportCSV(){
 if(!rows.length)return;const cols=['when','origin','b','n','ms','ok','t','v','i','p','ax','ay','az','gx','gy','gz','l'];
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const lines=[cols.join(','),...rows.map(r=>cols.map(k=>quote(k==='when'?new Date(r.when).toISOString():r[k])).join(','))];
 const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='ultron_telemetry.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
