/* UltronSat: ESP32 DevKit, INA219, MPU6050, TMP102, LDR, SD, Ra-02.
 * See README.txt before powering or transmitting. Arduino ESP32 core 3.x.
 * Required external library: LoRa by Sandeep Mistry.
 */
#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <LoRa.h>
#include <math.h>
#include "TelemetryUtils.h"

// EDIT BEFORE USE. Zero disables transmission; select a locally permitted
// frequency supported by your Ra-02 and antenna, and match the receiver.
constexpr long LORA_FREQUENCY_HZ = 0;
constexpr bool ENABLE_CAMERA = true; // probes UART companion; no photo without working SD
constexpr uint32_t SAMPLE_INTERVAL_MS = 60000; // sample and record once per minute
constexpr uint64_t LOG_BUDGET_BYTES = 64ULL * 1024 * 1024;
constexpr uint64_t FREE_RESERVE_BYTES = 4ULL * 1024 * 1024;
constexpr uint32_t LOG_CHUNK_BYTES = 64 * 1024;
constexpr uint32_t MAX_JPEG_BYTES = 200000;
constexpr float INA_SHUNT_OHMS = 0.1f; // R100 marking = 0.1 ohm
constexpr uint8_t INA_ADDR = 0x40, MPU_ADDR = 0x68, TMP_ADDR = 0x48;

constexpr int SD_CS = 25, LORA_CS = 5, LORA_RST = 14, LORA_DIO0 = 26;
constexpr int LDR_PIN = 34, CAM_RX = 16, CAM_TX = 17;
constexpr uint32_t CAM_BAUD = 230400;
constexpr char ROOT[] = "/ultron";
HardwareSerial camera(2);
bool sdOK = false, radioOK = false;
// I2C scanner must find real sensor addresses before measurements are trusted.
uint8_t i2cAddressCount = 0, i2cExpectedMask = 0;
bool i2cBusTrusted = false;
uint32_t txCount = 0, txErrors = 0, photosSaved = 0;
bool captureAttempted = false, lastCaptureOK = false, cameraOnline = false;
uint32_t nextFileId = 1, bootId = 0, sampleNo = 0, previousSample = 0;
uint64_t ownedBytes = 0;
String activeLog;

struct Reading {
  float t = NAN, v = NAN, ma = NAN, mw = NAN;
  float ax = NAN, ay = NAN, az = NAN, gx = NAN, gy = NAN, gz = NAN;
  uint16_t ldr = 0;
  uint8_t ok = 0; // bit 0 TMP102, bit 1 INA219, bit 2 MPU6050
};
// Explicit declarations avoid Arduino auto-prototype issues with custom types.
Reading readSensors();
String makePacket(const Reading &r, uint32_t uptime);

bool readRegs(uint8_t addr, uint8_t reg, uint8_t *out, uint8_t len) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(addr, len) != len) {
    while (Wire.available()) Wire.read();
    return false;
  }
  for (uint8_t i = 0; i < len; ++i) out[i] = Wire.read();
  return true;
}
bool writeReg8(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr); Wire.write(reg); Wire.write(val);
  return Wire.endTransmission() == 0;
}
bool writeReg16(uint8_t addr, uint8_t reg, uint16_t val) {
  Wire.beginTransmission(addr); Wire.write(reg);
  Wire.write(uint8_t(val >> 8)); Wire.write(uint8_t(val));
  return Wire.endTransmission() == 0;
}
bool readReg16(uint8_t addr, uint8_t reg, uint16_t &val) {
  uint8_t b[2];
  if (!readRegs(addr, reg, b, 2)) return false;
  val = (uint16_t(b[0]) << 8) | b[1]; return true;
}
bool initMPU() {
  uint8_t who = 0;
  if (!readRegs(MPU_ADDR, 0x75, &who, 1) || who != 0x68) return false;
  if (!writeReg8(MPU_ADDR, 0x6B, 0x01)) return false;
  delay(100);
  return writeReg8(MPU_ADDR, 0x1A, 0x03) &&
         writeReg8(MPU_ADDR, 0x1B, 0x00) && // +/-250 deg/s
         writeReg8(MPU_ADDR, 0x1C, 0x00);   // +/-2 g
}
bool mpuReady = false, inaReady = false;
Reading readSensors() {
  Reading r;
  uint16_t raw, config;
  if (i2cBusTrusted && (i2cExpectedMask & 1) &&
      readReg16(TMP_ADDR, 0x01, config) &&
      readReg16(TMP_ADDR, 0x00, raw)) {
    r.t = decodeTMP102(raw, (config & 0x0010) != 0); r.ok |= 1;
  }
  if (i2cBusTrusted && (i2cExpectedMask & 2) && !inaReady)
    inaReady = writeReg16(INA_ADDR, 0x00, 0x399F);
  uint16_t shunt, bus;
  if (inaReady && readReg16(INA_ADDR, 0x01, shunt) &&
      readReg16(INA_ADDR, 0x02, bus)) {
    float shuntV = int16_t(shunt) * 0.00001f;
    r.v = (bus >> 3) * 0.004f; // voltage at VIN-, relative to GND
    r.ma = shuntV / INA_SHUNT_OHMS * 1000.0f;
    r.mw = r.v * r.ma; r.ok |= 2;
  } else { inaReady = false; }
  if (i2cBusTrusted && (i2cExpectedMask & 4) && !mpuReady) mpuReady = initMPU();
  uint8_t b[14];
  if (mpuReady && readRegs(MPU_ADDR, 0x3B, b, sizeof(b))) {
    auto word = [&](int i) { return int16_t((uint16_t(b[i]) << 8) | b[i+1]); };
    r.ax = word(0) / 16384.0f; r.ay = word(2) / 16384.0f;
    r.az = word(4) / 16384.0f;
    r.gx = word(8) / 131.0f; r.gy = word(10) / 131.0f;
    r.gz = word(12) / 131.0f; r.ok |= 4;
  } else { mpuReady = false; }
  r.ldr = analogRead(LDR_PIN); // raw ADC value, NOT calibrated lux
  return r;
}

String number(float v) { return isfinite(v) ? String(v, 2) : String("null"); }
String makePacket(const Reading &r, uint32_t uptime) {
  String s; s.reserve(255);
  s = "{\"b\":" + String(bootId) + ",\"n\":" + String(sampleNo);
  s += ",\"ms\":" + String(uptime) + ",\"ok\":" + String(r.ok);
  s += ",\"t\":" + number(r.t) + ",\"v\":" + number(r.v);
  s += ",\"i\":" + number(r.ma) + ",\"p\":" + number(r.mw);
  s += ",\"ax\":" + number(r.ax) + ",\"ay\":" + number(r.ay);
  s += ",\"az\":" + number(r.az) + ",\"gx\":" + number(r.gx);
  s += ",\"gy\":" + number(r.gy) + ",\"gz\":" + number(r.gz);
  s += ",\"l\":" + String(r.ldr) + "}";
  return s;
}

// USB has no SX127x 255-byte limit. Keep the radio/storage sensor packet compact,
// and attach honest subsystem status to the USB copy only.
String makeUSBPacket(const String &sensorPacket, bool logSaved, const char *txState) {
  String s = sensorPacket.substring(0, sensorPacket.length()-1);
  s += ",\"sd\":{\"mounted\":" + String(sdOK ? "true" : "false");
  s += ",\"state\":\"" + String(!sdOK ? "UNAVAILABLE" : logSaved ? "RECORDING" : "WRITE_ERROR") + "\"";
  s += ",\"last_write_ok\":" + String(sdOK ? (logSaved ? "true" : "false") : "null") + "}";
  s += ",\"lora\":{\"state\":\"" + String(txState) + "\",\"tx_count\":" + String(txCount);
  s += ",\"errors\":" + String(txErrors) + "}";
  s += ",\"i2c\":{\"state\":\"" + String(i2cBusTrusted ? "SCANNED" : i2cAddressCount ? "SUSPECT" : "NO_DEVICES") + "\"";
  s += ",\"responding\":" + String(i2cAddressCount) + ",\"found_mask\":" + String(i2cExpectedMask) + "}";
  s += ",\"camera\":{\"state\":\"" + String(!ENABLE_CAMERA ? "DISABLED" : !cameraOnline ? "UART_NOT_DETECTED" : !sdOK ? "WAITING_FOR_SD" : !captureAttempted ? "READY" : lastCaptureOK ? "LAST_CAPTURE_SAVED" : "CAPTURE_FAILED") + "\"";
  s += ",\"frames\":" + String(photosSaved) + ",\"last_capture_ok\":";
  s += String(captureAttempted ? (lastCaptureOK ? "true" : "false") : "null") + "}}";
  return s;
}

String baseName(const char *name) {
  const char *p = strrchr(name, '/'); return String(p ? p + 1 : name);
}
String allocateName(const char *ext) {
  if (nextFileId == UINT32_MAX) return String();
  char buf[48];
  snprintf(buf, sizeof(buf), "%s/q%010lu.%s", ROOT,
           (unsigned long)nextFileId++, ext);
  return String(buf);
}
bool inventory() {
  ownedBytes = 0;
  File dir = SD.open(ROOT);
  if (!dir || !dir.isDirectory()) return false;
  File f = dir.openNextFile();
  while (f) {
    uint32_t id; String b = baseName(f.name());
    if (!f.isDirectory() && parseOwnedName(b.c_str(), id)) {
      ownedBytes += f.size();
      if (id == UINT32_MAX) { f.close(); dir.close(); return false; }
      if (id >= nextFileId) nextFileId = id + 1;
    }
    f.close(); f = dir.openNextFile();
  }
  dir.close(); return true;
}
bool deleteOldest() {
  File dir = SD.open(ROOT);
  if (!dir) return false;
  uint32_t smallest = UINT32_MAX; String victim; uint64_t size = 0;
  File f = dir.openNextFile();
  while (f) {
    uint32_t id; String b = baseName(f.name());
    if (!f.isDirectory() && parseOwnedName(b.c_str(), id) && id < smallest) {
      smallest = id; victim = String(ROOT) + "/" + b; size = f.size();
    }
    f.close(); f = dir.openNextFile();
  }
  dir.close();
  if (!victim.length() || !SD.remove(victim.c_str())) return false;
  ownedBytes = size > ownedBytes ? 0 : ownedBytes - size;
  if (victim == activeLog) activeLog = "";
  Serial.println("Deleted oldest project file: " + victim);
  return true;
}
bool ensureSpace(uint64_t incoming) {
  if (!sdOK || incoming > LOG_BUDGET_BYTES) return false;
  while (true) {
    uint64_t total = SD.totalBytes(), used = SD.usedBytes();
    uint64_t free = total > used ? total - used : 0;
    if (storageFits(ownedBytes, incoming, LOG_BUDGET_BYTES,
                    free, FREE_RESERVE_BYTES)) return true;
    if (!deleteOldest()) {
      Serial.println("SD: cannot reclaim enough project storage."); return false;
    }
  }
}
bool appendRecord(const String &s) {
  if (!ensureSpace(s.length() + 1 + 4096)) return false;
  if (activeLog.length()) {
    File check = SD.open(activeLog.c_str(), FILE_READ);
    bool rotate = !check || check.size() + s.length() + 1 > LOG_CHUNK_BYTES;
    check.close(); if (rotate) activeLog = "";
  }
  if (!activeLog.length()) activeLog = allocateName("log");
  if (!activeLog.length()) return false;
  File f = SD.open(activeLog.c_str(), FILE_APPEND);
  if (!f) return false;
  size_t wrote = f.write((const uint8_t*)s.c_str(), s.length());
  size_t newline = wrote == s.length() ? f.write(uint8_t('\n')) : 0;
  f.flush(); f.close(); ownedBytes += wrote + newline;
  if (wrote != s.length() || newline != 1) {
    activeLog = ""; return false; // isolate a partial line in this old file
  }
  return true;
}

bool cameraLine(String &line, uint32_t waitMs) {
  line = ""; uint32_t start = millis();
  while (uint32_t(millis() - start) < waitMs) {
    while (camera.available()) {
      char c = camera.read();
      if (c == '\n') return true;
      if (c != '\r' && line.length() < 100) line += c;
    }
    delay(1);
  }
  return false;
}
bool probeCamera() {
  if (!ENABLE_CAMERA) return false;
  while (camera.available()) camera.read();
  camera.print("PING\n");
  String line;
  return cameraLine(line, 750) && line == "PONG";
}
bool savePhoto() {
  // Separate READY/GO handshake lets SD pruning finish before JPEG bytes arrive.
  while (camera.available()) camera.read();
  camera.print("PHOTO\n");
  String line;
  if (!cameraLine(line, 8000)) { Serial.println("CAM: header timeout"); return false; }
  unsigned long length = 0, expectedCRC = 0;
  if (sscanf(line.c_str(), "READY %lu %lx", &length, &expectedCRC) != 2 ||
      length < 4 || length > MAX_JPEG_BYTES) {
    camera.print("CANCEL\n"); Serial.println("CAM: " + line); return false;
  }
  if (!ensureSpace(length + 4096)) { camera.print("CANCEL\n"); return false; }
  String temp = allocateName("part");
  if (!temp.length()) { camera.print("CANCEL\n"); return false; }
  File f = SD.open(temp.c_str(), FILE_WRITE);
  if (!f) { camera.print("CANCEL\n"); return false; }
  camera.print("GO\n");
  uint32_t received = 0, crc = 0xFFFFFFFF, start = millis(), lastByte = start;
  uint8_t buffer[512]; bool writeOK = true;
  while (received < length && uint32_t(millis()-start) < 20000 &&
         uint32_t(millis()-lastByte) < 2000) {
    size_t n = 0;
    while (camera.available() && n < sizeof(buffer) && received + n < length)
      buffer[n++] = uint8_t(camera.read());
    if (!n) { delay(1); continue; }
    lastByte = millis();
    for (size_t i=0; i<n; ++i) crc = crc32Update(crc, buffer[i]);
    if (f.write(buffer, n) != n) { writeOK = false; break; }
    received += n;
  }
  f.flush(); uint64_t actual = f.size(); f.close(); ownedBytes += actual;
  bool valid = writeOK && received == length && ((crc ^ 0xFFFFFFFF) == expectedCRC);
  String finalName = temp.substring(0, temp.length()-4) + "jpg";
  if (valid && SD.rename(temp.c_str(), finalName.c_str())) {
    Serial.printf("Photo saved: %s, %lu bytes; b=%lu n=%lu\n", finalName.c_str(),
                  length, (unsigned long)bootId, (unsigned long)sampleNo);
    // A small side record associates the JPEG with its sensor sample.
    appendRecord("{\"b\":" + String(bootId) + ",\"n\":" + String(sampleNo) +
                 ",\"photo\":\"" + finalName + "\"}");
    return true;
  }
  if (SD.remove(temp.c_str())) ownedBytes -= actual;
  Serial.println("CAM: incomplete image, CRC mismatch, write or rename failure");
  return false;
}

void scanI2C() {
  Serial.println("I2C scan: expected 0x40 INA219, 0x48 TMP102, 0x68 MPU6050");
  i2cAddressCount = 0;
  i2cExpectedMask = 0;
  uint8_t unexpected = 0;
  for (uint8_t a=1; a<127; ++a) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() != 0) continue;
    ++i2cAddressCount;
    Serial.printf("  found 0x%02X\n", a);
    if (a == TMP_ADDR) i2cExpectedMask |= 1;
    else if (a == INA_ADDR) i2cExpectedMask |= 2;
    else if (a == MPU_ADDR) i2cExpectedMask |= 4;
    else ++unexpected;
  }
  // A flood of phantom ACKs or zero responding devices is an unreliable bus.
  // Never claim valid readings from a scan that already failed.
  i2cBusTrusted = (i2cExpectedMask != 0 && unexpected <= 2 &&
                   i2cAddressCount <= 5);
  Serial.printf("I2C scan complete: %u responding, mask %u, trusted %s\n",
      unsigned(i2cAddressCount), unsigned(i2cExpectedMask),
      i2cBusTrusted ? "YES" : "NO");
  if (!i2cBusTrusted)
    Serial.println("I2C SUSPECT: power down and inspect SDA/SCL, ground, power and insulation; no readings will be trusted.");
}
void setup() {
  Serial.begin(115200); delay(500);
  Serial.println("UltronSat starting");
  Wire.begin(21, 22); Wire.setClock(100000); Wire.setTimeOut(50);
  scanI2C();
  inaReady = i2cBusTrusted && (i2cExpectedMask & 2) && writeReg16(INA_ADDR, 0x00, 0x399F);
  mpuReady = i2cBusTrusted && (i2cExpectedMask & 4) && initMPU();
  analogReadResolution(12); pinMode(LDR_PIN, INPUT);
  analogSetPinAttenuation(LDR_PIN, ADC_11db);
  pinMode(SD_CS, OUTPUT); digitalWrite(SD_CS, HIGH);
  pinMode(LORA_CS, OUTPUT); digitalWrite(LORA_CS, HIGH);
  SPI.begin(18, 19, 23);
  sdOK = SD.begin(SD_CS, SPI, 4000000);
  if (sdOK && !SD.exists(ROOT)) sdOK = SD.mkdir(ROOT);
  if (sdOK) sdOK = inventory();
  bootId = nextFileId; // persistent identifier when a writable SD is present
  if (sdOK) sdOK = appendRecord("{\"event\":\"boot\",\"b\":" + String(bootId) + "}");
  Serial.printf("SD %s\n", sdOK ? "OK" : "FAILED (radio/sensors continue)");
  LoRa.setSPI(SPI); LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);
  if (LORA_FREQUENCY_HZ > 0) {
    radioOK = LoRa.begin(LORA_FREQUENCY_HZ);
    if (radioOK) {
      LoRa.setSpreadingFactor(7); LoRa.setSignalBandwidth(125000);
      LoRa.setCodingRate4(5); LoRa.setSyncWord(0x12);
      LoRa.enableCrc(); LoRa.setTxPower(10);
    }
  }
  Serial.printf("LoRa %s\n", LORA_FREQUENCY_HZ <= 0 ? "DISABLED: frequency is zero" : radioOK ? "INITIALIZED (delivery unverified)" : "INIT FAILED: check wiring and radio settings");
  if (ENABLE_CAMERA) {
    camera.setRxBufferSize(16384);
    camera.begin(CAM_BAUD, SERIAL_8N1, CAM_RX, CAM_TX);
  }
  previousSample = millis() - SAMPLE_INTERVAL_MS; // first sample immediately
}
void loop() {
  uint32_t now = millis();
  if (uint32_t(now - previousSample) < SAMPLE_INTERVAL_MS) { delay(2); return; }
  previousSample = now;
  ++sampleNo;
  Reading r = readSensors();
  String packet = makePacket(r, now);
  bool logSaved = sdOK && appendRecord(packet);
  if (sdOK && !logSaved) Serial.println("SD: record NOT saved");
  const char *txState = LORA_FREQUENCY_HZ <= 0 ? "DISABLED" : radioOK ? "READY" : "INIT_FAILED";
  if (radioOK) {
    if (packet.length() > 255) { txState = "PACKET_TOO_LARGE"; ++txErrors; }
    else if (!LoRa.beginPacket()) { txState = "BUSY"; ++txErrors; }
    else {
      size_t written = LoRa.write((const uint8_t*)packet.c_str(), packet.length());
      // Finalize even after a short write so the library leaves packet-building state.
      int result = LoRa.endPacket();
      if (written == packet.length() && result == 1) { txState = "TX_COMPLETE_NO_ACK"; ++txCount; }
      else { txState = "TX_FAILED"; ++txErrors; }
    }
  }
  if (ENABLE_CAMERA) {
    cameraOnline = probeCamera();
    if (!cameraOnline) Serial.println("CAM: UART companion not detected; photo skipped");
    else if (!sdOK) Serial.println("CAM: UART companion detected, but SD unavailable; no photo saved");
    else {
      captureAttempted = true;
      lastCaptureOK = savePhoto();
      if (lastCaptureOK) ++photosSaved;
    }
  }
  Serial.println(makeUSBPacket(packet, logSaved, txState));
}
