'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('a selected SAR JPG or PNG clears any stale RGB overlay and previews original',()=>{
 const source=read('web/ultron_main_detection_bridge.js');
 assert.doesNotThrow(()=>new Function(source));
 assert.match(source,/ultron:sar-file-selected/);
 assert.match(source,/originalDivider\.style\.display='none'/);
 assert.match(source,/originalOverlay\.style\.display='block'/);
 assert.match(source,/previewRequest/);
 assert.match(source,/window\.ultronActiveDetectionMode='sar'/);
 assert.match(source,/SAR image selected/);
 assert.match(source,/createObjectURL\(file\)/);
});
test('RGB camera frame updates cannot override selected SAR until RGB is selected',()=>{
 const bridge=read('web/ultron_main_detection_bridge.js');
 const embed=read('web/ultron_rgb_inline.js');
 const page=read('web/rgb_live.html');
 assert.match(bridge,/kind==='rgb'&&window\.ultronActiveDetectionMode==='sar'/);
 assert.match(embed,/ultron-rgb-selected/);
 assert.match(page,/function selectOpticalMode\(\)/);
 assert.match(page,/selectOpticalMode\(\);/);
});
test('Run AI model exists and connects to the local browser U-Net runner',()=>{
 const script=read('web/ultron_legacy_ai_bridge.js');
 const build=read('build_static_dashboard.py');
 assert.doesNotThrow(()=>new Function(script));
 assert.match(script,/restored\.textContent='Run AI model'/);
 assert.match(script,/pickFile\(picker,f\)/);
 assert.match(script,/run\.click\(\)/);
 assert.match(script,/ultron:sar-detection/);
 assert.doesNotMatch(build,/"ultron_ai_button_fix\.js"/);
});
