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
 ["temp","♨","Temperature / TMP102","ESP32 SENSOR"],
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
 root.innerHTML='<div class="usm-head"><div><div class="usm-eyebrow">ULTRON-SAT · COMPONENT CONSOLE</div><h3>Simulated orbit and real hardware</h3><p>Two separate areas: orbital operating states are modeled; sensor readings are received from the physical ESP32.</p></div><span class="usm-sim-tag">SIMULATION ≠ REAL DATA</span></div>'
 +'<section class="usm-sim-area" aria-label="Simulation only: orbit model and planned component operation"><div class="usm-zone-title"><span class="usm-zone-pill usm-model-pill">01 · SIMULATED</span><h4>Orbit schedule and component operating modes</h4><p>These ON/OFF indicators come from the rotating 3D model, not electronic measurements.</p></div></section>'
 +'<div class="usm-mission"><div><small>Orbit condition</small><strong data-summary="orbit">Waiting for rotation…</strong></div><div><small>Estimated solar generation</small><strong data-summary="power">—</strong></div><div><small>Simulated battery</small><strong data-summary="battery">—</strong></div><div><small>ESP32 data source</small><strong data-summary="source">Not connected</strong></div></div>'
 +'<div class="usm-flow"><span data-flow="solar">Solar</span><i>→</i><span data-flow="eps">EPS</span><i>⇄</i><span data-flow="battery">Battery</span><i>→</i><span data-flow="payload">Payload</span></div>'
 +'<div class="usm-grid">'+PARTS.map(function(p){return '<article class="usm-part" data-part="'+p[0]+'" data-state="unknown"><div class="usm-part-title"><span class="usm-part-icon" aria-hidden="true">'+p[1]+'</span><div class="usm-part-name"><b>'+p[2]+'</b><small>'+p[3]+'</small></div></div><div class="usm-part-state"><span class="usm-led" aria-hidden="true"></span><strong class="usm-status">UNKNOWN</strong></div><p class="usm-detail">Awaiting data</p></article>';}).join('')+'</div>'
 +'<div class="usm-bottom"><span data-summary="freshness">No sensor sample received</span><a href="#espHw">View USB connection, all sensor readings and SD logs</a></div>'
 +'<p class="usm-note">MODEL ON/OFF follows the 90-minute duty-cycle demonstration and does not control real components. ACTUAL data comes only from ESP32 USB/SD packets. Solar watts require a solar-panel electrical reading; LDR light is not solar watts. INA219 measures its monitored rail, not automatically battery SOC. SD imports are historical, and missing battery, LoRa, camera or storage fields stay unverified. Read-only; no hardware commands.</p>';
 // Create two physically separate, bordered regions. Reuse the existing cards
 // for simulated duty-cycle states and create independent measured sensor cards.
 const simulation=root.querySelector(".usm-sim-area");
 const mission=root.querySelector(".usm-mission"),flow=root.querySelector(".usm-flow"),grid=root.querySelector(".usm-grid");
 simulation.append(mission,flow,grid);
 const hardware=document.createElement("section");
 hardware.className="usm-actual-area";
 hardware.setAttribute("aria-label","Physical CubeSat hardware measurements, separate from the orbit simulator");
 hardware.innerHTML='<div class="usm-zone-title"><span class="usm-zone-pill usm-real-pill">02 · ACTUAL HARDWARE</span><h4>Live component and sensor readings</h4><p>Measurements come only from ESP32 USB telemetry. An SD recording is marked historical; missing fields stay unmeasured.</p></div>'
 +'<div class="usm-physical-state"><strong data-real-source>NO DEVICE CONNECTED</strong><span data-real-age>No sample received</span><button type="button" id="usmConnectUSB">Connect USB</button><a href="#espHw">USB diagnostics</a></div>'
 +'<div class="usm-live-power"><div><small>INA219 current · monitored bus</small><strong data-ina-current>— mA</strong></div><div><small>INA219 voltage · monitored bus</small><strong data-ina-voltage>— V</strong></div><div><small>INA219 power · monitored bus</small><strong data-ina-power>— mW</strong></div></div>'
 +'<div class="usm-actual-grid">'+PARTS.map(function(p){return '<article class="usm-actual-part" data-real-part="'+p[0]+'" data-state="unknown"><div class="usm-part-title"><span class="usm-part-icon">'+p[1]+'</span><div class="usm-part-name"><b>'+p[2]+'</b><small>PHYSICAL HARDWARE</small></div></div><strong class="usm-real-status">NO LIVE READING</strong><p class="usm-real-reading">Not measured</p></article>';}).join('')+'</div>';
 root.querySelector(".usm-bottom").insertAdjacentElement("beforebegin",hardware);
 // Card selection is interactive and keyboard accessible, not static decoration.
 for(const area of [simulation,hardware]){
  const tiles=[...area.querySelectorAll(".usm-part,.usm-actual-part")];
  for(let i=0;i<tiles.length;i++){
   const tile=tiles[i];tile.setAttribute("role","button");tile.tabIndex=0;
   tile.dataset.expanded=String(i===0);tile.setAttribute("aria-expanded",String(i===0));
   function toggle(){
    const next=tile.dataset.expanded!=="true";
    for(const other of tiles){other.dataset.expanded="false";other.setAttribute("aria-expanded","false")}
    tile.dataset.expanded=String(next);tile.setAttribute("aria-expanded",String(next));
   }
   tile.addEventListener("click",toggle);
   tile.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle()}});
  }
 }
 const connect=root.querySelector("#usmConnectUSB");
 connect.addEventListener("click",()=>{
  const button=$("hwopen"),status=root.querySelector("[data-real-source]");
  if(!navigator.serial){if(status)status.textContent="USB needs desktop Chrome/Edge on HTTPS";return}
  if(!button){if(status)status.textContent="USB connection panel unavailable";return}
  if(button.disabled){if(status)status.textContent="USB already open — waiting for data";return}
  button.click();
  if(status)status.textContent="Select your ESP32 COM port in the USB chooser";
 });
 return root;
}
function css(){
 if($("usm-style"))return;
 var style=document.createElement("style");style.id="usm-style";
 style.textContent=[
 '.usm-panel,.usm-panel *{box-sizing:border-box}',
 ".usm-panel{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:11px}",
 ".usm-panel>.usm-head,.usm-panel>.usm-bottom,.usm-panel>.usm-packet,.usm-panel>.usm-note{grid-column:1/-1}",
 ".usm-panel>.usm-sim-area,.usm-panel>.usm-actual-area{min-width:0;margin:0;padding:12px;border-radius:15px}",
 ".usm-panel .usm-grid,.usm-panel .usm-actual-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
 ".usm-panel .usm-part,.usm-panel .usm-actual-part{padding:9px;min-height:69px;cursor:pointer;transition:transform .18s,border-color .18s,background .18s}",
 ".usm-panel .usm-part:hover,.usm-panel .usm-actual-part:hover{transform:translateY(-2px);border-color:#80e9e1}",
 ".usm-panel .usm-part:focus-visible,.usm-panel .usm-actual-part:focus-visible{outline:2px solid #91f5ed;outline-offset:2px}",
 ".usm-panel .usm-part[data-expanded=true],.usm-panel .usm-actual-part[data-expanded=true]{grid-column:span 2;border-color:#75e2d7;background:linear-gradient(135deg,#134052,#0d3341)}",
 ".usm-panel .usm-part .usm-detail,.usm-panel .usm-actual-part .usm-real-reading{display:none}",
 ".usm-panel .usm-part[data-expanded=true] .usm-detail,.usm-panel .usm-actual-part[data-expanded=true] .usm-real-reading{display:block}",
 ".usm-panel .usm-part-icon{font-size:19px;flex-basis:22px}",
 ".usm-panel .usm-part-name b{font-size:11px}",
 ".usm-panel .usm-mission{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}",
 ".usm-panel .usm-flow{padding:6px 0}",
 ".usm-panel .usm-flow span{padding:5px 7px;font-size:10px}",
 ".usm-panel #usmConnectUSB{color:#093636;background:#67dfc9;border:1px solid #91f3e7;border-radius:8px;padding:8px 10px;cursor:pointer;font:700 11px system-ui}",
 ".usm-panel #usmConnectUSB:hover{background:#99f4e3}",
 ".usm-panel .usm-live-power strong{font-size:16px}",
 "@media(max-width:1070px){.usm-panel{grid-template-columns:1fr}.usm-panel>.usm-head,.usm-panel>.usm-bottom,.usm-panel>.usm-packet,.usm-panel>.usm-note{grid-column:1}}",
 "@media(max-width:480px){.usm-panel .usm-grid,.usm-panel .usm-actual-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.usm-panel .usm-part[data-expanded=true],.usm-panel .usm-actual-part[data-expanded=true]{grid-column:span 2}}",
 "@media(prefers-reduced-motion:reduce){.usm-panel .usm-part,.usm-panel .usm-actual-part{transition:none}}",
 '.usm-sim-area,.usm-actual-area{padding:15px;border-radius:15px;margin:13px 0;min-width:0;overflow:hidden}',
 '.usm-sim-area{background:linear-gradient(135deg,#22263b,#142336);border:1px solid #75679b}',
 '.usm-actual-area{background:linear-gradient(135deg,#082f34,#0d293b);border:1px solid #2eaa99}',
 '.usm-zone-title h4{font-size:17px;line-height:1.3;margin:7px 0 3px;color:#f1faff}',
 '.usm-zone-title p{margin:0 0 12px!important;font-size:11px!important;color:#b7cbd9!important;line-height:1.5}',
 '.usm-zone-pill{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.09em;padding:6px 9px;border-radius:8px;border:1px solid}',
 '.usm-model-pill{color:#e0ccff;background:#3b2a56;border-color:#8e79ba}',
 '.usm-real-pill{color:#a1ffde;background:#124c47;border-color:#3fbd9c}',
 '.usm-actual-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}',
 '.usm-actual-part{min-width:0;border:1px solid #337b78;border-radius:12px;background:#0a343d;padding:12px;overflow-wrap:anywhere}',
 '.usm-actual-part[data-state="live"]{border-color:#4cdfbd;background:#0b3c3b}',
 '.usm-actual-part[data-state="historical"]{border-color:#cfaa72}',
 '.usm-real-status{display:block;font-size:10px;letter-spacing:.035em;color:#a7c2ce;margin:11px 0 4px}',
 '.usm-actual-part[data-state="live"] .usm-real-status{color:#78f4c9}',
 '.usm-actual-part[data-state="historical"] .usm-real-status{color:#ffdb9a}',
 '.usm-real-reading{margin:0!important;color:#d4f1ed!important;font-size:11px!important;line-height:1.5}',
 '.usm-physical-state{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:10px;background:#06252d;border-radius:10px;border:1px solid #356b6a;font-size:11px;margin:9px 0}',
 '.usm-physical-state strong{font-size:11px;color:#a3ffe4}',
 '.usm-physical-state span{color:#b6d1da}',
 '.usm-physical-state a{color:#78e8f2;text-decoration:underline;text-underline-offset:2px}',
 '.usm-live-power{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}',
 '.usm-live-power>div{border:1px solid #399d95;border-radius:10px;background:#0a3d43;padding:11px;min-width:0}',
 '.usm-live-power small{display:block;color:#a6dbd9;font-size:10px;line-height:1.4;margin-bottom:6px}',
 '.usm-live-power strong{display:block;font-size:19px;color:#e9fff9;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
 '@media(max-width:1050px){.usm-actual-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
 '@media(max-width:760px){.usm-sim-area,.usm-actual-area{padding:10px}.usm-actual-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.usm-live-power>div{padding:8px}.usm-live-power strong{font-size:15px}}',
 '@media(max-width:440px){.usm-actual-grid{gap:6px}.usm-actual-part{padding:9px}.usm-live-power{gap:6px}.usm-live-power small{font-size:9px}.usm-live-power strong{font-size:13px}}',
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
  const prev=window.ULTRON_HW_PREVIOUS;
  const latest=window.ULTRON_HW_LATEST;
  if(prev?.origin==="USB"&&latest?.origin==="USB"&&prev.when!==latest.when){
   const oldP=get(prev.packet,[["solar","power_mw"],["solar","power_mW"],["sp"]]);
   const newP=getn("solar.power_mw","solar.power_mW","sp");
   const oldV=get(prev.packet,[["solar","voltage_v"],["solar","voltage_V"],["sv"]]);
   const newV=getn("solar.voltage_v","solar.voltage_V","sv");
   if(oldP!=null&&newP!=null)pieces.push("Δ power "+(newP-oldP>=0?"+":"")+fmt(newP-oldP,1)+" mW");
   else if(oldV!=null&&newV!=null)pieces.push("Δ panel V "+(newV-oldV>=0?"+":"")+fmt(newV-oldV,2)+" V");
  }
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
  const railValid=p.ok==null||!!(p.ok&2);
  if(railValid){
  add(getn("v","power.bus_voltage")," V monitored bus");
  add(getn("i","power.current_mA")," mA monitored bus",1);
  add(getn("p","power.power_mW")," mW monitored bus",1);
  }
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
  if(p.ok==null||!!(p.ok&2)){
   add(getn("v","power.bus_voltage")," V bus");
   add(getn("i","power.current_mA")," mA bus",1);
   add(getn("p","power.power_mW")," mW bus",1);
  }
 }else if(id==="temp"){
  const ok=p.ok==null||!!(p.ok&1);
  if(ok)add(getn("t","environment.temperature_C","sht31.temperature_c")," °C");
  add(getn("environment.humidity_percent","sht31.humidity_percent"),"% RH",1);
 }else if(id==="ldr"){
  const light=getn("l","light.light1","light.adc");
  add(light," light ADC",0);
  const prev=window.ULTRON_HW_PREVIOUS,latest=window.ULTRON_HW_LATEST;
  if(light!=null&&prev?.origin==="USB"&&latest?.origin==="USB"&&prev.when!==latest.when){
   const old=get(prev.packet,[["l"],["light","light1"],["light","adc"]]);
   if(old!=null)pieces.push("Δ "+(light-old>=0?"+":"")+fmt(light-old,0)+" ADC");
  }
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
 const actualSource=root.querySelector("[data-real-source]"),actualAge=root.querySelector("[data-real-age]");
 if(actualSource)actualSource.textContent=physicalSource;
 if(actualAge)actualAge.textContent=packet?(age+" seconds since last sensor packet"):"No physical data received";
 const getn=paths=>packet?get(packet,paths.map(s=>s.split("."))):null;
 const validINA=packet&&(packet.ok==null||!!(packet.ok&2));
 const current=validINA?getn(["i","power.current_mA","power.current_ma","ina219.current_ma"]):null;
 const voltage=validINA?getn(["v","power.bus_voltage","power.bus_voltage_v","ina219.voltage_v"]):null;
 const measuredP=validINA?getn(["p","power.power_mW","power.power_mw","ina219.power_mw"]):null;
 const powerMW=measuredP!=null?measuredP:current!=null&&voltage!=null?current*voltage:null;
 const setV=(sel,value)=>{const el=root.querySelector(sel);if(el)el.textContent=value;};
 // Hardware values are only shown as "LIVE" when the serial stream is fresh;
 // otherwise clear them instead of presenting simulated or stale numbers.
 setV("[data-ina-current]",live&&current!=null?fmt(current,1)+" mA":"— mA");
 setV("[data-ina-voltage]",live&&voltage!=null?fmt(voltage,2)+" V":"— V");
 setV("[data-ina-power]",live&&powerMW!=null?fmt(powerMW,1)+" mW"+(measuredP==null?" (calc)":""):"— mW");
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
  el.querySelector(".usm-detail").textContent="SIMULATED DUTY CYCLE · "+(activeMin[id]||0)+" active minutes per 90-minute scenario";
  el.querySelector(".usm-part-name small").textContent="Schedule "+(activeMin[id]||0)+"/90 min · model";
  // This is a completely separate physical hardware card, NOT the model card.
  const actual=root.querySelector('[data-real-part="'+id+'"]');
  if(actual){
   const missing=!packet||/^No (dedicated|panel|sensor)|^No .*received/.test(real);
   const realState=missing?"unknown":live?"live":log?"historical":"stale";
   actual.dataset.state=realState;
   actual.querySelector(".usm-real-status").textContent=missing?"NOT REPORTED":live?"LIVE USB · "+age+"s":log?"HISTORICAL SD LOG":"OLD READING · NOT LIVE";
   actual.querySelector(".usm-real-reading").textContent=packet?real:"No measurement received from the ESP32";
  }
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
 if(cadAnchor&&!$("usmCadLink")){
  const a=document.createElement("a");a.id="usmCadLink";a.href="#usm-orbit";
  a.textContent="Explore interactive components and live sensor readings";
  a.style.cssText="display:block;padding:10px 12px;margin:8px 0 15px;color:#8ae8ef;background:#11374b;border:1px solid #48758f;border-radius:10px;font:600 12px system-ui;text-decoration:none";
  cadAnchor.insertAdjacentElement("afterend",a);
 }
}
function refresh(){
 mount();
 const panel=$("usm-orbit");if(panel)paint(panel);
}
function start(){refresh();setInterval(function(){if(!document.hidden)refresh();},800);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();