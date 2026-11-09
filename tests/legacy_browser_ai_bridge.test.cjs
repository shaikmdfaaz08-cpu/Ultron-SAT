'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'web/ultron_legacy_ai_bridge.js'),'utf8');
const builder=fs.readFileSync(path.join(root,'build_static_dashboard.py'),'utf8');
test('legacy UI repair script is valid JavaScript',()=>{
 assert.doesNotThrow(()=>new Function(source));
});
test('legacy RGB six-class server button is bridged into working browser RGB experiment',()=>{
 assert.match(source,/rgbAnalyzeBtn/);
 assert.match(source,/stopImmediatePropagation/);
 assert.match(source,/getElementById\('upload'\)/);
 assert.match(source,/ultronRGBInline/);
 assert.match(source,/pickFile\(picker,f\)/);
});
test('original Run AI model button is restored and starts browser SAR without hardware',()=>{
 assert.match(source,/oldSar\.cloneNode\(true\)/);
 assert.match(source,/restored\.textContent='Run AI model'/);
 assert.match(source,/restored\.disabled=false/);
 assert.match(source,/oldSar\.replaceWith\(restored\)/);
 assert.match(source,/run\.click\(\)/);
 assert.match(source,/ultron:sar-file-selected/);
 assert.match(source,/ultron:sar-detection/);
});
test('no conflicting Run AI model interception remains in published site',()=>{
 assert.doesNotMatch(builder,/"ultron_ai_button_fix\.js"/);
 assert.match(builder,/"ultron_legacy_ai_bridge\.js"/);
});
test('static GitHub Pages builder does not display optional AI backend popup',()=>{
 assert.doesNotMatch(builder,/"ultron_ai_remote_bridge\.js"/);
 assert.match(builder,/"ultron_legacy_ai_bridge\.js"/);
});
