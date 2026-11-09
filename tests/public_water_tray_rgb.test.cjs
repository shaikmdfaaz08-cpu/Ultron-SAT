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
