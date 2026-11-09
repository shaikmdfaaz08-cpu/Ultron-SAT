'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {features,classify,captureEndpoint}=require('../web/water_tray_rgb_core.js');
const model=require('../experiments/water_tray_2026_11_09/prototype_model.json');
test('prototype is visibly separated from the SAR model and has no independent evaluation',()=>{
 assert.equal(model.verified_oil_detector,false);
 assert.equal(model.independent_test_accuracy,null);
 assert.match(fs.readFileSync(path.join(__dirname,'../web/rgb_live.html'),'utf8'),/not.*satellite SAR oil-spill model/i);
});
test('browser RGB extractor returns four numeric features matching 96x96 format',()=>{
 const pixels=new Uint8ClampedArray(96*96*4);
 for(let i=0;i<96*96;i++){pixels[i*4]=120;pixels[i*4+1]=55;pixels[i*4+2]=30;pixels[i*4+3]=255;}
 const got=features(pixels,96,96);
 assert.equal(got.length,4);
 got.forEach(n=>assert.ok(n>=0&&n<=1));
 assert.ok(got[1]>0.99);assert.ok(got[3]>0.99);
 const result=classify(got,model);
 assert.equal(result.independentTested,false);
 assert.ok(Number.isFinite(result.score));
});
test('remote public camera source requires HTTPS and capture endpoint',()=>{
 assert.equal(captureEndpoint('https://camera.example/capture'),'https://camera.example/capture');
 assert.throws(()=>captureEndpoint('http://192.168.1.9/capture'),/HTTPS/);
 assert.throws(()=>captureEndpoint('https://name:password@camera.example/capture'),/HTTPS/);
 assert.throws(()=>captureEndpoint('https://camera.example/stream'),/\/capture/);
});
test('invalid model is not accepted',()=>{
 assert.throws(()=>classify([0,0,0,0],{verified_oil_detector:true}),/experimental/);
});


test('main dashboard embeds RGB viewer beside the SAR detector, not a separate navigation flow',()=>{
 const builder=fs.readFileSync(path.join(__dirname,'../build_static_dashboard.py'),'utf8');
 const embed=fs.readFileSync(path.join(__dirname,'../web/ultron_rgb_inline.js'),'utf8');
 const page=fs.readFileSync(path.join(__dirname,'../web/rgb_live.html'),'utf8');
 const links=fs.readFileSync(path.join(__dirname,'../web/ultron_live_links.js'),'utf8');
 assert.match(builder,/"ultron_rgb_inline\.js"/);
 assert.match(embed,/getElementById\('ultronInlineAI'\)/);
 assert.match(embed,/rgb_live\.html\?embed=1/);
 assert.match(embed,/frame\.allow='camera'/);
 assert.match(embed,/ev\.source!==frame\.contentWindow\|\|ev\.origin!==location\.origin/);
 assert.match(page,/document\.body\.classList\.add\('embedded'\)/);
 assert.match(page,/ultron-rgb-height/);
 assert.match(links,/href="#ultronRGBInline"/);
});
