/* ULTRON-SAT shared telemetry adapter for the original V5 mission-control HTML.
 * Preserves the 3D interface and its existing USB port ownership. One browser
 * Serial port is used; the physical sensor panel observes validated packets.
 * This adapter does NOT create sensor values or issue hardware commands. */
(function(){
'use strict';
if(window.__ultronSharedUSBBridge)return;
window.__ultronSharedUSBBridge=true;
const $=id=>document.getElementById(id);
const parser=window.UltronTelemetry,core=window.UltronCore,app=window.UltronApp;
if(!parser||!core||!app){
 console.warn('ULTRON-SAT USB bridge: original mission-control app or parser unavailable');
 return;
}
core.normalize=function(input,transport='USB',received=Date.now()){
 return parser.normalize(input,transport,received);
};
let latest=app.telemetry;
let lastPacketKey=null;
function publish(t){
 if(!t||!['USB','WIFI','REPLAY'].includes(t.transport))return;
 if(t.source!=='REAL HARDWARE'&&t.transport!=='REPLAY')return;
 const packet=t.raw;
 const key=t.transport+':'+t.received_at+':'+JSON.stringify(packet||{}).slice(0,100);
 if(key===lastPacketKey)return;
 lastPacketKey=key;
 if(t.transport==='USB'||t.transport==='WIFI'){
  document.dispatchEvent(new CustomEvent('ultron:serial-line',{detail:{line:JSON.stringify(packet),transport:t.transport}}));
 }
 document.dispatchEvent(new CustomEvent('ultron:normalized-sample',{detail:t}));
 document.dispatchEvent(new CustomEvent('ultron:packet-result',{detail:{accepted:true,transport:t.transport}}));
}
// The native dashboard assigns app.telemetry when it accepts a USB line.
// Capture that validated assignment without making another serial connection.
const desc=Object.getOwnPropertyDescriptor(app,'telemetry');
if(!desc||desc.configurable){
 Object.defineProperty(app,'telemetry',{
  configurable:true,enumerable:true,
  get(){return latest},
  set(value){latest=value;try{publish(value)}catch(e){console.warn('Hardware panel event:',e)}}
 });
}
function clickNative(id){
 const target=$(id);
 if(!target)throw Error('Mission Control USB controls unavailable. Reload the dashboard.');
 target.click(); // invoked synchronously during the user's button click
}
app.connectUSB=function(){
 if(!navigator.serial||!window.isSecureContext)throw Error('Web Serial requires desktop Chrome/Edge over HTTPS.');
 if(app.usbConnected())return;
 clickNative('usbConnect');
};
app.disconnectUSB=function(){
 if(!app.usbConnected())return;
 clickNative('usbDisconnect');
};
app.usbConnected=()=>{
 const disconnect=$('usbDisconnect');
 return !!disconnect&&!disconnect.disabled;
};
app.usbState=()=>app.usbConnected()?'usb':'disconnected';
app.isConnected=transport=>transport==='USB'?app.usbConnected():transport==='WIFI'&&app.wifi==='CONNECTED';
app.acceptReplay=t=>{
 if(app.hasHardware?.())throw Error('Disconnect hardware before importing historical recordings.');
 if(t?.source!=='REPLAY'||t.transport!=='REPLAY')throw Error('Historical data must be explicitly replay-labeled.');
 app.replay=true;app.telemetry=t;
 window.MC4?.render?.(1);
};
app.clearTelemetry=()=>{
 app.telemetry=null;app.replay=false;lastPacketKey=null;
 document.dispatchEvent(new CustomEvent('ultron:transport-reset',{detail:{transport:'USB'}}));
 window.MC4?.render?.(1);
};
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&app.telemetry?.source==='REAL HARDWARE'){
  document.dispatchEvent(new CustomEvent('ultron:normalized-sample',{detail:app.telemetry}));
 }
});
// Enable original Power Management's physical values without waiting for
// its fallback clock or for unavailable battery/solar fields.
console.info('ULTRON-SAT shared USB telemetry bridge ready. Legacy 3D UI retained.');
})();
