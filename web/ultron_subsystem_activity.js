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
 ["solar","☀","Solar arrays","3D SIMULATION"],
 ["eps","⚡","Power controller / EPS","3D SIMULATION"],
 ["battery","▰","Battery reserve","3D SIMULATION"],
 ["obc","▦","Onboard computer","OPERATING MODE · SIMULATED"],
 ["camera","◉","ESP32-CAM","PAYLOAD MODE · SIMULATED"],
 ["temp","♨","TMP102 temperature","ESP32 SENSOR"],
 ["ina","⌁","INA219 bus monitor","ESP32 SENSOR"],
 ["imu","⌖","MPU6050 IMU","ESP32 SENSOR"],
 ["ldr","☼","LDR light sensor","ESP32 SENSOR"],
 ["lora","⇶","LoRa radio link","NOT TELEMETRIED"],
 ["storage","▤","SD image storage","NOT TELEMETRIED"]
];
function makePanel(place){
 var root=document.createElement("section");
 root.className="usm-panel";
 root.id="usm-"+place;
 root.setAttribute("aria-label","ULTRON-SAT component status synchronized with orbit and ESP32 readings");
 root.innerHTML='<div class="usm-head"><div><div class="usm-eyebrow">CUBESAT COMPONENT ACTIVITY · REAL-TIME DISPLAY</div><h3>Which systems are operating?</h3><p>Follows the rotating 3D orbit; displays measured ESP32 telemetry separately.</p></div><span class="usm-sim-tag">MODEL + HARDWARE · LABELLED</span></div>'
 +'<div class="usm-mission"><div><small>Orbit condition</small><strong data-summary="orbit">Waiting for rotation…</strong></div><div><small>Estimated solar generation</small><strong data-summary="power">—</strong></div><div><small>Simulated battery</small><strong data-summary="battery">—</strong></div><div><small>ESP32 data source</small><strong data-summary="source">Not connected</strong></div></div>'
 +'<div class="usm-flow"><span data-flow="solar">Solar</span><i>→</i><span data-flow="eps">EPS</span><i>⇄</i><span data-flow="battery">Battery</span><i>→</i><span data-flow="payload">Payload</span></div>'
 +'<div class="usm-grid">'+PARTS.map(function(p){return '<article class="usm-part" data-part="'+p[0]+'" data-state="unknown"><div class="usm-part-title"><span class="usm-part-icon" aria-hidden="true">'+p[1]+'</span><div class="usm-part-name"><b>'+p[2]+'</b><small>'+p[3]+'</small></div></div><div class="usm-part-state"><span class="usm-led" aria-hidden="true"></span><strong class="usm-status">UNKNOWN</strong></div><p class="usm-detail">Awaiting data</p></article>';}).join('')+'</div>'
 +'<div class="usm-bottom"><span data-summary="freshness">No sensor sample received</span><a href="#espHw">View USB connection, all sensor readings and SD logs</a></div>'
 +'<p class="usm-note">Green / amber on a simulated component means its <b>modeled</b> state, not verified electrical operation. Actual sensor readings require a connected USB ESP32 or an imported SD log. Imported readings are historical; unreported components remain unverified. The INA219 monitors the 5 V bus, not battery charge. No actual satellite functions are controlled here.</p>';
 return root;
}
function css(){
 if($("usm-style"))return;
 var style=document.createElement("style");style.id="usm-style";
 style.textContent=[
 '.usm-panel,.usm-panel *{box-sizing:border-box}',
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
function paint(root){
 var raw=window.ULTRON_ORBIT_POWER;
 var orbitValid=raw&&typeof raw.eclipse==="boolean"&&Number.isFinite(raw.phaseDeg)&&Number.isFinite(raw.generationW);
 var current=$("pm3Panel")?.dataset.phase;
 var mode=orbitValid&&["nominal","eclipse","coast"].includes(current)?current:null;
 var simulated=!!mode,lit=simulated&&(text("pm3Lighting").indexOf("Sun-facing")===0||(!raw.eclipse&&text("pm3Lighting").indexOf("Earth shadow")<0));
 var t=telem();
 var names={nominal:"SUNLIGHT · NOMINAL",eclipse:"ECLIPSE · BATTERY",coast:"LOW-POWER COAST"};
 setSummary(root,"orbit",simulated?names[mode]:"AWAITING 3D ORBIT");
 setSummary(root,"power",simulated?text("pm3Solar")||"—":"—");
 setSummary(root,"battery",simulated?text("pm3Charge")||"—":"—");
 setSummary(root,"source",t.source);
 setSummary(root,"freshness",t.stamp+" · "+(text("hwcount")||"0 samples"));
 function flow(id,state){var e=root.querySelector('[data-flow="'+id+'"]');if(e)e.dataset.state=state;}
 flow("solar",simulated?(lit?"on":"off"):"unknown");
 flow("eps",simulated?"on":"unknown");
 flow("battery",simulated?"on":"unknown");
 flow("payload",simulated?(mode==="nominal"?"on":"off"):"unknown");
 if(!simulated){
  ["solar","eps","battery","obc","camera"].forEach(function(k){part(root,k,"unknown","AWAITING ORBIT","Open the 3D orbit simulation to see component operating modes.");});
 }else{
  part(root,"solar",lit?"on":"off",lit?"ILLUMINATED":"NO SOLAR INPUT",lit?"Estimated generation "+text("pm3Solar")+" · MODEL":"Earth shadow · generation modeled as 0 W");
  part(root,"eps","on","POWER ROUTING","Estimated net "+(text("pm3Net")||"—")+" · MODEL (not monitored)");
  part(root,"battery","on",text("pm3FlowText")==="CHARGING"?"CHARGING · MODEL":"DISCHARGING · MODEL","Modeled reserve "+(text("pm3Charge")||"—")+"; hardware charge not measured");
  part(root,"obc","on",mode==="coast"?"LOW-POWER MODE":"SYSTEM MODE ENABLED","Operating state is modeled; OBC hardware state is not telemetered");
  part(root,"camera",mode==="nominal"?"on":"off",mode==="nominal"?"PAYLOAD MODE ALLOWED":"PAYLOAD STANDBY","Modeled power permission only. ESP32-CAM health and photos not telemetered.");
 }
 reading(root,"temp",!!t.t,"Temperature ",t.t,t);
 reading(root,"ina",!!(t.v||t.i||t.p),"5 V bus ",[t.v,t.i,t.p].filter(Boolean).join(" · "),t);
 reading(root,"imu",!!(t.a||t.g),"Accel / gyro ",[t.a,t.g].filter(Boolean).join(" | "),t);
 reading(root,"ldr",!!t.l,"Light ADC ",t.l,t);
 part(root,"lora","unknown","NOT VERIFIED","No LoRa radio-link status in the supplied ESP32 telemetry packets.");
 part(root,"storage","unknown","NOT VERIFIED","Camera images may be stored on SD; no live storage-health field received.");
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