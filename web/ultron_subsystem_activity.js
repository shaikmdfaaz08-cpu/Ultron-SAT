/* ULTRON-SAT: orbit-synchronized component monitor, read-only.
   The 3D orbit/EPS is simulated. Values shown as hardware readings come
   only from the existing, validated ESP32 USB/SD telemetry interface.
   This module never sends commands or creates synthetic sensor values. */
(function(){
"use strict";
if(window.__ultronSubsystemActivity)return;
window.__ultronSubsystemActivity=true;
var $=function(id){return document.getElementById(id);};
var PARTS=[
 ["solar","☀","Solar arrays","MODEL VS HARDWARE"],
 ["eps","⚡","Power controller / EPS","3D SIMULATION"],
 ["battery","▰","Battery reserve","3D SIMULATION"],
 ["obc","▦","Onboard computer","OPERATING MODE · SIMULATED"],
 ["camera","◉","ESP32-CAM","PAYLOAD MODE · SIMULATED"],
 ["temp","♨","TMP102 temperature","ESP32 SENSOR"],
 ["ina","⌁","INA219 bus monitor","ESP32 SENSOR"],
 ["imu","⌖","MPU6050 IMU","ESP32 SENSOR"],
 ["ldr","☼","LDR light sensor","ESP32 SENSOR"],
 ["lora","⇶","LoRa radio link","HARDWARE IF REPORTED"],
 ["storage","▤","SD image storage","NOT TELEMETRIED"]
];
function makePanel(place){
 var root=document.createElement("section");
 root.className="usm-panel";
 root.id="usm-"+place;
 root.setAttribute("aria-label","ULTRON-SAT component status synchronized with orbit and ESP32 readings");
 root.innerHTML='<div class="usm-head"><div><div class="usm-eyebrow">CUBESAT COMPONENT ACTIVITY · ORBIT MODEL + ACTUAL READINGS</div><h3>Which systems are operating?</h3><p>90-minute scheduled ON/OFF states follow the 3D orbit. Actual readings are shown alongside each component, independently.</p></div><span class="usm-sim-tag">MODEL + HARDWARE · LABELLED</span></div>'
 +'<div class="usm-mission"><div><small>Orbit condition</small><strong data-summary="orbit">Waiting for rotation…</strong></div><div><small>Estimated solar generation</small><strong data-summary="power">—</strong></div><div><small>Simulated battery</small><strong data-summary="battery">—</strong></div><div><small>ESP32 data source</small><strong data-summary="source">Not connected</strong></div></div>'
 +'<div class="usm-flow"><span data-flow="solar">Solar</span><i>→</i><span data-flow="eps">EPS</span><i>⇄</i><span data-flow="battery">Battery</span><i>→</i><span data-flow="payload">Payload</span></div>'
 +'<div class="usm-grid">'+PARTS.map(function(p){return '<article class="usm-part" data-part="'+p[0]+'" data-state="unknown"><div class="usm-part-title"><span class="usm-part-icon" aria-hidden="true">'+p[1]+'</span><div class="usm-part-name"><b>'+p[2]+'</b><small>'+p[3]+'</small></div></div><div class="usm-part-state"><span class="usm-led" aria-hidden="true"></span><strong class="usm-status">UNKNOWN</strong></div><p class="usm-detail">Awaiting data</p></article>';}).join('')+'</div>'
 +'<div class="usm-bottom"><span data-summary="freshness">No sensor sample received</span><a href="#espHw">View USB connection, all sensor readings and SD logs</a></div>'
 +'<p class="usm-note">MODEL ON/OFF follows the 90-minute duty-cycle demonstration and does not control real components. ACTUAL data comes only from ESP32 USB/SD packets. Solar watts require a solar-panel electrical reading; LDR light is not solar watts. INA219 measures its monitored rail, not automatically battery SOC. SD imports are historical, and missing battery, LoRa, camera or storage fields stay unverified. Read-only; no hardware commands.</p>';
 return root;
}
function css(){
 if($("usm-style"))return;
 var style=document.createElement("style");style.id="usm-style";
 style.textContent=[
 '.usm-panel,.usm-panel *{box-sizing:border-box}',
 '.usm-timeline{display:flex;gap:4px;flex-wrap:wrap;margin:10px 0 14px}.usm-timeline span{padding:7px 8px;font-size:10px;border-radius:7px;background:#15334a;border:1px solid #325875;color:#b2cbdc}.usm-timeline span[data-active="true"]{background:#12645e;color:#fff;border-color:#62dbc8}.usm-packet{font-size:11px;color:#add9e7;margin:12px 0}.usm-packet summary{cursor:pointer}.usm-packet pre{max-height:210px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;background:#071827;border-radius:8px;border:1px solid #2c5068}',
 '.usm-panel{font-family:system-ui,-apple-system,sans-serif;color:#ecf9ff;min-width:0;margin:15px 0 21px;padding:18px;background:linear-gradient(145deg,#0b2338 10%,#071829 90%);border:1px solid #416c85;border-radius:18px;box-shadow:0 12px 27px #0003}',
 '.usm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
 '.usm-head h3{margin:4px 0;font-size:20px;line-height:1.2;color:#f5fcff}',
 '.usm-head p{margin:5px 0 12px;color:#a9c9dd;font-size:12px;line-height:1.45}',
 '.usm-eyebrow{font-size:10px;color:#65eadc;font-weight:800;letter-spacing:.08em}',
 '.usm-sim-tag{border:1px solid #a28c537d;color:#ffdf9f;border-radius:99px;font-size:10px;font-weight:700;padding:8px 10px;white-space:normal}',
 '.usm-mission{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:11px 0}',
 '.usm-mission>div{min-width:0;padding:11px 12px;border:1px solid #436b8580;border-radius:11px;background:#112e43}',
 '.usm-mission small{display:block;font-size:10px;color:#a4c5d8;margin-bottom:6px}',
 '.usm-mission strong{display:block;font-size:13px;line-height:1.35;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}',
 '.usm-flow{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;padding:8px 0 16px}',
 '.usm-flow span{border-radius:8px;padding:7px 12px;border:1px solid #456078;background:#122c40;font-size:11px;font-weight:700;color:#d5e3ee;transition:background .4s,border-color .4s}',
 '.usm-flow span[data-state="on"]{background:#104a46;border-color:#3ed6ba;color:#c4fff3}',
 '.usm-flow span[data-state="off"]{background:#4e3e27;border-color:#c69c54;color:#ffdfaf}',
 '.usm-flow i{font-style:normal;font-size:16px;color:#6da1b5}',
 '.usm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}',
 '.usm-part{min-width:0;background:linear-gradient(145deg,#113248,#0d263b);border:1px solid #315873;border-radius:12px;padding:12px;transition:border-color .4s,background .4s}',
 '.usm-part[data-state="on"]{border-color:#2ba993a6;background:linear-gradient(145deg,#103a43,#112b3c)}',
 '.usm-part[data-state="off"]{border-color:#bc9456b0;background:linear-gradient(145deg,#3b332b,#192b3b)}',
 '.usm-part[data-state="stale"]{border-color:#977d63a0}',
 '.usm-part-title{display:flex;gap:9px;align-items:flex-start}',
 '.usm-part-icon{font-size:22px;line-height:1;flex:0 0 26px;color:#85d9ef}',
 '.usm-part-name{min-width:0}.usm-part-name b{display:block;font-size:12px;line-height:1.3;overflow-wrap:anywhere}',
 '.usm-part-name small{display:block;margin-top:3px;color:#8facbf;font-size:9px;line-height:1.3}',
 '.usm-part-state{display:flex;align-items:center;gap:7px;margin:11px 0 4px}',
 '.usm-led{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:#8195a4}',
 '.usm-part[data-state="on"] .usm-led{background:#55ebbd;box-shadow:0 0 9px #55ebbd77}',
 '.usm-part[data-state="off"] .usm-led{background:#ffd080}',
 '.usm-part[data-state="stale"] .usm-led{background:#e1a56d}',
 '.usm-status{font-size:12px;letter-spacing:.015em;overflow-wrap:anywhere}',
 '.usm-detail{color:#b2cede;font-size:11px;line-height:1.5;margin:5px 0 0;overflow-wrap:anywhere}',
 '.usm-bottom{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap;font-size:12px;color:#bedbec}',
 '.usm-bottom a{color:#79dcf5;text-decoration:underline;text-underline-offset:3px}',
 '.usm-note{color:#a1bbca;font-size:10px;line-height:1.6;margin:12px 0 0}',
 '@media(max-width:1050px){.usm-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
 '@media(max-width:760px){.usm-panel{padding:13px;margin:10px 0 18px}.usm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.usm-mission{grid-template-columns:repeat(2,minmax(0,1fr))}.usm-head h3{font-size:17px}}',
 '@media(max-width:460px){.usm-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.usm-part{padding:10px}.usm-part-title{gap:5px}.usm-part-icon{font-size:18px;flex-basis:19px}.usm-part-name b{font-size:11px}.usm-mission>div{padding:9px}.usm-mission strong{font-size:11px}.usm-flow{gap:4px}.usm-flow span{padding:6px 7px;font-size:10px}.usm-flow i{font-size:11px}}',
 '@media(prefers-reduced-motion:reduce){.usm-part,.usm-flow span{transition:none}}'
 ].join("\n");
 document.head.appendChild(style);
}
function text(id){return ($(id)?.textContent||"").trim();}
function field(id){var v=text(id);return v&&v!=="—"?v:"";}
function setSummary(root,k,t){var e=root.querySelector('[data-summary="'+k+'"]');if(e&&e.textContent!==t)e.textContent=t;}
function part(root,id,state,label,detail){
 var el=root.querySelector('[data-part="'+id+'"]');if(!el)return;
 el.dataset.state=state;
 var s=el.querySelector(".usm-status"),d=el.querySelector(".usm-detail");
 if(s.textContent!==label)s.textContent=label;
 if(d.textContent!==detail)d.textContent=detail;
}
function telem(){
 var origin=text("hworigin"),connection=text("hwconn"),ageText=text("hwage"),ageMatch=ageText.match(/^(\d+)\s*s ago$/);
 var seconds=ageMatch?Number(ageMatch[1]):Infinity;
 var live=origin==="USB" && connection==="USB live readings" && seconds<=90;
 var historic=origin==="SD log";
 var stale=origin==="USB"&&!live;
 var source=live?"LIVE USB":historic?"SD LOG · HISTORICAL":stale?"USB · STALE":"NOT CONNECTED";
 var stamp=live?"Live reading · "+ageText:historic?"Historical SD recording":stale?"Last USB reading · "+ageText:"No current hardware telemetry";
 return {origin:origin,live:live,historic:historic,stale:stale,source:source,stamp:stamp,
  t:field("hwrt"),v:field("hwrv"),i:field("hwri"),p:field("hwrp"),l:field("hwrl"),a:field("hwra"),g:field("hwrg")};
}
function reading(root,id,found,label,data,t){
 var state=t.live?(found?"on":"unknown"):t.historic?(found?"stale":"unknown"):t.stale?(found?"stale":"unknown"):"unknown";
 var status=t.live?(found?"REPORTING":"NOT REPORTED"):t.historic?(found?"RECORDED":"NOT IN LOG"):t.stale?(found?"LAST SAMPLE":"NO LIVE DATA"):"NO LIVE DATA";
 part(root,id,state,status,found?label+data+(t.live?" · LIVE":t.historic?" · SD LOG":" · NOT CURRENT"):"No validated value available");
}

/* Physical telemetry never follows the simulated orbit or overwrites its values. */
const PLAN=[
 {name:"SUN POINTING",duration:40,active:["obc","ina","imu","ldr","temp","solar","eps","battery"]},
 {name:"NADIR / PAYLOAD",duration:3,active:["obc","ina","camera","imu","temp","eps","battery","storage"]},
 {name:"GROUND STATION",duration:7,active:["obc","ina","imu","lora","temp","eps","battery","storage"]},
 {name:"SAFE / ECLIPSE",duration:40,active:["obc","ina","temp","eps","battery"]}
];
const activeMin={solar:40,eps:90,battery:90,obc:90,camera:3,temp:90,ina:90,imu:50,ldr:40,lora:7,storage:10};
function get(p,alternatives){
 for(const ks of alternatives){
  let v=p;for(const k of ks)v=v!=null?v[k]:null;
  if(typeof v==="number"&&Number.isFinite(v)||typeof v==="boolean")return v;
 }
 return null;
}
function fmt(v,d=2){return typeof v==="number"&&Number.isFinite(v)?v.toFixed(d):"—";}
function measured(p,id){
 const getn=(...a)=>get(p,a.map(x=>x.split(".")));
 const pieces=[];
 const add=(val,unit,d=2)=>{if(val!=null)pieces.push(fmt(val,d)+unit);};
 if(id==="solar"){
  add(getn("solar.voltage_v","solar.voltage_V","sv")," V solar");
  add(getn("solar.current_ma","solar.current_mA","si")," mA solar",1);
  add(getn("solar.power_mw","solar.power_mW","sp")," mW solar",1);
  if(!pieces.length){
   const l=getn("l","light.light1","light.adc");
   return l!=null?"No panel voltage/current sensor; LDR light "+fmt(l,0)+" ADC (not panel power)":"No dedicated solar-panel electrical reading sent";
  }
 }else if(id==="battery"){
  add(getn("battery.voltage_v","battery.voltage_V","bv","power.battery_voltage")," V battery");
  add(getn("battery.current_ma","bi")," mA battery",1);
  add(getn("battery.soc_percent","battery.percent","bpct","power.battery_percent"),"% SOC (reported)",1);
  const ch=getn("battery.charging","eps.charging","power.charging");
  if(ch!=null)pieces.push(ch?"Charging reported":"Not charging reported");
 }else if(id==="eps"){
  add(getn("v","power.bus_voltage")," V monitored bus");
  add(getn("i","power.current_mA")," mA monitored bus",1);
  add(getn("p","power.power_mW")," mW monitored bus",1);
  const ch=getn("eps.charging");
  if(ch!=null)pieces.push(ch?"EPS charging reported":"EPS not charging reported");
  const ready=getn("eps.ready","eps.active");
  if(ready!=null)pieces.push(ready?"EPS active reported":"EPS inactive reported");
 }else if(id==="lora"){
  const c=getn("lora.connected","lora.active","lora.ready");
  if(c!=null)pieces.push(c?"LoRa link reported":"LoRa link reported offline");
  add(getn("lora.rssi_dbm","lora.rssi")," dBm RSSI",1);
  add(getn("lora.snr_db","lora.snr")," dB SNR",1);
  const rx=getn("lora.rx_packets","lora.received"),tx=getn("lora.tx_packets","lora.sent");
  if(rx!=null)pieces.push("RX "+rx);if(tx!=null)pieces.push("TX "+tx);
 }else if(id==="camera"){
  const c=getn("camera.ready","camera.active");
  if(c!=null)pieces.push(c?"Camera ready reported":"Camera not ready reported");
  const f=getn("camera.frames","camera.captured");
  if(f!=null)pieces.push(f+" frames reported");
 }else if(id==="storage"){
  const s=getn("sd.mounted","sd.ready","storage.mounted");
  if(s!=null)pieces.push(s?"SD mounted reported":"SD not mounted reported");
  add(getn("sd.free_mb","storage.free_mb")," MB free",1);
  const w=getn("sd.writes","storage.writes");if(w!=null)pieces.push(w+" writes");
 }else if(id==="ina"){
  add(getn("v","power.bus_voltage")," V bus");
  add(getn("i","power.current_mA")," mA bus",1);
  add(getn("p","power.power_mW")," mW bus",1);
 }else if(id==="temp"){
  const ok=p.ok==null||!!(p.ok&1);
  if(ok)add(getn("t","environment.temperature_C","sht31.temperature_c")," °C");
  add(getn("environment.humidity_percent","sht31.humidity_percent"),"% RH",1);
 }else if(id==="ldr"){
  add(getn("l","light.light1","light.adc")," light ADC",0);
 }else if(id==="imu"){
  const ok=p.ok==null||!!(p.ok&4);
  if(ok){
   const ax=getn("ax","imu.ax_g"),ay=getn("ay","imu.ay_g"),az=getn("az","imu.az_g");
   if(ax!=null)pieces.push("Accel "+[ax,ay,az].map(v=>fmt(v)).join("/")+" g");
   const gx=getn("gx","imu.gx_dps"),gy=getn("gy","imu.gy_dps"),gz=getn("gz","imu.gz_dps");
   if(gx!=null)pieces.push("Gyro "+[gx,gy,gz].map(v=>fmt(v)).join("/")+" °/s");
  }
 }else if(id==="obc"){if(p.n!=null)pieces.push("ESP32 sample #"+p.n+" received");}
 return pieces.join(" · ")||"No dedicated field received";
}
function paint(root){
 const raw=window.ULTRON_ORBIT_POWER;
 const valid=raw&&typeof raw.eclipse==="boolean"&&Number.isFinite(raw.phaseDeg);
 const degree=valid?((raw.phaseDeg%360)+360)%360:null;
 const minute=degree==null?null:degree/4;
 const stage=minute==null?-1:minute<40?0:minute<43?1:minute<50?2:3;
 const scenario=stage<0?null:PLAN[stage];
 const snapshot=window.ULTRON_HW_LATEST;
 const packet=snapshot?.packet||null;
 const conn=text("hwconn");
 const age=snapshot?.when?Math.max(0,Math.round((Date.now()-snapshot.when)/1000)):null;
 const live=!!packet&&snapshot.origin==="USB"&&conn==="USB live readings"&&age<=90;
 const log=!!packet&&snapshot.origin==="SD log";
 const physicalSource=live?"LIVE USB":log?"SD LOG · HISTORICAL":packet?"LAST READING · NOT LIVE":"NOT CONNECTED";
 setSummary(root,"orbit",scenario?scenario.name+" · "+minute.toFixed(1)+"/90 min":"AWAITING ROTATION");
 setSummary(root,"power",valid?(raw.eclipse?"3D eclipse":"3D sunlit")+" · model":"3D light —");
 setSummary(root,"battery",text("pm3Charge")?text("pm3Charge")+" · SIM":"—");
 setSummary(root,"source",physicalSource);
 setSummary(root,"freshness",packet?physicalSource+" · "+age+" s since last sample":"No actual telemetry sample received");
 let timeline=root.querySelector(".usm-timeline");
 if(!timeline){
  timeline=document.createElement("div");timeline.className="usm-timeline";
  timeline.innerHTML=PLAN.map((m,i)=>'<span data-idx="'+i+'">'+m.name+' · '+m.duration+'min</span>').join("");
  const grid=root.querySelector(".usm-grid");grid.parentNode.insertBefore(timeline,grid);
 }
 timeline.querySelectorAll("span").forEach(x=>x.dataset.active=Number(x.dataset.idx)===stage?"true":"false");
 const state=(id,on,label,actual)=>part(root,id,on?"on":"off",label,actual);
 for(const item of PARTS){
  const id=item[0],planned=scenario?scenario.active.includes(id):null;
  const status=planned==null?"WAITING":planned?"ON · MODEL":"OFF · MODEL";
  let real=packet?measured(packet,id):"No sensor packet received";
  if(packet){
   real=(live?"LIVE: ":log?"SD LOG (NOT LIVE): ":"LAST PACKET (STALE): ")+real;
  }else real="NOT MEASURED · "+real;
  const el=root.querySelector('[data-part="'+id+'"]');
  if(!el)continue;
  el.dataset.state=planned==null?"unknown":planned?"on":"off";
  el.querySelector(".usm-status").textContent=status;
  el.querySelector(".usm-detail").textContent="ACTUAL · "+real;
  el.querySelector(".usm-part-name small").textContent="Schedule "+(activeMin[id]||0)+"/90 min · model";
 }
 let packetBox=root.querySelector(".usm-packet");
 if(!packetBox){
  packetBox=document.createElement("details");packetBox.className="usm-packet";
  packetBox.innerHTML='<summary>Last actual ESP32 packet (inspect missing fields)</summary><pre></pre>';
  root.querySelector(".usm-bottom").insertAdjacentElement("afterend",packetBox);
 }
 const pre=packetBox.querySelector("pre");
 const key=packet?snapshot.origin+":"+snapshot.when:"none";
 if(packetBox.dataset.packetKey!==key){
  packetBox.dataset.packetKey=key;
  pre.textContent=packet?JSON.stringify(packet,null,2).slice(0,3900):"No packet";
 }
}

function mount(){
 css();
 var orbitAnchor=$("pm3OrbitStatusRow")||$("pm3Panel")||$("solarWorld");
 if(orbitAnchor&&!$("usm-orbit"))orbitAnchor.insertAdjacentElement("afterend",makePanel("orbit"));
 var cadAnchor=$("cadView");
 if(cadAnchor&&!$("usm-cad"))cadAnchor.insertAdjacentElement("afterend",makePanel("cad"));
}
function refresh(){
 mount();
 ["usm-orbit","usm-cad"].forEach(function(id){var root=$(id);if(root)paint(root);});
}
function start(){refresh();setInterval(function(){if(!document.hidden)refresh();},800);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();