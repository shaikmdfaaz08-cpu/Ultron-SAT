'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const p = require('../web/ultron_telemetry_protocol.js');

test('invalid INA219 and temperature mask never invents sensor values',()=>{
 const t=p.normalize({b:1,n:2,ms:32071,ok:0,t:null,v:null,i:null,p:null,l:0},'USB',100);
 assert.equal(t.type,'telemetry');
 assert.equal(t.power.current_mA,null);
 assert.equal(t.power.bus_voltage,null);
 assert.equal(t.power.power_mW,null);
 assert.equal(t.environment.temperature_C,null);
 assert.equal(t.light.light1,0);
 assert.equal(t.source,'REAL HARDWARE');
});

test('valid INA219 data is available when bit 2 is set',()=>{
 const t=p.normalize({b:1,n:3,ms:5000,ok:2,v:5.01,i:125.5,p:628.75,l:250},'USB',100);
 assert.equal(t.power.bus_voltage,5.01);
 assert.equal(t.power.current_mA,125.5);
 assert.equal(t.power.power_mW,628.75);
});

test('LoRa receiver envelope preserves sensor packet and signal diagnostics',()=>{
 const t=p.normalize({rssi:-90,snr:6.5,payload:{b:1,n:4,ms:30000,ok:2,v:5.0,i:120.0,p:600.0,l:99}},'USB',110);
 assert.equal(t.power.current_mA,120);
 assert.equal(t.lora.rssi,-90);
 assert.equal(t.lora.snr,6.5);
 assert.equal(t.sequence,4);
});

test('malformed JSON and impossible validity masks are rejected',()=>{
 assert.throws(()=>p.normalize('{not-json}','USB'),/Invalid JSON/);
 assert.throws(()=>p.normalize({b:1,n:1,ms:0,ok:99,v:5},'USB'),/Validity mask/);
});

test('serial line framing handles split byte chunks without duplicates',()=>{
 const results=[];const reader=new p.Lines(line=>results.push(line));
 reader.push('{"b":1,"n":1');
 reader.push(',"ms":1,"ok":0,"l":0}\n');
 assert.equal(results.length,1);
 assert.equal(p.normalize(results[0],'USB').sequence,1);
});
