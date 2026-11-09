/* Optional AI Thinker ESP32-CAM companion. Upload to CAMERA, not main ESP32.
 * This firmware replaces CameraWebServer and uses UART0 U0R/U0T.
 * No Wi-Fi or external libraries. Tested by static checks only; verify hardware.
 */
#include <Arduino.h>
#include "esp_camera.h"
constexpr uint32_t BAUD = 230400;
constexpr uint32_t MAX_JPEG = 200000;
bool ready = false;
String command;

uint32_t imageCRC(const uint8_t *data, size_t n) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i=0; i<n; ++i) {
    crc ^= data[i];
    for (int j=0; j<8; ++j) crc = (crc >> 1) ^ ((crc & 1) ? 0xEDB88320UL : 0);
  }
  return crc ^ 0xFFFFFFFF;
}
void sendPhoto() {
  if (!ready) { Serial.println("ERR camera_init"); return; }
  // Discard one buffered frame so the following capture is recent.
  camera_fb_t *old = esp_camera_fb_get();
  if (old) esp_camera_fb_return(old);
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) { Serial.println("ERR capture"); return; }
  if (fb->format != PIXFORMAT_JPEG || fb->len > MAX_JPEG) {
    esp_camera_fb_return(fb); Serial.println("ERR image_size_or_format"); return;
  }
  uint32_t crc = imageCRC(fb->buf, fb->len);
  Serial.printf("READY %lu %08lx\n", (unsigned long)fb->len, (unsigned long)crc);
  String answer; bool complete = false; uint32_t start = millis();
  while (uint32_t(millis()-start) < 15000 && !complete) {
    while (Serial.available()) {
      char c = Serial.read();
      if (c == '\n') { complete = true; break; }
      if (c != '\r' && answer.length() < 32) answer += c;
    }
    delay(1);
  }
  if (complete && answer == "GO") {
    Serial.write(fb->buf, fb->len); Serial.flush();
  }
  esp_camera_fb_return(fb);
}
void setup() {
  Serial.begin(BAUD); Serial.setDebugOutput(false);
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0; c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = 5; c.pin_d1 = 18; c.pin_d2 = 19; c.pin_d3 = 21;
  c.pin_d4 = 36; c.pin_d5 = 39; c.pin_d6 = 34; c.pin_d7 = 35;
  c.pin_xclk = 0; c.pin_pclk = 22; c.pin_vsync = 25; c.pin_href = 23;
  c.pin_sccb_sda = 26; c.pin_sccb_scl = 27;
  c.pin_pwdn = 32; c.pin_reset = -1;
  c.xclk_freq_hz = 20000000; c.pixel_format = PIXFORMAT_JPEG;
  bool ram = psramFound();
  c.frame_size = ram ? FRAMESIZE_VGA : FRAMESIZE_QVGA;
  c.jpeg_quality = 15; c.fb_count = 1;
  c.fb_location = ram ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  c.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  esp_err_t err = esp_camera_init(&c);
  ready = err == ESP_OK;
  if (!ready) Serial.printf("ERR init_%lx\n", (unsigned long)err);
  // Deliberately no success banner: the main board requests each image.
}
void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') {
      if (command == "PING") Serial.println("PONG");
      else if (command == "PHOTO") sendPhoto();
      command = "";
    } else if (ch != '\r') {
      if (command.length() < 32) command += ch;
      else command = "";
    }
  }
  delay(1);
}
