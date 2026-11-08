/* Optional ground receiver: another ESP32 DevKit + Ra-02.
 * Same radio wiring as MainLogger; antenna required before operation.
 */
#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
constexpr long LORA_FREQUENCY_HZ = 0; // MUST match transmitter; 0 disables
void setup() {
  Serial.begin(115200); delay(500);
  SPI.begin(18, 19, 23);
  LoRa.setSPI(SPI); LoRa.setPins(5, 14, 26);
  if (LORA_FREQUENCY_HZ <= 0 || !LoRa.begin(LORA_FREQUENCY_HZ)) {
    Serial.println("Set a permitted frequency and check receiver wiring.");
    while (true) delay(1000);
  }
  LoRa.setSpreadingFactor(7); LoRa.setSignalBandwidth(125000);
  LoRa.setCodingRate4(5); LoRa.setSyncWord(0x12); LoRa.enableCrc();
  Serial.println("Receiver ready");
}
// Keep the radio metadata and sensor payload in ONE serial JSON line.
// A separate RSSI-only line would replace the dashboard's latest sensor sample.
String receiverEnvelope(const String &payload, int rssi, float snr) {
  return "{\"rssi\":" + String(rssi) + ",\"snr\":" + String(snr, 1) +
         ",\"payload\":" + payload + "}";
}
void loop() {
  int size = LoRa.parsePacket();
  if (size) {
    String payload; payload.reserve(255);
    while (LoRa.available()) {
      char c = char(LoRa.read());
      if (payload.length() < 255) payload += c;
    }
    if (size > 255 || payload.length() != size_t(size) ||
        payload.length() < 2 || payload.c_str()[0] != '{' ||
        payload.c_str()[payload.length()-1] != '}') {
      Serial.println("RX ignored: expected a complete MainLogger JSON packet");
    } else {
      Serial.println(receiverEnvelope(payload, LoRa.packetRssi(), LoRa.packetSnr()));
    }
  }
  delay(1);
}
