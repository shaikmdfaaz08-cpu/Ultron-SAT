'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const src=readFileSync(join(__dirname,'..','firmware','MainLogger','MainLogger.ino'),'utf8');
const interval=k=>{
  const m=src.match(new RegExp('constexpr\\s+uint32_t\\s+'+k+'\\s*=\\s*(\\d+)'));
  assert.ok(m, k+' should have a defined interval');
  return Number(m[1]);
};
test('USB receives real physical sensor samples every one second',()=>{
  assert.equal(interval('SAMPLE_INTERVAL_MS'),1000);
  assert.match(src,/Reading r = readSensors\(\);/);
  assert.match(src,/Serial\.println\(makeUSBPacket\(packet, lastLogOK, txState\)\);/);
});
test('SD, camera and radio do not run every sensor sample',()=>{
  assert.equal(interval('LOG_INTERVAL_MS'),60000);
  assert.equal(interval('CAMERA_INTERVAL_MS'),60000);
  assert.equal(interval('LORA_INTERVAL_MS'),60000);
  assert.match(src,/if \(uint32_t\(now - previousLog\) >= LOG_INTERVAL_MS\)/);
  assert.match(src,/radioOK && uint32_t\(now - previousRadio\) >= LORA_INTERVAL_MS/);
  assert.match(src,/ENABLE_CAMERA && sdOK && uint32_t\(now - previousCamera\) >= CAMERA_INTERVAL_MS/);
});
test('radio keeps the verified-hardware opt-in gate',()=>{
  assert.match(src,/constexpr long LORA_FREQUENCY_HZ = 0;/);
  assert.match(src,/if \(LORA_FREQUENCY_HZ > 0\)/);
});
test('failed I2C bus scan cannot masquerade as healthy sensor data',()=>{
  assert.match(src,/i2cBusTrusted = \(i2cExpectedMask != 0/);
  assert.match(src,/if \(i2cBusTrusted && \(i2cExpectedMask & 1\)/);
});
