# ULTRON-SAT: separate hardware readings and orbit simulation

The public Render URL opens GitHub Pages; no Python backend is required for the telemetry dashboard.

## Expected legacy USB packet

Previously accepted compact JSON: b (boot), n (sample), ms (uptime), ok (validity mask 1=temperature, 2=INA219 monitored rail, 4=MPU6050), t, v, i, p, ax, ay, az, gx, gy, gz, l. The monitored INA219 5 V rail is NOT a direct solar-panel or battery charge measurement.

## Optional measured fields (actual hardware only)

- solar.voltage_v, solar.current_ma, solar.power_mw (separate panel electrical measurements). Flat aliases sv, si, sp also accepted.
- battery.voltage_v, battery.current_ma, battery.soc_percent, battery.charging. Flat aliases bv, bi, bpct also accepted. SOC is displayed only if firmware actually reports it.
- eps.ready, eps.active, eps.charging (reported power-manager state).
- lora.connected, lora.active, lora.rssi_dbm, lora.snr_db, lora.rx_packets, lora.tx_packets (reported radio state and reception).
- camera.ready, camera.frames (reported ESP32 camera state).
- sd.mounted, sd.free_mb, sd.writes (reported storage state).
- environment.temperature_C, environment.humidity_percent; sht31.temperature_c, sht31.humidity_percent.
- light.light1 for measured LDR ADC.

These may be added to the existing b/n/ms/ok JSON line as nested objects, or a rich packet may provide a type of telemetry plus component objects. No absent values are synthesized. A missing field is labeled NOT REPORTED. A disconnected USB serial port or imported SD file never counts as live hardware.

## Rotating orbit schedule (demonstration only)

Per supplied reference: Sun pointing 40 minutes; Nadir/Payload 3 minutes; Ground Station 7 minutes; Safe/Eclipse 40 minutes. Every component has its planned activity plus a separate actual sensor line. The simulation uses the 3D phase angle, independent of electrical telemetry. The actual solar panels can report power during any simulated mode if the firmware transmits it.

### Flashlight verification

A real change in LDR ADC confirms a change in the light sensor signal, NOT panel-generated electrical power. To display physical solar generation, existing firmware needs separately measured panel voltage/current/power values. This repository update modifies only the dashboard and packet parser, not ESP32 firmware or electrical wiring. No hardware commands are issued.

### Testing

Open https://ultron-sat.onrender.com in desktop Chrome/Edge, go to ESP32 telemetry and choose Connect USB (115200), select the appropriate port, then inspect the last hardware packet in the component monitor. Readings update when the board sends data. If optional fields never appear in the packet, the dashboard cannot display them yet.