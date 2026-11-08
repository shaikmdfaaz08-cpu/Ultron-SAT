/* ULTRON SAT - review-only overlay, never writes to telemetry or controls real hardware.
   Reads the SAME model-generated eclipse/generation estimate as the 3D solar system. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
let preview='auto',charge=74,active=true,history=[],lastTime=performance.now(),oldPhase=null,phaseMoving=true,lastMove=performance.now(),info=null,rendered=null;
const panel=document.createElement('section');panel.id='pm3Panel';panel.className='pm3-panel';
panel.innerHTML=`<header class="pm3-heading"><div><span class="pm3-kicker">POWER MANAGEMENT • LINKED TO THE ROTATING 3D ORBIT</span><h3>ULTRON-SAT orbital energy flow</h3><p>Sunlight → Nominal charging &nbsp;·&nbsp; Earth shadow → Eclipse battery mode &nbsp;·&nbsp; Orbit-only → Low-power coast</p></div><span class="pm3-simflag">ILLUSTRATIVE SIMULATION</span></header>
<div class="pm3-state-row"><div class="pm3-mode" id="pm3Mode" data-phase="nominal"><span id="pm3Dot" class="pm3-dot"></span><span id="pm3ModeText">Waiting for the 3D model…</span></div><span id="pm3Source" class="pm3-source">AUTO · 3D SCENE</span><span id="pm3OrbitPhase" class="pm3-orbital">Model phase —</span></div>
<div class="pm3-pipeline"><div class="pm3-stage" id="pm3SolarBox"><span class="pm3-symbol">☀</span><span class="pm3-name">Solar array</span><b id="pm3Solar">— W</b><small id="pm3Lighting">Waiting for 3D sunlight</small></div><div class="pm3-flow" id="pm3SolarFlow"><span>→</span><small>GENERATE</small></div><div class="pm3-stage pm3-controller"><span class="pm3-symbol">⚡</span><span class="pm3-name">Power management</span><b id="pm3Net">— W</b><small>Generation − consumption</small></div><div class="pm3-flow" id="pm3BatteryFlow"><span>⇄</span><small id="pm3FlowText">BALANCE</small></div><div class="pm3-stage"><span class="pm3-symbol">▰</span><span class="pm3-name">Battery reserve</span><b id="pm3Charge">74.0%</b><small id="pm3BatteryAction">Simulated energy storage</small></div><div class="pm3-flow" id="pm3LoadFlow"><span>→</span><small>SUPPLY</small></div><div class="pm3-stage"><span class="pm3-symbol">◈</span><span class="pm3-name">Subsystem load</span><b id="pm3Load">— W</b><small id="pm3Payload">Payload state pending</small></div></div>
<section id="pm3LiveINA" class="pm3-live-ina" aria-label="Measured INA219 current voltage and power">
<div class="pm3-live-heading"><div><span class="pm3-live-tag">PHYSICAL HARDWARE · INA219</span><h4>Live power-management sensor</h4><p>Monitored electrical bus • actual readings from ESP32 over USB</p></div><span id="pm3LiveState" class="pm3-live-state" data-state="unknown">AWAITING USB</span></div>
<div class="pm3-live-grid"><div><small>Measured current</small><strong id="pm3LiveCurrent">— mA</strong></div><div><small>Measured bus voltage</small><strong id="pm3LiveVoltage">— V</strong></div><div><small>Measured bus power</small><strong id="pm3LivePower">— mW</strong></div></div>
<p id="pm3LiveNote" role="status">No real INA219 readings yet. Connect ESP32 USB (115200 baud) from the telemetry panel.</p>
<div class="pm3-live-links"><a href="#espHw">Connect ESP32 / view sensor history</a><span>MODEL values above are separate from the measured bus.</span></div>
</section>
<div class="pm3-subgrid"><div class="pm3-charge"><div class="pm3-label-row"><b>Simulated battery state of charge</b><span id="pm3Voltage">Cell estimate — V</span></div><div class="pm3-track"><div id="pm3Fill"></div></div><p id="pm3Description">The rotating 3D model determines whether the satellite is illuminated. An illustrative 10 Wh battery and electronic loads are used for the power balance.</p></div><div class="pm3-energy-chart"><canvas id="pm3Chart" width="520" height="130" aria-label="Model battery charge across the demonstration"></canvas><span>Model charge history (simulated, not hardware readings)</span></div></div>
<div class="pm3-controls"><div class="pm3-choice"><button data-pm3="auto" class="pm3-selected">Auto • Follow rotating 3D model</button><button data-pm3="nominal">☀ Sunlight preview</button><button data-pm3="eclipse">◐ Eclipse preview</button><button data-pm3="coast">◌ Free orbit / orbit-only</button></div><div class="pm3-actions"><label for="pm3Draw">Subsystem load <strong id="pm3DrawText">1.4 W</strong><input id="pm3Draw" type="range" min="0.6" max="3.2" value="1.4" step="0.1"></label><label for="pm3Speed">Energy time scale <strong id="pm3SpeedText">60×</strong><input id="pm3Speed" type="range" min="1" max="240" value="60" step="1"></label><button id="pm3Reset">Reset simulation</button></div></div>
<p class="pm3-disclaimer"><b>Research demonstration.</b> Eclipse classification comes from the displayed 3D orbit geometry, not satellite ephemeris. Power, 10 Wh capacity, battery voltage and consumption are illustrative. “Free orbit / orbit-only” is an operational low-power/coasting state, not a third physical lighting condition. Real EPS telemetry is shown separately and is never replaced by these numbers.</p>`;

const style=document.createElement('style');style.id='pm3Styles';style.textContent=`
.pm3-panel{--pm3:#4bdccc;background:linear-gradient(145deg,#0b253c,#0a172a 70%);border:1px solid #4885a366;border-radius:18px;color:#effaff;box-shadow:0 12px 30px #0004;padding:18px 19px;margin:18px 0 24px;min-width:0;font-family:system-ui,-apple-system,sans-serif}
.pm3-panel *{box-sizing:border-box}.pm3-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:9px}.pm3-heading h3{font-size:19px;margin:4px 0 4px;color:#f5faff}.pm3-heading p{font-size:12px;color:#abcce0;line-height:1.5;margin:0 0 12px}.pm3-kicker{color:#70f4e6;font-weight:800;letter-spacing:.09em;font-size:10px}.pm3-simflag{border:1px solid #f6c36c77;border-radius:99px;color:#ffdd9e;padding:7px 9px;font-size:10px;font-weight:800;white-space:nowrap}.pm3-state-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:3px 0 16px}.pm3-mode{display:inline-flex;align-items:center;gap:9px;background:#114c51;border:1px solid #49d6c2;color:#eafffc;border-radius:9px;padding:10px 12px;font-size:13px;font-weight:800}.pm3-mode[data-phase=eclipse]{background:#5a421d;border-color:#eac279;color:#ffebba}.pm3-mode[data-phase=coast]{background:#382b51;border-color:#b9a3f4;color:#f0e8ff}.pm3-dot{width:9px;height:9px;flex-shrink:0;border-radius:50%;background:#65f2c7;box-shadow:0 0 11px #65f2c7}.pm3-mode[data-phase=eclipse] .pm3-dot{background:#ffcf69;box-shadow:0 0 11px #ffcf69}.pm3-mode[data-phase=coast] .pm3-dot{background:#b99aff;box-shadow:0 0 11px #b99aff}.pm3-source,.pm3-orbital{font-size:10px;color:#c0d8e6;border:1px solid #49708877;border-radius:99px;padding:7px 9px}.pm3-pipeline{display:flex;align-items:stretch;gap:5px;justify-content:space-between;flex-wrap:nowrap}.pm3-stage{flex:1 1 0;min-width:0;border:1px solid #4d749055;border-radius:12px;background:#0b3048;padding:13px 10px;display:flex;flex-direction:column;gap:5px;text-align:center}.pm3-controller{background:#0b3a43;border-color:#3e9b9a77}.pm3-stage .pm3-symbol{font-size:25px;color:#68e3d7}.pm3-stage .pm3-name{font-size:11px;color:#b5d0e1}.pm3-stage b{font-variant-numeric:tabular-nums;font-size:18px;color:#fff}.pm3-stage small{font-size:10px;line-height:1.3;color:#90acc4}.pm3-flow{flex:0 0 44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;overflow:hidden}.pm3-flow span{font-size:23px;color:#65e2cd;animation:pm3pulse 1.5s ease-in-out infinite}.pm3-flow small{font-size:8px;font-weight:800;color:#83b2c4;letter-spacing:.05em}.pm3-panel[data-phase=eclipse] #pm3SolarFlow span{color:#75849a;animation:none}.pm3-panel[data-phase=coast] .pm3-flow span{animation-duration:2.7s;color:#af99f7}@keyframes pm3pulse{0%,100%{opacity:.45;transform:translateX(-3px)}50%{opacity:1;transform:translateX(3px)}}.pm3-subgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.pm3-charge,.pm3-energy-chart{padding:12px;border-radius:12px;border:1px solid #466b8966;background:#091d30}.pm3-label-row{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;font-size:11px}.pm3-label-row span{color:#a6c6da}.pm3-track{margin:12px 0;height:13px;border-radius:99px;border:1px solid #5d8296;overflow:hidden;background:#05101b}.pm3-track>div{height:100%;width:74%;border-radius:99px;transition:width .5s linear,background .5s ease;background:linear-gradient(90deg,#2c9b8c,#5be5c6)}.pm3-charge p{font-size:11px;color:#abc8d9;line-height:1.6;margin:8px 0}.pm3-energy-chart canvas{width:100%;height:88px;display:block}.pm3-energy-chart span{font-size:9px;color:#a2bfd2}.pm3-controls{margin-top:13px;border-top:1px solid #365a7880;padding-top:13px;display:grid;gap:10px}.pm3-choice{display:flex;flex-wrap:wrap;gap:7px}.pm3-panel button{cursor:pointer;border-radius:9px;background:#173c59;border:1px solid #57809c;color:#edf8ff;padding:9px 11px;font:700 11px system-ui}.pm3-panel button.pm3-selected{background:#1d7b7b;border-color:#80efdb;color:#fff}.pm3-actions{display:flex;align-items:center;gap:13px;flex-wrap:wrap}.pm3-actions label{display:flex;align-items:center;gap:9px;font-size:11px;color:#b9d8e8;flex:1 1 210px;min-width:170px}.pm3-actions label strong{white-space:nowrap}.pm3-actions input{min-width:70px;flex:1;accent-color:#58dfcf}.pm3-disclaimer{font-size:10px;line-height:1.6;color:#99b6c8;margin:15px 0 0}.pm3-orbit-badge{position:absolute!important;left:12px;bottom:12px;z-index:40;display:grid;gap:3px;background:#081e32dd;color:#e8fcff;border:1px solid #67d5d28c;border-radius:10px;padding:8px 10px;pointer-events:none;font:11px/1.35 system-ui;max-width:min(260px,62%);backdrop-filter:blur(8px)}.pm3-orbit-badge[data-phase=eclipse]{border-color:#f3bb6daa}.pm3-orbit-badge[data-phase=coast]{border-color:#bcb1ffaa}.pm3-orbit-badge b{font-size:12px}.pm3-orbit-badge small{font-size:9px;color:#c2daeb}.pm3-engineering{margin:12px 0;border-radius:10px;border:1px solid #65acc17d;background:#0b2d43;padding:12px;color:#dcf7ff;font:12px/1.5 system-ui}.pm3-engineering b{display:block;margin-bottom:4px}.pm3-engineering small{color:#afcadc}
@media(max-width:870px){.pm3-pipeline{display:grid;grid-template-columns:1fr 30px 1fr;gap:6px}.pm3-pipeline .pm3-stage:nth-of-type(1){grid-column:1}.pm3-pipeline .pm3-stage:nth-of-type(3){grid-column:3}.pm3-pipeline .pm3-stage:nth-of-type(5){grid-column:1}.pm3-pipeline .pm3-stage:nth-of-type(7){grid-column:3}.pm3-pipeline .pm3-flow{flex:auto}.pm3-pipeline .pm3-flow:nth-of-type(6){display:none}.pm3-subgrid{grid-template-columns:1fr}.pm3-stage b{font-size:15px}.pm3-panel{padding:14px}}
@media(max-width:540px){.pm3-pipeline{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.pm3-pipeline .pm3-stage{grid-column:auto!important}.pm3-pipeline .pm3-flow{display:none}.pm3-state-row{gap:5px}.pm3-mode{font-size:11px}.pm3-simflag{font-size:9px}.pm3-heading h3{font-size:16px}.pm3-orbit-badge{bottom:8px;left:8px;padding:7px;max-width:64%;font-size:10px}}

/* Hardware readout is a separate non-overlay panel: never replace model labels. */
.pm3-live-ina{margin:14px 0 3px;border:1px solid #4cb8b1a6;background:linear-gradient(130deg,#092f3d,#0b243a);border-radius:13px;padding:14px}
.pm3-live-heading{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px}
.pm3-live-heading h4{font-size:16px;color:#f0fffd;margin:3px 0}
.pm3-live-heading p{font-size:11px;line-height:1.5;color:#a9cadb;margin:4px 0 0}
.pm3-live-tag{color:#69e5d3;letter-spacing:.07em;font-size:10px;font-weight:800}
.pm3-live-state{font-size:10px;font-weight:800;letter-spacing:.03em;color:#b6c9d8;border:1px solid #5b7589;background:#193348;border-radius:99px;padding:7px 9px;white-space:nowrap}
.pm3-live-state[data-state="live"]{color:#cefff0;border-color:#53ddb5;background:#155445}
.pm3-live-state[data-state="historical"]{color:#ffe8b2;border-color:#dfad69;background:#4b3820}
.pm3-live-state[data-state="stale"]{color:#ffdeac;border-color:#bd9159;background:#3e3027}
.pm3-live-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}
.pm3-live-grid>div{background:#112f46;border-radius:10px;border:1px solid #426e87;padding:12px;min-width:0}
.pm3-live-grid small{display:block;font-size:11px;color:#aac9d9;margin-bottom:8px}
.pm3-live-grid strong{display:block;font-size:22px;font-variant-numeric:tabular-nums;color:#eefeff;overflow-wrap:anywhere}
#pm3LiveNote{font-size:11px;line-height:1.5;color:#aed2dd;margin:11px 0 0}
.pm3-live-links{display:flex;align-items:center;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-top:10px;font-size:10px;color:#9dbac9}
.pm3-live-links a{color:#70dff1;text-underline-offset:3px;text-decoration:underline}
.pm3-orbit-live{font-size:11px;color:#d8fef4;padding:8px 10px;border:1px solid #338d83;border-radius:8px;background:#0d383c;line-height:1.4}
.pm3-orbit-live[data-live="false"]{color:#afc8d7;border-color:#567286;background:#122f43}
@media(max-width:540px){.pm3-live-ina{padding:11px}.pm3-live-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.pm3-live-grid>div{padding:8px}.pm3-live-grid small{font-size:9px}.pm3-live-grid strong{font-size:15px}.pm3-live-heading h4{font-size:15px}.pm3-orbit-live{font-size:10px}}

/* Dedicated orbit status row prevents overlap with WebGL overlay and camera controls. */
#pm3OrbitStatusRow.pm3-orbit-statusbar{display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:10px;min-width:0;margin:10px 0 4px;padding:0 2px;position:relative;z-index:auto}
#pm3OrbitStatusRow .pm3-orbit-badge{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;inset:auto!important;max-width:100%;width:max-content;min-width:0;display:inline-grid;flex:0 1 auto;box-sizing:border-box;padding:10px 12px;border-radius:12px;pointer-events:none;white-space:normal;overflow-wrap:anywhere}
#pm3OrbitStatusRow .pm3-orbit-status-note{font:700 10px/1.5 system-ui;color:#9fb9cb;letter-spacing:.04em;flex:1 1 190px}
@media(max-width:540px){#pm3OrbitStatusRow.pm3-orbit-statusbar{align-items:stretch;margin-top:8px;gap:5px}#pm3OrbitStatusRow .pm3-orbit-badge{width:100%;max-width:100%;padding:9px 10px;font-size:10px}#pm3OrbitStatusRow .pm3-orbit-status-note{font-size:9px;flex-basis:100%}}

`;
document.head.append(style);
let badge,engineering;
function mount(){
 const solar=$('page-solar');if(!solar||document.getElementById('pm3Panel'))return false;
 const shared=$('sharedScene');if(shared&&shared.parentNode)shared.insertAdjacentElement('afterend',panel);else solar.appendChild(panel);
 const scene=$('solarWorld');if(scene){badge=document.createElement('div');badge.id='pm3Badge';badge.className='pm3-orbit-badge';badge.dataset.phase='nominal';badge.innerHTML='<b id="pm3BadgeText">☀ NOMINAL · SUNLIT</b><small id="pm3BadgePower">Solar power and battery model</small>';// Keep the energy state adjacent to the 3D scene, NOT on top of its ephemeris and camera controls.
 const statusRow=document.createElement('div');statusRow.id='pm3OrbitStatusRow';statusRow.className='pm3-orbit-statusbar';
 statusRow.setAttribute('aria-label','Simulated orbit power status');
 scene.insertAdjacentElement('afterend',statusRow);
 statusRow.appendChild(badge);
 const note=document.createElement('small');note.className='pm3-orbit-status-note';
 note.textContent='SIMULATED POWER · Changes with the rotating 3D orbit';
 statusRow.appendChild(note);
 const sensor=document.createElement('span');sensor.id='pm3OrbitLiveINA';sensor.className='pm3-orbit-live';sensor.dataset.live='false';sensor.textContent='INA219 · no live current yet';statusRow.appendChild(sensor)}
 // This companion label appears beside the ORIGINAL interactive 3D CAD, not in place of it.
 const cad=$('cadView');if(cad){engineering=document.createElement('div');engineering.id='pm3Engineering';engineering.className='pm3-engineering';engineering.innerHTML='<b>⚡ Power management / rotating orbit</b><span id="pm3EngineeringSummary">Select 3D Orbit to view the synchronized energy cycle.</span><small> Simulated model is separate from physical INA219 current.</small><div id="pm3CadLiveINA" style="margin-top:8px;color:#7de6cd;font-weight:700">INA219 · waiting for USB readings</div>';cad.insertAdjacentElement('afterend',engineering)}
 panel.querySelectorAll('[data-pm3]').forEach(btn=>btn.addEventListener('click',()=>{preview=btn.dataset.pm3;panel.querySelectorAll('[data-pm3]').forEach(x=>x.classList.toggle('pm3-selected',x===btn));update(true)}));
 $('pm3Reset').onclick=()=>{charge=74;history.length=0;oldPhase=null;lastTime=performance.now();update(true)};
 $('pm3Draw').addEventListener('input',()=>{$('pm3DrawText').textContent=fmt(+$('pm3Draw').value,1)+' W';update(true)});
 $('pm3Speed').addEventListener('input',()=>{$('pm3SpeedText').textContent=$('pm3Speed').value+'×';update(true)});
 return true;
}
function drawCharge(){const canvas=$('pm3Chart');if(!canvas)return;const g=canvas.getContext('2d');if(!g)return;const w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);g.strokeStyle='#345775';g.lineWidth=1;for(let y of [20,65,110]){g.beginPath();g.moveTo(15,y);g.lineTo(w-10,y);g.stroke()}if(history.length<2)return;g.beginPath();g.strokeStyle='#54ebcf';g.lineWidth=3;history.forEach((o,i)=>{const x=16+(w-28)*i/Math.max(1,history.length-1),y=7+(h-18)*(1-o/100);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();g.fillStyle='#5eedd4';const y=7+(h-18)*(1-history[history.length-1]/100);g.beginPath();g.arc(w-12,y,4,0,2*Math.PI);g.fill()}

function liveINA(){
 const sensor=window.ULTRON_HW_LATEST,packet=sensor?.packet,connected=($('hwconn')?.textContent||'').trim();
 const age=sensor&&Number.isFinite(sensor.when)?Math.max(0,Math.round((Date.now()-sensor.when)/1000)):null;
 const live=!!packet&&sensor.origin==='USB'&&connected==='USB live readings'&&age!==null&&age<=90;
 const historical=!!packet&&sensor.origin==='SD log';
 const stale=!!packet&&!live&&!historical;
 const valid=!!packet&&(!Number.isInteger(packet.ok)||!!(packet.ok&2));
 const find=(...paths)=>{
  for(const path of paths){
   let v=packet;for(const key of path.split('.'))v=v!=null?v[key]:null;
   if(typeof v==='number'&&Number.isFinite(v))return v;
  }return null;
 };
 const current=valid?find('i','power.current_mA','power.current_ma','ina219.current_ma'):null;
 const voltage=valid?find('v','power.bus_voltage','power.bus_voltage_v','ina219.voltage_v'):null;
 const power=valid?find('p','power.power_mW','power.power_mw','ina219.power_mw'):null;
 const hasReading=current!==null||voltage!==null||power!==null;
 const state=live&&hasReading?'live':historical&&hasReading?'historical':stale&&hasReading?'stale':'unknown';
 const label=state==='live'?'LIVE USB · '+age+'s':state==='historical'?'SD LOG · HISTORY':state==='stale'?'STALE · NOT LIVE':live?'USB LIVE · NO INA219':'AWAITING SENSOR';
 const set=(id,text)=>{const e=$(id);if(e&&e.textContent!==text)e.textContent=text;};
 const fmtActual=(v,d,unit)=>v==null?'— '+unit:v.toFixed(d)+' '+unit;
 set('pm3LiveState',label);
 const tag=$('pm3LiveState');if(tag)tag.dataset.state=state;
 set('pm3LiveCurrent',fmtActual(current,1,'mA'));
 set('pm3LiveVoltage',fmtActual(voltage,2,'V'));
 set('pm3LivePower',fmtActual(power,1,'mW'));
 let note=state==='live'
   ?'Real INA219 monitored bus values, received '+age+' s ago. Updated from the ESP32 serial feed; not orbital simulation.'
   :state==='historical'?'Imported SD-log measurements. These values are historical, NOT currently live.'
   :state==='stale'?'Showing last received INA219 measurements. USB data is stale or disconnected; values are NOT live.'
   :live?'ESP32 is connected but this packet has no valid INA219 values. Check the sensor validity bit (ok & 2) and firmware output.'
   :'No real INA219 readings received. Connect the ESP32 in the telemetry panel and confirm JSON readings are arriving.';
 if(!hasReading&&packet)note+=' A sensor visible on the board does not guarantee it is measured by the firmware.';
 set('pm3LiveNote',note);
 const orbit=$('pm3OrbitLiveINA');
 if(orbit){orbit.dataset.live=String(state==='live');orbit.textContent=state==='live'
   ?'INA219 LIVE · '+(current!==null?current.toFixed(1)+' mA':voltage!==null?voltage.toFixed(2)+' V':power.toFixed(1)+' mW')
   :state==='historical'?'INA219 · SD LOG (historical)':state==='stale'?'INA219 · last reading (stale)':'INA219 · waiting for live USB';}
 set('pm3CadLiveINA',state==='live'
   ?'INA219 LIVE · '+fmtActual(current,1,'mA')+' · '+fmtActual(voltage,2,'V')+' · '+fmtActual(power,1,'mW')
   :state==='historical'?'INA219 · historical SD measurement':state==='stale'?'INA219 · last measurement is stale':'INA219 · no current live reading');
}

function update(force){if(!$('pm3Panel'))return;liveINA();const now=performance.now(),elapsed=bound((now-lastTime)/1000,0,.5);lastTime=now;
 const raw=window.ULTRON_ORBIT_POWER; const valid=raw&&typeof raw.eclipse==='boolean'&&Number.isFinite(raw.generationW)&&Number.isFinite(raw.phaseDeg);
 if(!valid){$('pm3ModeText').textContent='Awaiting 3D orbit lighting data';$('pm3Description').textContent='Open 3D Orbit. The power display will follow the real-time geometry of that visual simulation, not use fabricated hardware readings.';return}
 if(oldPhase==null||Math.abs(raw.phaseDeg-oldPhase)>0.00001){lastMove=now;phaseMoving=true}else phaseMoving=now-lastMove<1300;oldPhase=raw.phaseDeg;
 let lit=!raw.eclipse,phase='nominal',source=preview==='auto'?'AUTO · ROTATING 3D MODEL':'MANUAL DEMO PREVIEW';
 if(preview==='eclipse'){lit=false;phase='eclipse'}
 else if(preview==='nominal'){lit=true;phase='nominal'}
 else if(preview==='coast'){lit=!raw.eclipse;phase='coast'}
 else{phase=raw.eclipse?'eclipse':'nominal';if(charge<=14)phase='coast'}
 // 3D model supplies sunlight state; the illustrative EPS model supplies watts/SOC.
 const sunW=lit?(preview==='nominal'&&raw.eclipse?2.3:bound(raw.generationW,0,3.5)):0;
 const nominalDraw=+$('pm3Draw').value;
 const load=phase==='nominal'?nominalDraw:phase==='eclipse'?0.78:0.34;
 const net=sunW-load;
 // Simulation clock is scaled; avoid fake battery-change while the 3D animation is paused.
 if((phaseMoving||preview!=='auto')&&elapsed>0){charge=bound(charge+net*elapsed*(+$('pm3Speed').value)/3600/10*100,0,100)}
 history.push(charge);if(history.length>170)history.shift();
 const modes={nominal:'☀ NOMINAL · SUNLIT',eclipse:'◐ ECLIPSE · BATTERY POWER',coast:'◌ FREE ORBIT · LOW-POWER COAST'};
 $('pm3Panel').dataset.phase=phase;$('pm3Mode').dataset.phase=phase;
 $('pm3ModeText').textContent=modes[phase];$('pm3Source').textContent=source;
 $('pm3OrbitPhase').textContent='3D orbit phase '+fmt(raw.phaseDeg,0)+'°';
 $('pm3Solar').textContent=fmt(sunW,2)+' W';$('pm3Lighting').textContent=lit?'Sun-facing (illustrative)':'Earth shadow · no generation';
 $('pm3Net').textContent=(net>=0?'+':'')+fmt(net,2)+' W';$('pm3Net').style.color=net>=0?'#70f5d6':'#ffd09a';
 $('pm3Load').textContent=fmt(load,2)+' W';$('pm3Payload').textContent=phase==='coast'?'Payload & high-power tasks off':phase==='eclipse'?'Nonessential payload reduced':'Electronics & payload enabled';
 $('pm3Charge').textContent=fmt(charge,1)+'%';$('pm3BatteryAction').textContent=net>=0?'Battery charging':'Battery supplying deficit';
 $('pm3FlowText').textContent=net>=0?'CHARGING':'DISCHARGING';
 $('pm3Fill').style.width=charge+'%';$('pm3Fill').style.background=charge<15?'linear-gradient(90deg,#a73b60,#fa7995)':charge<30?'linear-gradient(90deg,#a97130,#ffcc70)':'linear-gradient(90deg,#2e9684,#5ceac3)';
 $('pm3Voltage').textContent='Cell estimate '+fmt(3+1.2*Math.pow(charge/100,.65),2)+' V';
 $('pm3Description').textContent=phase==='nominal'?'The solar array supplies modeled power to the electronics; surplus energy charges the battery.':phase==='eclipse'?'Earth blocks sunlight. Solar generation falls to zero and the battery supplies the reduced essential load.':'Free-orbit/low-power coast: high-power payloads are disabled to protect battery reserve. Solar charging is still possible whenever sunlit.';
 if(badge){badge.dataset.phase=phase;$('pm3BadgeText').textContent=modes[phase];$('pm3BadgePower').textContent=fmt(sunW,1)+' W solar · '+fmt(charge,1)+'% charge • SIMULATED'}
 if(engineering){$('pm3EngineeringSummary').textContent=modes[phase]+' | '+fmt(sunW,2)+' W solar | '+fmt(charge,1)+'% modeled battery | '+fmt(load,2)+' W electronics load'}
 drawCharge();
}
function go(){if(!mount())setTimeout(go,400);else{update(true);setInterval(()=>update(false),320)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go,{once:true});else go();
})();