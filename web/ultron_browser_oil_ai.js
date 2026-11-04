(()=>{'use strict';
const SCRIPT='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';
const MODEL='models/oil_sar_unet.onnx';
const MEAN=[.485,.456,.406],STD=[.229,.224,.225];
const css=`
#ultronBrowserAI{position:fixed;inset:0;z-index:1000000;background:#00111de8;display:none;overflow:auto;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;color:#e5f7ff;font:14px system-ui}
#ultronBrowserAI.open{display:flex}
#ultronBrowserAI .aiBox{width:min(900px,96vw);background:#0d2539;border:1px solid #4380a4;border-radius:18px;padding:20px;box-shadow:0 20px 80px #0009}
#ultronBrowserAI h2{margin:0 0 8px;font-size:22px}
#ultronBrowserAI p{line-height:1.45;opacity:.87}
#ultronBrowserAI button{padding:10px 14px;color:white;background:#186b90;border:1px solid #6cb9d7;border-radius:9px;cursor:pointer}
#ultronBrowserAI button:disabled{opacity:.5;cursor:default}
#ultronBrowserAI input{color:#e5f7ff;max-width:100%}
#ultronBrowserAI .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:10px 0}
#ultronBrowserAI canvas{width:100%;max-width:420px;border:1px solid #395e74;border-radius:10px}
#ultronBrowserAI .imageRow{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#ultronAiLaunch{position:fixed;z-index:999999;left:12px;bottom:68px;background:#184967;color:#dffaff;padding:9px 12px;border:1px solid #66bfdd;border-radius:10px;cursor:pointer;font:12px system-ui;box-shadow:0 5px 20px #0008}
@media(max-width:650px){#ultronBrowserAI .imageRow{grid-template-columns:1fr}}
`;
let runner, loadedPromise;
function loadScript(){return new Promise((ok,no)=>{if(window.ort){ok();return}const s=document.createElement('script');s.src=SCRIPT;s.onload=ok;s.onerror=()=>no(Error('Unable to load ONNX Runtime library'));document.head.append(s)})}
async function loadModel(setStatus){
 if(runner)return runner;
 if(!loadedPromise)loadedPromise=(async()=>{
  setStatus('Loading the trained U-Net into this browser (initial model download may be large)…');
  await loadScript();
  window.ort.env.wasm.numThreads=1;
  window.ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
  const modelUrl=new URL(MODEL,document.baseURI);
  const response=await fetch(modelUrl.toString(),{cache:'force-cache'});
  if(!response.ok)throw Error('Trained browser model is not published yet (HTTP '+response.status+').');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<1000000)throw Error('Model download incomplete.');
  runner=await window.ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  setStatus('Trained SAR model loaded; image never leaves your browser.');
  return runner;
 })().catch(e=>{loadedPromise=null;throw e});
 return loadedPromise;
}
function element(tag,attrs={},parent){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='text')e.textContent=v;else if(k==='class')e.className=v;else e.setAttribute(k,v)}if(parent)parent.append(e);return e}
async function decode(file){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);no(Error('Use a valid JPG or PNG image'))};im.src=u})}
function createUi(){
const style=element('style',{text:css},document.head);
const launch=element('button',{id:'ultronAiLaunch',text:'Oil detection · Run AI in browser'},document.body);
const panel=element('div',{id:'ultronBrowserAI',role:'dialog','aria-label':'Browser oil detection'},document.body);
const box=element('div',{class:'aiBox'},panel);
const heading=element('div',{class:'row'},box);
element('h2',{text:'ULTRON-SAT · Trained SAR Oil Detection'},heading);
const close=element('button',{text:'Close','aria-label':'Close oil detection'},heading);
close.style.marginLeft='auto';
element('p',{text:'Run our trained U-Net (ResNet34) directly on your own device. No upload to an external server. Designed for Sentinel-1 SAR-derived RGB tiles; ordinary ESP32 photographs are out-of-domain and predictions are not reliable oil-spill evidence.'},box);
const control=element('div',{class:'row'},box);
const file=element('input',{type:'file',accept:'image/png,image/jpeg'},control);
const run=element('button',{text:'Analyze image'},control);
const status=element('p',{text:'Choose a Sentinel-1 SAR-derived RGB tile to analyze.'},box);
status.setAttribute('role','status');
const result=element('p',{},box);
const canvases=element('div',{class:'imageRow'},box);
const left=element('div',{},canvases);element('strong',{text:'Input image'},left);const original=element('canvas',{},left);
const right=element('div',{},canvases);element('strong',{text:'Candidate oil overlay (orange)'},right);const overlay=element('canvas',{},right);
const disclaimer=element('p',{text:'Research prototype · A positive segmentation mask is not proof of oil contamination. Browser image resizing may differ slightly from the original Python/OpenCV preprocessing. The six-class RGB ESP32 camera model is separate and is not part of this SAR detector.'},box);
const setStatus=t=>status.textContent=t;
function show(open){panel.classList.toggle('open',open);launch.style.display=open?'none':''}
launch.onclick=()=>show(true);close.onclick=()=>show(false);
panel.addEventListener('click',e=>{if(e.target===panel)show(false)});
run.onclick=async()=>{
 const selected=file.files?.[0];if(!selected){setStatus('Select a JPG or PNG image first.');return}
 if(selected.size>15*1024*1024){setStatus('Image exceeds 15 MB limit.');return}
 run.disabled=true;result.textContent='';
 try{
  const im=await decode(selected);
  if(im.naturalWidth<16||im.naturalHeight<16||im.naturalWidth*im.naturalHeight>36000000)throw Error('Image dimensions outside supported limits.');
  const session=await loadModel(setStatus);
  const c=document.createElement('canvas');c.width=c.height=256;
  const cx=c.getContext('2d',{willReadFrequently:true});
  cx.drawImage(im,0,0,256,256);
  const rgb=cx.getImageData(0,0,256,256).data;
  const t=new Float32Array(3*256*256);
  for(let j=0;j<256*256;j++)for(let k=0;k<3;k++)t[k*256*256+j]=(rgb[j*4+k]/255-MEAN[k])/STD[k];
  setStatus('Running actual U-Net inference in browser…');
  const start=performance.now();
  const output=await session.run({[session.inputNames[0]]:new window.ort.Tensor('float32',t,[1,3,256,256])});
  const y=output[session.outputNames[0]];
  if(y.data.length!==65536)throw Error('Unexpected model output shape');
  original.width=overlay.width=im.naturalWidth;original.height=overlay.height=im.naturalHeight;
  const o=original.getContext('2d');o.drawImage(im,0,0);
  // First calculate probabilities in the model's native 256x256 output.
  const probCanvas=document.createElement('canvas');probCanvas.width=probCanvas.height=256;
  const pc=probCanvas.getContext('2d'),map=pc.createImageData(256,256);
  for(let j=0;j<65536;j++){const z=y.data[j];const p=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));let q=Math.round(p*255);let ix=j*4;map.data[ix]=map.data[ix+1]=map.data[ix+2]=q;map.data[ix+3]=255}
  pc.putImageData(map,0,0);
  const oc=overlay.getContext('2d');oc.drawImage(im,0,0);
  const up=document.createElement('canvas');up.width=overlay.width;up.height=overlay.height;
  const uc=up.getContext('2d',{willReadFrequently:true});uc.imageSmoothingEnabled=true;uc.drawImage(probCanvas,0,0,up.width,up.height);
  const pxy=uc.getImageData(0,0,up.width,up.height).data;
  const rgba=oc.getImageData(0,0,up.width,up.height);
  let n=0;for(let j=0;j<pxy.length/4;j++)if(pxy[j*4]>=128){n++;let k=j*4;rgba.data[k]=Math.round(.55*255+.45*rgba.data[k]);rgba.data[k+1]=Math.round(.55*115+.45*rgba.data[k+1]);rgba.data[k+2]=Math.round(.45*rgba.data[k+2])}
  oc.putImageData(rgba,0,0);
  const pct=100*n/(up.width*up.height);
  result.textContent='Candidate pixels: '+pct.toFixed(2)+'% · Model completed in '+Math.round(performance.now()-start)+' ms · '+(pct>=.1?'Candidate region flagged':'Below 0.1% reporting threshold')+'.';
  setStatus('Analysis complete. This is an experimental SAR segmentation result, not confirmed contamination.');
 }catch(e){setStatus('AI unavailable: '+(e?.message||e));console.error('ULTRON browser oil model',e)}
 finally{run.disabled=false}
};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createUi,{once:true});else createUi();
})();
