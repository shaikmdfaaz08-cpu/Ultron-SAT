/* ULTRON-SAT: correct the ORIGINAL Power measurements card.
   Never treat simulator/legacy screen state as live hardware.
   The Power card is driven only by verified fresh USB/ground telemetry. */
(function(){
"use strict";
if(window.__ultronPowerCardLive)return;window.__ultronPowerCardLive=true;
const $=id=>document.getElementById(id);
const fields=["power.bus_voltage","power.battery_voltage","power.current_mA","calculatedPower"];
function n(v){return typeof v==="number"&&Number.isFinite(v)?v:null}
function pick(obj,paths){
 for(const path of paths){
  let v=obj;
  for(const k of path.split("."))v=v!=null?v[k]:undefined;
  const x=n(v);if(x!==null)return x;
 }
 return null;
}
function fromUSB(){
 const item=window.ULTRON_HW_LATEST;
 if(!item||!item.packet)return null;
 const age=Math.max(0,Date.now()-item.when);
 const connected=($("hwconn")?.textContent||"").trim()==="USB live readings";
 if(item.origin!=="USB"||!connected||age>90000)return null;
 const p=item.packet;
 const ok= !Number.isInteger(p.ok)||!!(p.ok&2);
 const voltage=ok?pick(p,["v","power.bus_voltage","power.bus_voltage_v","ina219.voltage_v"]):null;
 const current=ok?pick(p,["i","power.current_mA","power.current_ma","ina219.current_ma"]):null;
 const power=ok?pick(p,["p","power.power_mW","power.power_mw","ina219.power_mw"]):null;
 const cell=pick(p,["battery.voltage_v","battery.voltage_V","bv","power.battery_voltage"]);
 return {voltage,current,power,cell,age,origin:"USB",received:true};
}
function fromOriginalHardware(){
 const app=window.UltronApp,t=app?.telemetry;
 if(!t||typeof app?.hasHardware!=="function"||!app.hasHardware())return null;
 if(t.source!=="REAL HARDWARE"||!["USB","WIFI"].includes(t.transport))return null;
 const age=Date.now()-t.received_at;
 if(!Number.isFinite(age)||age<0||age>90000)return null;
 return {
  voltage:n(t.power?.bus_voltage),current:n(t.power?.current_mA),
  power:null,cell:n(t.power?.battery_voltage),
  age,origin:t.transport==="USB"?"USB NATIVE":"HARDWARE LINK",received:true
 };
}
function state(){
 const physical=fromUSB()||fromOriginalHardware();
 if(physical)return physical;
 const snap=window.ULTRON_HW_LATEST;
 const usbStatus=($("hwconn")?.textContent||"").trim();
 if(snap?.origin==="SD log")return {received:false,historical:true,origin:"HISTORICAL SD"};
 if(snap?.origin==="USB"&&usbStatus!=="USB live readings")return {received:false,stale:true,origin:"USB DISCONNECTED / STALE"};
 if(usbStatus==="USB open · awaiting data")return {received:false,waiting:true,origin:"USB CONNECTED · WAITING FOR SENSOR"};
 return {received:false,origin:"NOT CONNECTED"};
}
function mount(){
 const page=$("page-power");if(!page)return null;
 const values=fields.map(field=>page.querySelector('[data-value="'+field+'"]'));
 if(values.some(v=>!v))return null;
 let card=values[0].closest(".mc-card");
 if(!card)return null;
 if(!$("ultronActualPowerSource")){
  const block=document.createElement("div");
  block.id="ultronActualPowerSource";
  block.setAttribute("role","status");
  block.style.cssText="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:8px 0 12px;font:700 11px/1.5 system-ui;color:#bcd6e5";
  const status=document.createElement("span");status.id="ultronActualPowerState";status.textContent="Checking USB measurements";
  const link=document.createElement("a");link.href="#espHw";link.textContent="Connect USB / inspect readings";
  link.style.cssText="color:#82e1f1;text-decoration:underline;text-underline-offset:3px";
  block.append(status,link);
  card.querySelector("h2")?.insertAdjacentElement("afterend",block);
 }
 if(!$("ultronActualPowerHelp")){
  const note=document.createElement("p");note.id="ultronActualPowerHelp";
  note.style.cssText="font:11px/1.55 system-ui;color:#a9cadd;margin:10px 0 0";
  note.textContent="This card uses live hardware telemetry only, never the orbit simulation.";
  card.append(note);
 }
 // Correct headings so they explicitly state which readings are physical.
 const labels={
  "power.bus_voltage":"INA219 monitored bus voltage",
  "power.battery_voltage":"Battery voltage (if reported)",
  "power.current_mA":"INA219 live measured current",
  "calculatedPower":"Bus power (measured / calculated)"
 };
 for(let i=0;i<fields.length;i++){
  const label=values[i].previousElementSibling;
  if(label&&label.tagName==="SMALL"&&label.textContent!==labels[fields[i]])label.textContent=labels[fields[i]];
 }
 return values;
}
let guard=false;
function paint(){
 const items=mount();if(!items||guard)return;
 const source=state();
 let voltage=null,current=null,power=null,cell=null;
 if(source.received){
  voltage=source.voltage;current=source.current;
  cell=source.cell;power=source.power!==null?source.power/1000
   :voltage!==null&&current!==null?voltage*current/1000:null;
 }
 const display=[
  voltage===null?"NOT MEASURED":voltage.toFixed(2)+" V",
  cell===null?"NOT MEASURED":cell.toFixed(2)+" V",
  current===null?"NOT MEASURED":current.toFixed(1)+" mA",
  power===null?"NOT MEASURED":power.toFixed(3)+" W"
 ];
 const count=[voltage,current,power].filter(v=>v!==null).length;
 let status=source.received
  ? (count?"LIVE "+source.origin+" · "+Math.round(source.age/1000)+"s ago":"USB OPEN · NO VALID INA219 DATA")
  :source.origin;
 let help=source.received
  ? count?"INA219 bus voltage/current/power are physical readings; battery voltage is shown only when separately reported.":"The connected ESP32 has not provided valid INA219 voltage/current/power fields. Check the incoming JSON packet and INA219 validity bit."
  :source.historical?"SD log data is historical and is not displayed as live. Connect USB for live values."
  :source.waiting?"USB is open but no valid ESP32 sensor packet has arrived yet."
  :"The previous 260 mA and 4.2 V were not independently verified as live. This card no longer substitutes simulated or last-known values.";
 guard=true;
 try{
  for(let i=0;i<items.length;i++){
   if(items[i].textContent!==display[i])items[i].textContent=display[i];
   items[i].dataset.ultronPhysical=source.received?"true":"false";
  }
  const st=$("ultronActualPowerState");if(st&&st.textContent!==status)st.textContent=status;
  const note=$("ultronActualPowerHelp");if(note&&note.textContent!==help)note.textContent=help;
 }finally{guard=false}
}
function setup(){
 if(window.__ultronActualPowerStarted)return;window.__ultronActualPowerStarted=true;
 // The original dashboard can re-render this card on every animation update.
 // Observe its four values and correct them whenever old simulation code writes.
 const attach=()=>{
  const items=mount();if(!items)return false;
  if(!window.__ultronPowerValuesObserved){
   window.__ultronPowerValuesObserved=true;
   const observer=new MutationObserver(()=>{if(!guard)paint()});
   for(const el of items)observer.observe(el,{childList:true,characterData:true,subtree:true});
  }
  paint();return true;
 };
 attach();
 document.addEventListener("ultron:hardware-sample",paint);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)paint()});
 setInterval(()=>{if(!document.hidden)attach()},650);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});else setup();
})();