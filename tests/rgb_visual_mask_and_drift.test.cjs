'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const api=require('../web/water_tray_rgb_core.js');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
test('colour-rule mask highlights visually brown pixels and not clear water',()=>{
 const size=100,w=10,h=10;
 const pixels=new Uint8ClampedArray(size*4);
 for(let p=0;p<size;p++){pixels[4*p]=215;pixels[4*p+1]=220;pixels[4*p+2]=212;pixels[4*p+3]=255;}
 const clear=api.visualMask(pixels,w,h);
 assert.equal(clear.count,0);
 for(let y=2;y<8;y++)for(let x=2;x<8;x++){
  const k=4*(y*w+x);pixels[k]=95;pixels[k+1]=46;pixels[k+2]=25;
 }
 const dark=api.visualMask(pixels,w,h);
 assert.ok(dark.count>=30 && dark.count<45);
 assert.equal(dark.method,'color-threshold-only');
 assert.equal(dark.mask.length,w*h);
 assert.ok(dark.fraction>0);
});
test('colour map deliberately is not trained oil segmentation',()=>{
 assert.throws(()=>api.visualMask(new Uint8Array(0),256,256),/Invalid RGB frame/);
 const source=file('web/water_tray_rgb_core.js');
 assert.match(source,/NOT a trained pixel segmentation/);
});
test('public RGB page shows visual overlay and accurately labels 48h motion as non-forecast',()=>{
 const page=file('web/rgb_live.html');
 const script=/\<script\>\s*([\s\S]*?)\<\/script\>\s*\<\/body\>/.exec(page);
 assert.ok(script,'expected the inline browser logic');
 assert.doesNotThrow(()=>new Function(script[1]),'embedded RGB script must parse');
 assert.match(page,/id="rgbMaskPreview"/);
 assert.match(page,/id="rgbDriftCanvas"/);
 assert.match(page,/NOT a weather forecast/);
 assert.match(page,/drawCandidateOverlay\(\);/);
 assert.match(page,/ultron-rgb-visual-frame/);
});
test('same-origin iframe relays RGB mask separately without claiming a SAR or real-weather forecast',()=>{
 const bridge=file('web/ultron_rgb_inline.js');
 const main=file('web/ultron_main_detection_bridge.js');
 assert.doesNotThrow(()=>new Function(bridge));
 assert.doesNotThrow(()=>new Function(main));
 assert.match(bridge,/ev\.source!==frame\.contentWindow\|\|ev\.origin!==location\.origin/);
 assert.match(bridge,/ultron:rgb-visual-demo/);
 assert.match(bridge,/color-rule-not-AI-segmentation/);
 assert.match(main,/latest\.kind==='rgb'/);
 assert.match(main,/ultron:rgb-visual-demo/);
 assert.match(main,/latest\.kind!=='sar'/);
 assert.match(main,/NOT a forecast/);
});
