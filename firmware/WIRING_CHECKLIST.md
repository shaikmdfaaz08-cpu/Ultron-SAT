# ULTRON-SAT: power-off wiring review and staged camera activation

**This is a review checklist, NOT a verified schematic or an authorization to energize the satellite.**

The previously observed I2C scan included dozens of unexpected ACK addresses, and the
prototype has reportedly had exposed connections near a conductive mounting plate.
Unplug USB, isolate solar and battery sources, and have the assembly inspected by
an instructor/experienced electronics teammate before any power-on or rewiring.
Do not move wires, measure resistance, solder, or flash the board while power is present.

## Identify the THREE separate boards / roles

1. **Main ESP32 DevKit** — runs `MainLogger/MainLogger.ino`: reads I2C sensors
   and LDR, writes to an external SD module; optional LoRa and UART camera exchange.
2. **AI Thinker ESP32-CAM** — runs `CameraNode/CameraNode.ino` on its own board.
   Has a camera and UART0; does not run the main logger.
3. **Optional ground receiver ESP32** — runs `LoRaReceiver/LoRaReceiver.ino`;
   separate from the first two, only if verified and legally authorized.

## Physical inspection first (ALL power disconnected)

- Identify the exact part number, marking and board/pin label for each module.
- Confirm there are no exposed pins, solder joints or conductive wires against
  the metallic mounting plate, or damaged insulation/loose wire strands.
- Have the qualified reviewer trace signal and ground continuity, verify module
  power requirements and rail voltages, and check for shorts before energizing.
- Do not guess the power supply from VCC/5V/VIN labels; a sensor's power input
  is not necessarily the same as the INA219 measurement VIN+/VIN- terminals.
- Do not connect a battery, solar cell or external measurement rail just to test I2C.
- If there is heat, odor, smoke, damaged battery insulation or unknown wiring,
  stop and refer it for supervised hardware repair.

## Expected LOGICAL connections (signal reference, not physical pin-position chart)

| Main ESP32 GPIO | Function | Module connection |
|---|---|---|
| 21 | I2C SDA | INA219 SDA; TMP102 SDA; MPU6050 SDA, shared parallel bus |
| 22 | I2C SCL | INA219 SCL; TMP102 SCL; MPU6050 SCL, shared parallel bus |
| 34 | Analog LDR input | LDR signal; NOT proof of solar electrical generation |
| 18 | SPI SCK | SD SCK and LoRa SCK shared |
| 19 | SPI MISO | SD MISO and LoRa MISO shared |
| 23 | SPI MOSI | SD MOSI and LoRa MOSI shared |
| 25 | SD CS | External main SD card module CS ONLY |
| 5 | LoRa CS | LoRa/NSS ONLY; note GPIO5 is an ESP32 strapping pin |
| 14 | LoRa reset | Radio RST |
| 26 | LoRa DIO0 | Radio interrupt |
| 16 | Camera serial RX | Expected to receive from ESP32-CAM UART0 TX (GPIO1) |
| 17 | Camera serial TX | Expected to transmit to ESP32-CAM UART0 RX (GPIO3) |

Signals are not a complete wiring diagram. A verified common signal ground is
required; power pins, levels, pull-ups, module addresses and the camera power
supply must be matched to the actual breakout revisions before connections.
Do not use the above as instructions to attach power to an unknown board.

**I2C**: devices share SDA and SCL in parallel, with suitable pull-ups to an
appropriate I/O voltage. A bad line can falsely ACK many addresses. Expected
default addresses are INA219 `0x40`, TMP102 `0x48`, MPU6050 `0x68`.
Certain breakouts support other selectable addresses; identify the module first.

**SPI**: SD and LoRa share clock/data in parallel, but each uses its OWN CS.
Do not connect modules in a daisy chain; confirm the labeled pins for each
module with an experienced reviewer.

**ESP32-CAM**: the camera's own ribbon and OV2640 are handled by the separate
CameraNode firmware, not the main ESP32 I2C bus. The listed UART signal pairs
are the expected firmware direction only. UART0 is also used to program the
ESP32-CAM, so its programming/test connections need a separate review.
Never assume the camera can be powered by the main DevKit's 3.3 V output.

**LoRa**: `LORA_FREQUENCY_HZ = 0` is deliberately retained. Do not enable
transmission until the radio variant, antenna, receiver and permitted operating
parameters have been independently verified.

## Staged test sequence after supervised electrical inspection

1. Have a supervisor make the main ESP32 safe for USB-only testing with the
   battery, solar, LoRa, SD and camera systems isolated as appropriate.
2. Start with one known-good I2C sensor at a time under supervision; use
   `I2CDiagnostics/I2CDiagnostics.ino` on the MAIN board at 115200.
3. Confirm ONLY plausible addresses appear; `0x40`, `0x48` and `0x68`
   are expected defaults. Do NOT continue if dozens of ACKs appear.
4. Reflash the main logger only after sensor communication has been confirmed.
   `ok` bits 1/2/4 correspond to validated temperature/power/IMU readings.
5. Verify the main SD module separately. The main logger needs SD writable
   before it can save JPEG files. The ESP32-CAM's own SD socket is not used by
   this CameraNode firmware.
6. Flash `CameraNode/CameraNode.ino` to the separate ESP32-CAM only after its
   exact pinout, supply and UART levels are checked.
7. In this **review branch**, `ENABLE_CAMERA=true` starts main UART2, while
   `CAMERA_CAPTURE_VERIFIED=false` prevents photo capture. A reviewer must
   confirm safe wiring, camera boot/handshake and SD before changing the
   capture interlock to true. This code is not automatically installed on hardware.
8. Leave the radio frequency at zero until independently verified.

## Dashboard

The dashboard cannot populate `t/v/i/p/ax/ay/az/gx/gy/gz` while I2C
readings are null. Use desktop Chrome/Edge on HTTPS and close Arduino Serial
Monitor before the single browser USB connection. A GitHub/Render deployment
cannot flash ESP32 firmware or repair wiring.
