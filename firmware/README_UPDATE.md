# ULTRON-SAT firmware integration (8 Nov 2026)

The Arduino firmware programs are separate and are NOT automatically flashed when GitHub is updated.

- MainLogger/MainLogger.ino: main ESP32 DevKit; keeps TelemetryUtils.h beside the sketch.
- LoRaReceiver/LoRaReceiver.ino: separate ground-station ESP32 + supported Ra-02.
- CameraNode/CameraNode.ino: separate AI Thinker ESP32-CAM.

Do not combine or upload these sketches to the same board.
The received sensor fields are real only when a valid INA219/TMP102/MPU6050 reading is available. Missing hardware sensors must remain null.
MainLogger uses GPIO21 SDA / GPIO22 SCL with expected I2C addresses 0x40, 0x48, 0x68; SPI GPIO18/19/23 with independent chip selects.
The requested hardware safety checks must be complete before testing or reflashing the suspected shorted prototype.
The radio remains disabled until the hardware, antenna and locally authorized frequency have been independently verified. The camera remains disabled until the companion firmware and SD storage are verified.
