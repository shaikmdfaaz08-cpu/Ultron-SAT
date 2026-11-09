'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseCameraUrl,fresh}=require('../web/ultron_live_links.js');
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
