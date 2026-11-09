/* ULTRON-SAT isolated I2C diagnostics.
 * Use ONLY after an instructor/experienced teammate verifies that the
 * prototype is safely powered and there are no shorts to its mounting plate.
 * Main ESP32 DevKit ONLY. No SD, LoRa, camera or battery control.
 * This temporary sketch replaces MainLogger until MainLogger is re-flashed.
 */
#include <Arduino.h>
#include <Wire.h>
constexpr uint8_t SDA_PIN = 21, SCL_PIN = 22;
constexpr uint8_t INA_ADDR = 0x40, TMP_ADDR = 0x48, MPU_ADDR = 0x68;
void setup() {
  Serial.begin(115200);
  delay(700);
  Serial.println("ULTRON-SAT isolated I2C diagnostic (main ESP32 only)");
  Serial.println("Expected: INA219=0x40, TMP102=0x48, MPU6050=0x68");
  if (!Wire.begin(SDA_PIN, SCL_PIN)) {
    Serial.println("ERROR: I2C peripheral did not initialize.");
    return;
  }
  Wire.setClock(100000);
  Wire.setTimeOut(50);
}
void loop() {
  bool ina = false, tmp = false, mpu = false;
  unsigned count = 0;
  Serial.println("Scanning standard 7-bit addresses 0x08 to 0x77...");
  for (uint8_t addr = 0x08; addr <= 0x77; ++addr) {
    Wire.beginTransmission(addr);
    uint8_t result = Wire.endTransmission();
    if (result != 0) continue;
    ++count;
    Serial.printf("ACK: 0x%02X\n", addr);
    if (addr == INA_ADDR) ina = true;
    if (addr == TMP_ADDR) tmp = true;
    if (addr == MPU_ADDR) mpu = true;
  }
  Serial.printf("ACK count=%u | INA219=%s | TMP102=%s | MPU6050=%s\n",
      count, ina ? "present?" : "not detected", tmp ? "present?" : "not detected",
      mpu ? "present?" : "not detected");
  if (count > 8)
    Serial.println("ABNORMAL: many ACKs. Stop testing; power down and request a wiring inspection.");
  else if (count == 0)
    Serial.println("No devices ACKed. Check physical setup with power disconnected.");
  else
    Serial.println("An address ACK is NOT proof of a valid sensor reading.");
  delay(5000);
}
