(()=>{'use strict';
/*
 ULTRON-SAT 48h scenario forecast: genuine SAR U-Net mask + hourly Open-Meteo
 weather and marine forecast. Advection = surface current + 3% downwind.
 This is a teaching scenario, NOT a calibrated trajectory/shoreline forecast.
*/
let last=null;
const times=[6,12,24,48],COLORS=['#50e7ed','#59b2ff','#a882ff','#ff7995'];
function tag(type,parent,text){const e=document.createElement(type);if(text!==undefined)e.textContent=text;if(parent)parent.append(e);return e}
function toRad(x){return x*Math.PI/180}
function normDirection(x){return (x%360+360)%360}
function forecastPoint(hourly,key,epoch){
 const ts=hourly?.time,values=hourly?.[key];
 if(!Array.isArray(ts)||!Array.isArray(values))throw Error('Forecast missing hourly '+key+'. Select a valid ocean location.');
 let closest=0,delta=Infinity;
 for(let j=0;j<ts.length;j++){const t=typeof ts[j]==='number'?ts[j]*1000:Date.parse(ts[j]+'Z');const d=Math.abs(epoch-t);if(d<delta){closest=j;delta=d}}
 if(delta>90*60*1000)throw Error('Forecast does not cover the requested 48-hour period.');
 const value=Number(values[closest]);
 if(!Number.isFinite(value)||value<0 && /speed|velocity|height/.test(key))throw Error('Marine or weather forecast has no valid '+key+' at these coordinates.');
 return value;
}
function vector(kmh,azimuthTo){const theta=toRad(azimuthTo);return {east:kmh*Math.sin(theta),north:kmh*Math.cos(theta)}}
function maskImage(mask,color){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const d=ctx.createImageData(256,256);
 const rgb=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
 for(let j=0;j<65536;j++)if(mask[j]){const k=j*4;d.data[k]=rgb[0];d.data[k+1]=rgb[1];d.data[k+2]=rgb[2];d.data[k+3]=155}
 ctx.putImageData(d,0,0);return c;
}
function makeUI(){
 const modal=document.getElementById('ultronBrowserAI');if(!modal)return;
 const box=modal.querySelector('.aiBox');if(!box||document.getElementById('ultronDriftControls'))return;
 const div=tag('section',box);div.id='ultronDriftControls';
 div.style.cssText='border-top:1px solid #45758b;margin-top:20px;padding-top:15px';
 const h=tag('h3',div,'48-hour oil-slick drift · forecast-driven experimental simulation');h.style.margin='0 0 8px';
 const intro=tag('p',div,'Uses the actual SAR model segmentation plus hourly forecast ocean currents and wind. Enter the approximate image centre (latitude/longitude) and its real-world scale. No location or scale is inferred from pixels.');
 intro.style.fontSize='13px';
 const row=tag('div',div);row.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0';
 function field(label,placeholder,min,max,step,value){const lab=tag('label',row,label+' ');lab.style.cssText='display:grid;gap:4px;font-size:12px';const input=tag('input',lab);input.type='number';input.placeholder=placeholder;input.step=step;input.min=min;input.max=max;input.style.cssText='background:#092038;border:1px solid #47718b;border-radius:7px;color:white;padding:9px;width:145px';if(value!=null)input.value=value;return input}
 const lat=field('Image centre latitude','e.g. 25.1',-90,90,'any');
 const lon=field('Image centre longitude','e.g. 55.0',-180,180,'any');
 const scale=field('Image scale (km / pixel)','e.g. 0.01',0.000001,100,'any');
 const controls=tag('div',div);controls.style.cssText='display:flex;flex-wrap:wrap;gap:9px;align-items:center';
 const run=tag('button',controls,'Fetch wind + ocean currents · Predict 48 hours');run.type='button';
 const status=tag('p',div,'First analyze a SAR image above, then enter its geographical coordinates and pixel scale.');
 status.setAttribute('role','status');
 const stats=tag('div',div);stats.style.cssText='font-size:13px;line-height:1.65;white-space:pre-line;margin:10px 0';
 const viz=tag('canvas',div);viz.width=640;viz.height=440;viz.style.cssText='display:none;width:100%;max-width:720px;aspect-ratio:16/11;border:1px solid #47718b;border-radius:10px;background:#071727';
 const select=tag('div',div);select.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:10px 0';
 const note=tag('p',div,'Simplified 2D surface advection: each hour, predicted displacement equals ocean-current velocity plus 3% of wind velocity (downwind). Forecasts are regional estimates, not measured at the slick; ignores turbulence, shoreline interaction, evaporation, wave-driven drift and changing slick geometry. Not for navigation or emergency response.');
 note.style.cssText='font-size:12px;color:#afcbd7;line-height:1.5';
 tag('a',div,'Weather source: Open-Meteo Forecast API').href='https://open-meteo.com/en/docs';
 div.lastChild.target='_blank';div.lastChild.rel='noopener noreferrer';div.lastChild.style.color='#5ee4f1';
 const marineLink=tag('a',div,' · Marine currents: Open-Meteo Marine API');marineLink.href='https://open-meteo.com/en/docs/marine-weather-api';marineLink.target='_blank';marineLink.rel='noopener noreferrer';marineLink.style.color='#5ee4f1';
 let frames=null,chosen=48;
 function paint(){
  if(!last||!frames)return;
  const o=viz.getContext('2d');o.clearRect(0,0,viz.width,viz.height);
  const img=last.sourceCanvas;
  const pad=20,margin=125;
  const displayW=viz.width-2*margin,displayH=viz.height-2*pad;
  const factor=Math.min(displayW/last.width,displayH/last.height);
  const w=last.width*factor,hh=last.height*factor,x=(viz.width-w)/2,y=(viz.height-hh)/2;
  o.fillStyle='#061626';o.fillRect(0,0,viz.width,viz.height);
  o.globalAlpha=.8;o.drawImage(img,x,y,w,hh);o.globalAlpha=1;
  for(let i=0;i<times.length;i++){
   const hour=times[i],move=frames[hour];if(hour>chosen)continue;
   const image=maskImage(last.mask,COLORS[i]);const dx=move.east/frames.scale*factor,dy=-move.north/frames.scale*factor;
   o.drawImage(image,x+dx,y+dy,w,hh);
  }
  o.fillStyle='#e3f9ff';o.font='bold 13px system-ui';o.fillText('Projected surface drift · 0–'+chosen+'h',12,20);
  o.font='12px system-ui';
  for(let i=0;i<times.length;i++){o.fillStyle=COLORS[i];o.fillRect(12,37+i*21,10,10);o.fillStyle='#dcecf9';o.fillText('+'+times[i]+'h'+(times[i]>chosen?' (hidden)':''),30,47+i*21)}
  o.fillStyle='#a8c9d6';o.font='11px system-ui';o.fillText('Model mask translated by regional forecast vectors; not a coastline forecast',12,viz.height-8);
 }
 function choose(hour){chosen=hour;for(const b of select.querySelectorAll('button'))b.style.opacity=Number(b.dataset.hour)===hour?'1':'.53';paint()}
 for(const hour of times){const b=tag('button',select,'View +'+hour+'h');b.type='button';b.dataset.hour=hour;b.addEventListener('click',()=>choose(hour))}
 document.addEventListener('ultron:sar-detection',ev=>{
  const d=ev.detail;if(!d?.mask||d.mask.length!==65536)return;
  last=d;frames=null;viz.style.display='none';stats.textContent='';
  if(lat.value.trim() && lon.value.trim() && scale.value.trim()){
   status.textContent='Image analyzed: automatically updating the next 48 hours from the saved geographic inputs…';
   // Existing valid geographical context permits automatic live forecast refresh.
   Promise.resolve().then(()=>run.click());
  }else{
   status.textContent='SAR detection ready. Enter actual ocean coordinates and km/pixel to enable automatically refreshed 48-hour forecasts. Without them, the main animated drift uses labeled manual slider values.';
  }
 });
 run.onclick=async()=>{
  if(!last){status.textContent='Analyze an image with the trained SAR U-Net above first.';return}
  const latitude=Number(lat.value),longitude=Number(lon.value),scaleKm=Number(scale.value);
  if(!lat.value||!lon.value||!scale.value||!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180||!Number.isFinite(scaleKm)||scaleKm<=0){
   status.textContent='Enter a valid latitude (-90 to 90), longitude (-180 to 180), and actual positive km per pixel.';return
  }
  run.disabled=true;status.textContent='Fetching hourly wind and ocean-current forecasts from Open-Meteo…';
  try{
   const q='latitude='+encodeURIComponent(latitude)+'&longitude='+encodeURIComponent(longitude)+'&forecast_hours=72&timezone=GMT';
   const weatherUrl='https://api.open-meteo.com/v1/forecast?'+q+'&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh';
   const marineUrl='https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=ocean_current_velocity,ocean_current_direction,wave_height';
   const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),18000);
   let wind,marine;
   try{
    const response=await Promise.all([fetch(weatherUrl,{signal:ctrl.signal}),fetch(marineUrl,{signal:ctrl.signal})]);
    if(response.some(r=>!r.ok))throw Error('Weather/marine service returned '+response.map(r=>r.status).join(', '));
    [wind,marine]=await Promise.all(response.map(r=>r.json()));
   }finally{clearTimeout(timeout)}
   if(wind.error||marine.error)throw Error(wind.reason||marine.reason||'Forecast data unavailable');
   const start=Math.floor(Date.now()/3600000)*3600000;
   const state={scale:scaleKm,lat:latitude,lon:longitude,0:{east:0,north:0}};
   let east=0,north=0;
   let sample;
   for(let hour=1;hour<=48;hour++){
    const epoch=start+(hour-1)*3600000;
    const windSpeed=forecastPoint(wind.hourly,'wind_speed_10m',epoch);
    const windFrom=forecastPoint(wind.hourly,'wind_direction_10m',epoch);
    const currentSpeed=forecastPoint(marine.hourly,'ocean_current_velocity',epoch);
    const currentTo=forecastPoint(marine.hourly,'ocean_current_direction',epoch);
    const current=vector(currentSpeed,currentTo),downwind=vector(.03*windSpeed,normDirection(windFrom+180));
    east+=current.east+downwind.east;
    north+=current.north+downwind.north;
    if(hour===1)sample={wind:windSpeed,windFrom,current:currentSpeed,currentTo};
    if(times.includes(hour))state[hour]={east,north,km:Math.hypot(east,north)};
   }
   frames=state;
   document.dispatchEvent(new CustomEvent('ultron:drift-forecast',{detail:state}));
   viz.style.display='block';
   stats.textContent='48h predicted displacement: '+state[48].km.toFixed(2)+' km ('+state[48].east.toFixed(2)+' km east, '+state[48].north.toFixed(2)+' km north).\n'+
    '+6h: '+state[6].km.toFixed(2)+' km  ·  +12h: '+state[12].km.toFixed(2)+' km  ·  +24h: '+state[24].km.toFixed(2)+' km  ·  +48h: '+state[48].km.toFixed(2)+' km.\n'+
    'Initial forecast wind: '+sample.wind.toFixed(1)+' km/h from '+sample.windFrom.toFixed(0)+'° · current: '+sample.current.toFixed(2)+' km/h toward '+sample.currentTo.toFixed(0)+'°.\n'+
    'Location: '+latitude.toFixed(3)+'°, '+longitude.toFixed(3)+'° · image scale '+scaleKm+' km/pixel.';
   status.textContent='Forecast loaded. These overlays show illustrative movement of the detected slick, not a validated 48h spill prediction.';
   choose(48);
  }catch(error){status.textContent='Forecast unavailable: '+(error?.message||error)+'. Use verified ocean coordinates; no displacement is fabricated.';stats.textContent='';viz.style.display='none'}
  finally{run.disabled=false}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeUI,{once:true});else makeUI();
})();