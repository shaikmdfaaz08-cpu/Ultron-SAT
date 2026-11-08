# ULTRON-SAT Arduino firmware and live telemetry

This repository includes the main ESP32 logger, an optional ground-station LoRa
receiver, and an optional AI Thinker ESP32-CAM companion, from the user's
8 November 2026 firmware package.

| Arduino program | Device |
| --- | --- |
| firmware/MainLogger/MainLogger.ino | Main ESP32 DevKit controlling the sensors, SD log and optional radio/camera |
| firmware/MainLogger/TelemetryUtils.h | Helper functions required by MainLogger |
| firmware/LoRaReceiver/LoRaReceiver.ino | **Second** ground-station ESP32, not the main CubeSat |
| firmware/CameraNode/CameraNode.ino | **Separate** AI Thinker ESP32-CAM |

Keep the helper beside MainLogger. The three .ino programs must not be combined
or flashed onto one board. Firmware in GitHub is not installed automatically
when the website deploys.

## Current hardware status and safety

The main ESP32 has booted and output genuine compact JSON packets, including:
{"b":1,"n":2,"ok":0,"t":null,"v":null,"i":null,"p":null,"l":0}
Its I2C scan showed no responding device addresses. Hardware power,
SDA/SCL, shared ground, and possible contact with a metal mounting plate need
inspection by an experienced instructor or hardware teammate with all power
sources isolated before anyone powers or rewires the prototype again. A website
update cannot turn the null values into valid sensor measurements.

MainLogger expects INA219 0x40, TMP102 0x48 and MPU6050 0x68 on I2C
GPIO21 SDA/GPIO22 SCL. It uses GPIO34 for the LDR.
The SD and radio share SPI GPIO18 SCK, GPIO19 MISO and GPIO23 MOSI with
independent chip-select signals. Do not guess power connections from names.

The factory-safe source leaves LORA_FREQUENCY_HZ = 0 and
ENABLE_CAMERA = false until the specific hardware and integration are verified.
Do not configure transmission until the module variant, matching receiver,
suitable antenna and permitted radio parameters have been confirmed.
The main program saves camera images only when SD storage works.

## Hardware readings and dashboard

The published website has a shared USB protocol adapter
(web/ultron_telemetry_protocol.js and web/ultron_shared_usb_bridge.js).
The original 3D mission control is retained. Both browser USB entry points
use the original Mission Control USB reader, not simultaneous competing ports.
Desktop Chrome/Edge and an HTTPS page are required for Web Serial. Close the
Arduino Serial Monitor before selecting the main ESP32 USB port at 115200.

Compact packets use b=boot, n=sample, ms=uptime, ok=validity mask,
t=TMP102 temperature, v=INA219 bus voltage, i=current mA, p=power mW,
ax/ay/az=MPU acceleration g, gx/gy/gz=gyroscope and l=LDR ADC.
The mask uses bit 1 for temperature, bit 2 for INA219 and bit 4 for MPU6050.
Unknown readings remain null; an LDR value of zero is not proof of good
sensor wiring. Imported SD logs are marked historical, never live.

## Verification boundaries

The source ZIP's Node and C++ host tests passed locally, but those are software
tests, not tests of actual battery safety, sensors, antenna, radio delivery or
camera wiring. Repository updates do not flash connected ESP32 devices.
