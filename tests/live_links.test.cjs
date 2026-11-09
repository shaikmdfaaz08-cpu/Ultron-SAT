'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseCameraUrl,cameraSnapshotUrl,fresh}=require('../web/ultron_live_links.js');
test('HTTPS camera sources can render in GitHub Pages',()=>{
 const c=parseCameraUrl('https://example.test/stream','https:');
 assert.equal(c.inline,true);
 assert.equal(c.url,'https://example.test/stream');
});
test('local HTTP camera must open outside the HTTPS page',()=>{
 const c=parseCameraUrl('http://192.168.1.50:81/stream','https:');
 assert.equal(c.inline,false);
 assert.match(c.reason,/cannot be embedded/);
});
test('rejects malformed and credential-bearing camera URLs',()=>{
 assert.throws(()=>parseCameraUrl('javascript:alert(1)','https:'),/Only HTTP/);
 assert.throws(()=>parseCameraUrl('http://user:password@localhost/stream','https:'),/password/);
 assert.throws(()=>parseCameraUrl('','https:'),/Enter/);
});
test('stale samples do not read as live hardware',()=>{
 assert.equal(fresh(1000,90000,90000),true);
 assert.equal(fresh(1000,92000,90000),false);
 assert.equal(fresh(undefined,90000,90000),false);
});

test('snapshot request opens a real JPEG endpoint from local MJPEG port',()=>{
 const u=cameraSnapshotUrl('http://192.168.1.25:81/stream','https:');
 assert.equal(u,'http://192.168.1.25/capture');
});
test('secure camera gateway can expose matching snapshot endpoint',()=>{
 const u=cameraSnapshotUrl('https://camera.example.test/stream','https:');
 assert.equal(u,'https://camera.example.test/capture');
});
test('snapshot rejects unknown non-camera source paths',()=>{
 assert.throws(()=>cameraSnapshotUrl('https://example.test/other','https:'),/must end/);
});
