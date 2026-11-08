(()=>{'use strict';if(window.__ultronHW)return;window.__ultronHW=true;
let port,reader,stopping=false,buf='',rows=[],keys=new Set(),last=0,connected=false,receivedLines=0,rejectedLines=0;
const $=x=>document.getElementById(x), val=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
function init(){const style=document.createElement('style');style.textContent='#espHw{margin:20px 0;color:#edf8ff;scroll-margin-top:78px}#espHw .hwbox{border:1px solid #3b7899;border-radius:20px;background:linear-gradient(130deg,#0c263e,#091a30);padding:18px}#espHw .hwtools{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}#espHw button,#espHw label{border:1px solid #4384aa;background:#164562;border-radius:10px;padding:9px 12px;color:#ecf8ff;cursor:pointer;font-size:13px}#espHw button:disabled{opacity:.4}#espHw label input{display:none}#espHw .hwgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin:15px 0}#espHw .hwm{background:#103550;border:1px solid #325f7c;border-radius:12px;padding:13px;min-width:0}#espHw .hwm small{display:block;color:#a9d4eb;margin-bottom:7px}#espHw .hwm b{font-size:20px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}#espHw .hwinfo{font-size:12px;color:#b1cfdd;line-height:1.65}#espHw table{border-collapse:collapse;font-size:12px;min-width:650px}#espHw td,#espHw th{border-bottom:1px solid #31516b;padding:7px}@media(max-width:700px){#espHw .hwgrid{grid-template-columns:repeat(2,minmax(0,1fr))}#espHw .hwm b{font-size:17px}}';document.head.append(style);
const el=document.createElement('section');el.id='espHw';el.innerHTML='<div class="hwbox"><h2>ESP32 CubeSat · Live Hardware Readings</h2><div class="hwtools"><span id="hwconn">Not connected</span><button id="hwopen">Connect USB (115200)</button><button id="hwclose" disabled>Disconnect</button><label>Import SD .log<input id="hwfile" type="file" multiple accept=".log,.txt,.jsonl,.json"></label><button id="hwexport" disabled>Export CSV</button><button id="hwclear">Clear</button></div><p id="hwmessage" class="hwinfo" role="status">Connect the main ESP32 or ground LoRa receiver using Chrome/Edge Web Serial, or import an SD .log file. No device readings are sent to Render.</p><div class="hwgrid">'+[['t','TMP102 temperature'],['v','INA219 5V bus'],['i','INA219 current'],['p','INA219 power'],['l','LDR raw light ADC'],['a','MPU6050 acceleration X/Y/Z'],['g','MPU6050 gyro X/Y/Z'],['n','Sample and validity mask']].map(x=>'<div class="hwm"><small>'+x[1]+'</small><b id="hwr'+x[0]+'">—</b></div>').join('')+'</div><p class="hwinfo"><b>Origin:</b> <span id="hworigin">None</span> · <b>Age:</b> <span id="hwage">Never</span> · <span id="hwcount">0 samples</span>. Sensor fields are real only when received from the ESP32 or imported from SD. Orbit simulation runs independently. If firmware reports solar, battery, LoRa, camera or SD data, their ACTUAL measurements appear beside the orbit model states. Voltage/current/power describe the monitored 5 V rail, not the battery state of charge. The firmware has no absolute-time clock or network uplink. Camera images are saved to SD separately.</p><details><summary>Recent received samples</summary><div style="overflow:auto"><table><thead><tr><th>Source</th><th>Boot</th><th>Sample</th><th>Temp °C</th><th>Bus V</th><th>Current mA</th><th>Power mW</th><th>LDR</th><th>Valid</th></tr></thead><tbody id="hwtable"></tbody></table></div></details><details id="hwSerialDebug"><summary>USB diagnostics · last raw serial line</summary><p id="hwSerialCounts" class="hwinfo">0 serial lines received · 0 ignored</p><pre id="hwSerialRaw" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;padding:10px;background:#071b2e;color:#d6ecf4">No serial data received yet</pre><p class="hwinfo">The current firmware must output newline-delimited JSON packets. Plain Arduino Serial Monitor text can be seen here but cannot become live sensor values. Close Serial Monitor before connecting in the browser.</p></details></div>';
const anchor=document.querySelector('main > .oobanner')||document.querySelector('main > section');if(anchor?.parentNode)anchor.after(el);else(document.querySelector('main')||document.body).prepend(el);
const nav=document.querySelector('header nav');if(nav){const a=document.createElement('a');a.href='#espHw';a.textContent='ESP32 telemetry';nav.append(a)}
$('hwopen').onclick=connect;$('hwclose').onclick=disconnect;$('hwfile').onchange=importLog;$('hwexport').onclick=exportCSV;$('hwclear').onclick=()=>{rows=[];keys.clear();render()};render();setInterval(age,3000)}

let extendedSequence=0;
function deep(o,ks){
 let v=o;
 for(const k of ks)v=v&&typeof v==="object"?v[k]:undefined;
 return typeof v==="number"&&Number.isFinite(v)?v:null;
}
function consume(line,origin){
 if(origin==="USB"){
  receivedLines++;
  const raw=$("hwSerialRaw"),status=$("hwSerialCounts");
  if(raw)raw.textContent=String(line).slice(0,2000)||"(empty line)";
  if(status)status.textContent=receivedLines+" lines received · "+rejectedLines+" ignored";
 }
 line=line.trim();if(!line.startsWith("{")||line.length>8192)return false;
 let r;try{r=JSON.parse(line)}catch{return false}
 if(!r||Array.isArray(r)||typeof r!=="object")return false;
 const oldValid=Number.isSafeInteger(r.b)&&Number.isSafeInteger(r.n)&&Number.isSafeInteger(r.ms)&&Number.isInteger(r.ok)&&r.n>=1&&r.ok>=0&&r.ok<=7;
 const extended=r.type==="telemetry"&&["solar","battery","eps","lora","sd","camera","power","environment","light","imu"].some(k=>r[k]&&typeof r[k]==="object"&&!Array.isArray(r[k]));
 if(!oldValid&&!extended)return false;
 for(const k of ["t","v","i","p","ax","ay","az","gx","gy","gz","l","sv","si","sp","bv","bi","bpct"]){
  if(r[k]!=null&&(typeof r[k]!=="number"||!Number.isFinite(r[k])))return false;
 }
 for(const k of ["solar","battery","eps","lora","sd","camera","power","environment","light","imu","sht31","storage"]){
  const obj=r[k];if(obj==null)continue;
  if(typeof obj!=="object"||Array.isArray(obj))return false;
  for(const val of Object.values(obj))if(val!=null&&(typeof val!=="number"&&typeof val!=="boolean"&&typeof val!=="string"||typeof val==="number"&&!Number.isFinite(val)||typeof val==="string"&&val.length>120))return false;
 }
 if(!oldValid){
  r.b=Number.isSafeInteger(r.b)?r.b:0;
  r.n=Number.isSafeInteger(r.n)&&r.n>0?r.n:++extendedSequence;
  r.ms=Number.isSafeInteger(r.ms)?r.ms:0;
  if(r.t==null)r.t=deep(r,["environment","temperature_C"]);
  if(r.v==null)r.v=deep(r,["power","bus_voltage"]);
  if(r.i==null)r.i=deep(r,["power","current_mA"]);
  if(r.p==null)r.p=deep(r,["power","power_mW"]);
  if(r.l==null)r.l=deep(r,["light","light1"]);
  r.ok=(r.t!=null?1:0)|((r.v!=null||r.i!=null||r.p!=null)?2:0)|((r.ax!=null&&r.ay!=null&&r.az!=null)?4:0);
 }
 const key=oldValid?r.b+":"+r.n+":"+r.ms:origin+":ext:"+r.n+":"+line.slice(0,100);
 if(keys.has(key))return false;
 keys.add(key);r.__key=key;r.origin=origin;r.when=Date.now();
 rows.push(r);
 if(rows.length>2000){const drop=rows.shift();keys.delete(drop.__key||drop.b+":"+drop.n+":"+drop.ms)}
 if(origin==="USB")last=Date.now();
 const snap={packet:r,origin:origin,when:r.when};
 window.ULTRON_HW_PREVIOUS=window.ULTRON_HW_LATEST||null;
 window.ULTRON_HW_LATEST=snap;
 render();syncMissionControl(r);
 document.dispatchEvent(new CustomEvent("ultron:hardware-sample",{detail:snap}));
 return true;
}
/*
 * Bridge the compact firmware packet into the original Mission Control's
 * typed telemetry store. No virtual readings are invented.
 * The original Mission Control's command channel stays disconnected;
 * this sync is read-only and never enables hardware command buttons.
 */
function syncMissionControl(r){
 if(!r||!window.UltronApp||!window.UltronCore?.normalize)return;
 const app=window.UltronApp;
 // The original controller owns its own live native USB/Wi-Fi connection.
 if(typeof app.hasHardware==='function'&&app.hasHardware())return;
 const valid=(key,bit)=>!!(r.ok&bit)&&Number.isFinite(r[key])?r[key]:null;
 const validSimple=key=>Number.isFinite(r[key])?r[key]:null;
 const live=r.origin==='USB';
 const typed={
  type:'telemetry',version:1,
  mode:null,firmware:null,uptime_ms:validSimple('ms'),
  environment:{temperature_C:valid('t',1),humidity_percent:null,sensor:null},
  power:{bus_voltage:valid('v',2),current_mA:valid('i',2),
         battery_voltage:null,solar_voltage:null,battery_percent:null,charging:null},
  light:{light1:validSimple('l'),light2:null,unit:'raw ADC'},
  accelerometer:{x:valid('ax',4)==null?null:r.ax*9.80665,
                 y:valid('ay',4)==null?null:r.ay*9.80665,
                 z:valid('az',4)==null?null:r.az*9.80665},
  gyroscope:{x:valid('gx',4),y:valid('gy',4),z:valid('gz',4)},
  imu:{state:(r.ok&4)?'REPORTED':'UNAVAILABLE'},
  lora:{state:'UNAVAILABLE'},
  camera:{state:'UNAVAILABLE'},
  storage:{state:'UNAVAILABLE'},
  wifi:{state:'UNAVAILABLE'}
 };
 try{
  const normalized=window.UltronCore.normalize(typed,live?'USB':'REPLAY',r.when||Date.now());
  // Treat as separate read-only USB panel or historical log. The native
  // firmware-v1 connection and device command permissions remain unaffected.
  app.telemetry=normalized;
  if(app.settings?.logging&&Array.isArray(app.records)){
   app.records.push(normalized);if(app.records.length>300)app.records.shift();
  }
  window.MC4?.render?.(1);
  const note=document.getElementById('sensorAvailability');
  if(note){
   note.textContent=live
    ?'Read-only USB telemetry synchronized from ESP32 Hardware Readings. Unreported fields remain NOT MEASURED. Native command link is not connected.'
    :'Historical SD telemetry synchronized for review. These are NOT LIVE readings. Unreported fields remain NOT MEASURED.';
  }
 }catch(error){console.warn('ULTRON telemetry main-card sync skipped',error)}
}
function render(){if(!$('espHw'))return;const r=rows.at(-1),ok=r?.ok||0;const set=(k,v)=>$('hwr'+k).textContent=v;set('t',ok&1?val(r.t)+' °C':'—');set('v',ok&2?val(r.v)+' V':'—');set('i',ok&2?val(r.i,1)+' mA':'—');set('p',ok&2?val(r.p,1)+' mW':'—');set('l',r?val(r.l,0):'—');set('a',ok&4?[r.ax,r.ay,r.az].map(x=>val(x)).join(' / ')+' g':'—');set('g',ok&4?[r.gx,r.gy,r.gz].map(x=>val(x)).join(' / ')+' °/s':'—');set('n',r?r.n+' · '+r.ok+'/7':'—');$('hworigin').textContent=r?.origin||'None';$('hwcount').textContent=rows.length+' samples';$('hwexport').disabled=!rows.length;$('hwtable').innerHTML=rows.slice(-12).reverse().map(x=>'<tr><td>'+x.origin+'</td><td>'+x.b+'</td><td>'+x.n+'</td><td>'+val(x.t)+'</td><td>'+val(x.v)+'</td><td>'+val(x.i)+'</td><td>'+val(x.p)+'</td><td>'+val(x.l,0)+'</td><td>'+x.ok+'/7</td></tr>').join('');age()}
function age(){if(!$('hwage'))return;const r=rows.at(-1);$('hwage').textContent=r?(r.origin==='SD log'?'Historical log':Math.round((Date.now()-r.when)/1000)+' s ago'):'Never';$('hwconn').textContent=!connected?'Not connected':!last?'USB open · awaiting data':Date.now()-last>90000?'USB open · data stale':'USB live readings'}
function msg(t){if($('hwmessage'))$('hwmessage').textContent=t;const d=$("hwSerialDebug");if(d&&/failed|error|not supported|cancelled/i.test(t))d.open=true}
async function connect(){if(connected)return;if(!navigator.serial){msg('Web Serial not supported: use desktop Chrome/Edge on HTTPS or import SD logs.');return}try{port=await navigator.serial.requestPort();await port.open({baudRate:115200});connected=true;stopping=false;$('hwopen').disabled=true;$('hwclose').disabled=false;buf='';last=0;msg('USB connected. Awaiting newline JSON sensor packets (up to 30 seconds per sample).');age();let decoder=new TextDecoder();while(port?.readable&&!stopping){reader=port.readable.getReader();try{while(!stopping){const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});if(buf.length>16000)buf=buf.slice(-3000);const lines=buf.split(/\r?\n/);buf=lines.pop()||'';for(const line of lines){
  if(!consume(line,'USB')){
   rejectedLines++;
   const status=$("hwSerialCounts");
   if(status)status.textContent=receivedLines+" lines received · "+rejectedLines+" ignored";
  }
 }}}catch(e){if(!stopping)msg('Serial error: '+e.message)}finally{try{reader.releaseLock()}catch{}reader=null}break}}catch(e){msg(e.name==='NotFoundError'?'Connection cancelled':'Connection failed: '+e.message)}finally{const p=port;port=null;connected=false;if(p)try{await p.close()}catch{}if($('hwopen')){$('hwopen').disabled=false;$('hwclose').disabled=true}age()}}
async function disconnect(){stopping=true;if(reader)try{await reader.cancel()}catch{}msg('Disconnected; imported and previous samples are retained until cleared.')}
async function importLog(e){let n=0,errs=[];for(const f of [...e.target.files]){if(f.size>20*1024*1024){errs.push(f.name+' exceeds 20MB');continue}try{for(const line of (await f.text()).split(/\r?\n/))if(consume(line,'SD log'))n++}catch(err){errs.push(err.message)}}e.target.value='';msg('Imported '+n+' historical readings. '+errs.join('; '))}
function exportCSV(){if(!rows.length)return;const cols=['when','origin','b','n','ms','ok','t','v','i','p','ax','ay','az','gx','gy','gz','l'];const a=[cols.join(',')];for(const r of rows)a.push(cols.map(k=>r[k]==null?'':JSON.stringify(k==='when'?new Date(r[k]).toISOString():r[k])).join(','));const url=URL.createObjectURL(new Blob([a.join('\r\n')],{type:'text/csv'})),link=document.createElement('a');link.href=url;link.download='ultron_esp32_telemetry.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();