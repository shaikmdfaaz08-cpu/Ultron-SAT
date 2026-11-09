# ULTRON-SAT: live dashboard, ground links, camera and rolling SD storage

## Current software implementation (2026-11-09)

The public dashboard is GitHub Pages. Render is only a lightweight redirect; it does not receive CubeSat telemetry or provide a live video backend. The original 3D/orbit visualization is a SIMULATION; only validated incoming ESP32 packets are physical measurements.

* **Method 1: USB serial:** Implemented. The main ESP32 outputs newline-delimited JSON at 115200 baud, targeting one physical sensor sample and USB message per second. On desktop Chrome or Edge using HTTPS, the existing dashboard "Connect USB" button uses the original Web Serial reader. Close Arduino Serial Monitor first. Choose the main logger USB COM port. The Live Links panel displays sample freshness and sensor validity. A camera is **not** streamed over this USB channel.
* **Method 2: LoRa -> ground LoRa receiver -> computer USB:** The packet code and separate ground receiver sketch exist. The computer connects to the RECEIVER USB COM port in the same dashboard interface. The receiver wraps incoming telemetry with RSSI/SNR and its original sensor payload. This method is suitable only for small telemetry packets, not video. The radio frequency in both sketches stays **zero/disabled** until the specific radio hardware, antenna, receiver and authorized parameters are verified by the team. Initialization or packet transmission does not prove successful reception.
* **Method 3: local Wi-Fi / Bluetooth backup:** NOT YET IMPLEMENTED for sensor telemetry between MainLogger and the dashboard. Do not mistake the camera-only Wi-Fi video sketch for a Wi-Fi telemetry bridge. A real backup needs a locally secured telemetry receiver/gateway with a compatible HTTPS/Web Bluetooth transport. Never imply that unavailable readings are live. Browser Web Bluetooth is not a universal cross-platform option.
* **Camera video:** The new dashboard Live Links panel supports an HTTPS MJPEG/JPEG camera gateway inline, or opens a private local HTTP camera URL in another tab. No video is stored or proxied by GitHub Pages. The optional firmware in CameraWifiStream provides an HTTP MJPEG stream on the camera's trusted private Wi-Fi. HTTPS pages cannot safely embed that local HTTP stream. Only expose the feed with authentication and HTTPS if you build a separate secure gateway.
* **Camera SD photos:** The separate CameraNode/CameraNode.ino uses UART to send JPEG stills to the MainLogger. The main firmware now enables a guarded photo attempt after each one-minute sample, first requiring the camera to answer PING and the SD card to be working. With SD FAILED there is NO image recording. The CameraWifiStream firmware and CameraNode UART firmware are alternatives on a single ESP32-CAM; do not overwrite one and assume both still operate.
* **SD storage:** MainLogger reads and emits USB JSON at SAMPLE_INTERVAL_MS=1000, and appends a sensor record approximately once every LOG_INTERVAL_MS=60000 if SD initializes. Files are in /ultron. Its pre-existing retention code rotates log files at 64 KiB and deletes the oldest **owned** qNNNNNNNNNN.log/.jpg/.part files as its 64 MiB project budget or safe free-space reserve requires. It does not erase unrelated files or guarantee retention of old photos. SD FAILED means NO recording, regardless of firmware timing.

## Rate and blocking caveat

The main board's USB sensor stream targets 1 Hz, independent of one-minute SD logging, camera photo capture and LoRa sending. JPEG UART capture and SD card operations are presently synchronous and may interrupt the 1 Hz stream during a capture. A 1 Hz target is not a hard real-time guarantee. The LoRa receiver transmits to the dashboard only when it receives a verified packet; its radio cadence is not the same as USB.

## Practical bring-up order

1. Get repeatable I2C reads: the expected 7-bit addresses are 0x40 (INA219), 0x48 (TMP102) and 0x68 (MPU6050). Missing addresses, or a scan flooded with many false addresses, require hardware inspection; the validity mask ok=6 alone is not enough to prove sensor correctness. Have a qualified electronics teammate or instructor inspect power, SDA/SCL, common ground, insulation and sensor module compatibility with all sources disconnected.
2. Fix the SD card initialization separately with hardware assistance. The ESP32 and LoRa/SD share SPI, but the SD and LoRa devices require independent chip select lines. Test card detect, supported filesystem, supply and wiring only after power is disconnected and reviewed. The app cannot make an SD FAILED device start recording.
3. For a USB demo, keep the original MainLogger attached to the PC over USB, use desktop Chrome/Edge, open https://shaikmdfaaz08-cpu.github.io/Ultron-SAT/ and select Connect USB. Each real sample should arrive approximately once per second when the board is free; occasional camera/SD operations can block longer. Check that the Live Links status reads LIVE, the age updates, and the ok mask matches actual sensors.
4. For a wireless telemetry demo, arrange a verified and authorized LoRa pair with suitable antennas and separate ground ESP32. Flash the correct separate firmware to each; the ground board must be USB-connected to the PC. A successful RF initialization alone is NOT confirmation of packet delivery.
5. For actual video, choose ONE ESP32-CAM mode: UART + SD stills or local Wi-Fi MJPEG. The Wi-Fi streaming sketch requires a private network credential header created on the local development machine. Camera video must be accessed on a trusted network; never publish a raw HTTP camera to the Internet.
6. The firmware in GitHub does not flash itself to the ESP32 boards. The website deployment cannot change power connections, flash firmware, detect camera hardware, make LoRa legal or revive an SD card.

## Camera Wi-Fi sketch notes

The separate firmware/CameraWifiStream/CameraWifiStream.ino needs a private 2.4 GHz Wi-Fi network and an uncommitted file named camera_wifi_secrets.h beside the sketch, defining CAMERA_WIFI_SSID and CAMERA_WIFI_PASSWORD. After local verification, the ESP32-CAM prints its local http://IP/stream address. Paste the camera URL into the Live Links viewer. From the GitHub Pages HTTPS dashboard an HTTP camera opens in a separate tab. For an inline feed, the URL must use an authenticated HTTPS gateway.

The camera sketch has NOT been compiled or tested on your physical ESP32-CAM. It should be checked against the actual module, installed ESP32 Arduino core and local network before use.

## Interpreting the sensor packet

Compact packet fields: b=boot ID, n=sample number, ms=uptime, ok=sensor validity bitmask, t=temperature C, v=bus voltage V, i=current mA, p=power mW, ax/ay/az=acceleration g, gx/gy/gz=gyro deg/s, l=raw light ADC. The validity bits are 1 for TMP102, 2 for INA219, and 4 for MPU6050. A null field must remain null, never replaced by a simulated reading. An LDR reading of 0 or 4095 may indicate a rail/extreme or disconnected sensor and is not calibrated lux.

The enhanced USB packet can also report SD, LoRa and UART camera status. It does not report actual solar charge, battery state of charge or camera live video unless measured by dedicated working instrumentation.
