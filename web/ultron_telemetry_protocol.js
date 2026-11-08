/* One packet contract for USB, WebSocket and historical logs. No transport I/O. */
(function(root){'use strict';
const MAX_LINE=65536;
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const text=v=>typeof v==='string'?v.slice(0,256):null;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const key=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
function parse(input,depth=0){
 if(depth>4)throw Error('Receiver envelope is nested too deeply');
 let j=input;
 if(typeof j==='string'){
  const s=j.trim();if(!s)throw Error('Empty serial line');if(s.length>MAX_LINE)throw Error('Packet exceeds 64 KiB');
  if(s.startsWith('{')){try{j=JSON.parse(s)}catch{throw Error('Invalid JSON; send one complete object per newline')}}
  else{
   const a=s.split(',').map(x=>x.trim());
   if(a.length===7&&['NOMINAL','IMAGING','ECLIPSE','SAFE','OFF'].includes(a[0])&&a.slice(1).every(v=>number(v)!==null))
    j={legacy:true,mode:a[0],light:{light1:+a[1]},power:{bus_voltage:+a[3],current_mA:+a[4],solar_voltage:+a[5]},environment:{temperature_C:+a[6]}};
   else{
    // Support receiver debug prefixes around JSON, but never reinterpret malformed JSON as text.
    const brace=s.indexOf('{');if(brace>=0)return parse(s.slice(brace),depth+1);
    const fields=[...s.matchAll(/([A-Za-z_][\w.]*)\s*[=:]\s*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][\w-]*)/g)];
    if(fields.length<2)throw Error('Expected JSON, seven-field CSV, or sensor key=value text');
    j=Object.fromEntries(fields.map(m=>[m[1],number(m[2])??m[2]]));
   }
  }
 }
 if(!object(j))throw Error('Telemetry must be an object');
 for(const k of ['payload','data','msg','message','pkt','frame','body','rx']){
  if(object(j[k])||typeof j[k]==='string'&&j[k].trim().startsWith('{')){
   const inner=parse(j[k],depth+1),outer={...j};delete outer[k];delete outer.type;delete outer.version;return {...outer,...inner};
  }
 }
 return j;
}
function flatten(o,prefix='',out=new Map(),depth=0){
 if(depth>8)throw Error('Sensor object is nested too deeply');
 for(const [k,v] of Object.entries(o)){const p=prefix?prefix+'.'+k:k;if(object(v))flatten(v,p,out,depth+1);else out.set(key(p),v)}return out;
}
function normalize(input,transport='USB',received=Date.now()){
 const j=parse(input),f=flatten(j);
 if(j.type!=null&&j.type!=='telemetry')throw Error('Not a telemetry packet: '+String(j.type).slice(0,40));
 if(j.version!=null&&number(j.version)!==1)throw Error('Unsupported telemetry version');
 const n=(...paths)=>{for(const p of paths){const v=number(f.get(key(p)));if(v!==null)return v}return null};
 const s=(...paths)=>{for(const p of paths){const v=text(f.get(key(p)));if(v!==null)return v}return null};
 const b=(...paths)=>{for(const p of paths){const v=f.get(key(p));if(typeof v==='boolean')return v}return null};
 const status=(...names)=>({state:s(...names.map(x=>x+'.state'))||'UNAVAILABLE',initialised:b(...names.flatMap(x=>[x+'.initialised',x+'.initialized',x+'.ready'])),error:s(...names.map(x=>x+'.error'))});
 const compact=['b','n','ms','ok'].every(k=>j[k]!=null);
 const mask=j.ok==null?null:number(j.ok);
 if(j.ok!=null&&(!Number.isInteger(mask)||mask<0||mask>7))throw Error('Validity mask ok must be an integer from 0 to 7');
 const valid=(bit,v)=>mask===null||(mask&bit)?v:null;
 const accelUnit=s('accelerometer.unit','imu.accel.unit','imu.acceleration_unit','acceleration_unit');
 const factor=accelUnit==='g'||(!accelUnit&&compact)?9.80665:1;
 if(accelUnit&&!['g','m/s2','m/s²','m/s^2'].includes(accelUnit))throw Error('Unsupported acceleration unit: '+accelUnit);
 const accel=axis=>{const v=valid(4,n('accelerometer.'+axis,'imu.accel.'+axis,'imu.acceleration.'+axis,'imu.a'+axis,'a'+axis,'acc'+axis,'accel'+axis,'acceleration'+axis,'mpua'+axis));return v===null?null:v*factor};
 const gyro=axis=>valid(4,n('gyroscope.'+axis,'imu.gyro.'+axis,'imu.g'+axis,'g'+axis,'gyro'+axis,'gyr'+axis,'mpug'+axis));
 const current=n('power.current_mA','ina219.current_ma','current_ma','currentma','ma','inama','ina219ma','currentmilliamps','i');
 const amps=n('power.current_A','current_a','amps','ia');
 const t={type:'telemetry',version:1,source:transport==='REPLAY'?'REPLAY':transport==='SIMULATION'?'SIMULATION':'REAL HARDWARE',transport,received_at:received,
  device_id:s('device_id','device','node','nodeid','src','from','id'),timestamp:s('timestamp'),firmware:s('firmware'),mode:s('mode'),uptime_ms:n('uptime_ms','uptime','millis','tms','ms'),sequence:n('n','seq','sequence','counter'),boot:n('b','boot'),legacy:!!j.legacy,raw:j,
  environment:{temperature_C:valid(1,n('environment.temperature_C','sht31.temperature_C','sht31.temp','tmp102.temperature','temp_c','temperature_c','temperature','temp','t','tc')),humidity_percent:n('environment.humidity_percent','sht31.humidity','sht31.humidity_percent','humidity','hum','rh','humidity_percent'),sensor:s('environment.sensor')},
  power:{bus_voltage:valid(2,n('power.bus_voltage','power.bus_voltage_v','ina219.voltage_v','ina219.bus_voltage','supply_v','supplyvoltage','busv','busvoltage','vbus','inav','ina219v','loadv','voltage','vin','v')),current_mA:valid(2,current??(amps===null?n('current'):amps*1000)),power_mW:valid(2,n('power.power_mW','ina219.power_mw','power_mw','p')),battery_voltage:n('power.battery_voltage','battery.voltage_v','battery.voltage_V','batteryv','vbat','vbatt','battv','bv'),solar_voltage:n('power.solar_voltage','solar.voltage_v','solar.voltage_V','solarv','vsolar','vpanel','panelv','sv'),battery_percent:n('power.battery_percent','battery.soc_pct','battery.soc_percent','battery.percent','battery.soc','battery_percent','soc','bpct'),charging:b('power.charging','battery.charging','charging')},
  light:{light1:n('light.light1','light.adc','ldr','ldrraw','ldrvalue','light','lightlevel','light1','lux','adc','l'),light2:n('light.light2','light2'),unit:s('light.unit')||(f.has('lux')?'lux':'raw ADC')},
  accelerometer:{x:accel('x'),y:accel('y'),z:accel('z')},gyroscope:{x:gyro('x'),y:gyro('y'),z:gyro('z')},orientation:{x:n('orientation.x'),y:n('orientation.y'),z:n('orientation.z'),reference:'ESTIMATED, not absolute attitude'},
  imu:status('imu'),camera:{...status('camera'),last_capture:s('camera.last_capture'),frames:n('camera.frames')},
  storage:{...status('storage','sd'),mounted:b('sd.mounted'),recording:b('storage.recording','sd.recording'),records:n('storage.records','sd.records','sd.writes'),available_bytes:n('storage.available_bytes','sd.available_bytes'),last_saved:s('storage.last_saved','sd.last_saved')},
  lora:{...status('lora'),connected:b('lora.connected'),active:b('lora.active'),rssi:n('lora.rssi','lora.rssi_dbm','rssi','rxrssi','packetrssi'),snr:n('lora.snr','lora.snr_db','snr','rxsnr'),tx_count:n('lora.tx_count','lora.tx_packets'),rx_count:n('lora.rx_count','lora.rx_packets'),errors:n('lora.errors'),last_packet:s('lora.last_packet'),last_rx:s('lora.last_rx'),last_tx:s('lora.last_tx')},
  wifi:{...status('wifi'),mode:s('wifi.mode'),ip:s('wifi.ip'),ssid:s('wifi.ssid'),clients:n('wifi.clients'),rssi:n('wifi.rssi'),connected_since:s('wifi.connected_since')},
  solar:object(j.solar)?{...j.solar}:{},battery:object(j.battery)?{...j.battery}:{},eps:object(j.eps)?{...j.eps}:{}
 };
 const values=[...Object.values(t.environment),...Object.values(t.power),t.light.light1,t.light.light2,...Object.values(t.accelerometer),...Object.values(t.gyroscope),t.lora.rssi,t.lora.snr];
 const components=['imu','camera','storage','lora','wifi'].some(k=>t[k].state!=='UNAVAILABLE'||t[k].initialised!==null||t[k].error!==null||Object.values(t[k]).some(v=>typeof v==='number'||typeof v==='boolean'));
 const extension=['solar','battery','eps'].some(k=>Object.values(t[k]).some(v=>number(v)!==null||typeof v==='boolean'));
 if(!compact&&!values.some(v=>typeof v==='number')&&!components&&!extension)throw Error('No recognized sensor values or component status');
 t.mc={hop:t.lora.rssi!==null||t.lora.snr!==null,seq:t.sequence,mapping:['power','environment','light','accelerometer','gyroscope','lora'].flatMap(k=>Object.entries(t[k]).filter(([,v])=>typeof v==='number').map(([field,value])=>({from:k+'.'+field,value,label:k+'.'+field,unit:'',note:'normalized value'}))),unmapped:[],assumed:[],rejected:[]};
 return t;
}
class Lines{
 constructor(onLine,onError=()=>{}){this.onLine=onLine;this.onError=onError;this.buffer='';this.dropping=false;this.decoder=new TextDecoder()}
 push(bytes){const text=typeof bytes==='string'?bytes:this.decoder.decode(bytes,{stream:true});for(const c of text){if(c==='\n'){if(!this.dropping&&this.buffer.trim())this.onLine(this.buffer.replace(/\r$/,''));this.buffer='';this.dropping=false;}else if(!this.dropping){this.buffer+=c;if(this.buffer.length>MAX_LINE){this.buffer='';this.dropping=true;this.onError('Serial line exceeds 64 KiB; waiting for next newline')}}}}
}
const api={normalize,parse,Lines,MAX_LINE};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.UltronTelemetry=api;
})(typeof window!=='undefined'?window:globalThis);
