# ULTRON SAT — Mission Control and Oil-Slick Segmentation

## Live deployment: Render is only a redirect

- **Actual dashboard:** https://shaikmdfaaz08-cpu.github.io/Ultron-SAT/
- **Old public entrypoint (redirect):** https://ultron-sat.onrender.com/
- Render runs `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`.
  `backend/app.py` is now an extremely small ASGI app returning HTTP 302
  to GitHub Pages. It loads no model and serves no dashboard.
- Render's `requirements.txt` contains only Uvicorn; no PyTorch, OpenCV,
  FastAPI or other AI server dependencies are installed by the redirect build.
- The original Python AI backend is preserved in
  `backend/legacy_ai_app.py` for **local** use, with dependencies in
  `requirements-ai.txt` and an updated Windows launcher.
- All static dashboard assets, trained model files, and original 3D features
  remain in this GitHub repository. GitHub Pages builds independently.
- GitHub Pages cannot run Python model inference. Browser model inference
  depends on the separately published ONNX browser workflow.
- **Do not delete the Render service** if you need to keep the old
  `ultron-sat.onrender.com` hostname: its small redirect still needs hosting.
  This setup does not delete the account, service, or provider-side backups.
- Render cannot act as a relay for ESP32 USB or LoRa telemetry; USB data is
  read locally by a compatible browser using Web Serial.


This repository contains a local AI oil-slick segmentation backend, Windows startup scripts, an existing web dashboard, trained U-Net weights, and engineering materials.

## Current components

- `web/ULTRON_SAT_MISSION_CONTROL_V5_IOS_GLASS_DOCK.html`: current hosted dashboard (selected by Render `ULTRON_DASHBOARD`).
- `backend/rgb_payload.py`: experimental six-class image analysis for the ESP32 camera payload, separate from SAR inference.
- `backend/app.py`: lightweight Render redirect-only ASGI entrypoint.
- `backend/legacy_ai_app.py`: preserved optional local AI inference API.
- `runs/oil_unet_full/best.pt`: existing U-Net ResNet34 checkpoint (**already present**). Do not overwrite without validation.
- `A.I/train_oil_unet_csv.py`: training from CSV dataset split manifests.
- `A.I/train_oil_unet.py`: alternate image/mask directory training.
- `ULTRON_SAT_Launcher.bat`: starts local backend and serves dashboard.
- `SETUP_ULTRON_SAT.bat`: creates Windows Python environment and installs dependencies.
- `TRAIN_ULTRON_SAT.bat`: checks CSV dataset, runs smoke test or full training, and writes to *new* output paths.

## Local setup (Windows)

1. Install a compatible Python version and Git.
2. Clone/download this repository.
3. Run `SETUP_ULTRON_SAT.bat` once. Local setup installs `requirements-ai.txt` (including PyTorch and computer-vision dependencies). The Render server installs only `requirements.txt`.
4. Run `ULTRON_SAT_Launcher.bat`.
5. Browse to `http://127.0.0.1:8000/`. The backend must remain running for AI inference.

## Training

Put your licensed dataset at `DataSet/oilspill-detection-dataset-real/` with `splits/train.csv` and `splits/val.csv`. Each CSV must have `image_path` and `mask_path` columns. Paths are relative to the dataset root. The actual images and masks must exist at those paths. Do not assume they are included in this repository.

Run `TRAIN_ULTRON_SAT.bat`. Start with the 1-epoch smoke test, inspect losses and image-mask alignment, then run full training. The full option writes to `runs/oil_unet_new/` so the existing checkpoint is preserved. Check IoU/Dice on a truly held-out test set before deployment. It does **not** automatically switch the backend to the new model.

The preserved local AI backend expects a 256-pixel U-Net ResNet34 model at `runs/oil_unet_full/best.pt`. Training alternatives must match that architecture and preprocessing for inference. To serve a validated new checkpoint, set `ULTRON_CKPT` to the desired model path before starting the backend.

## Website vs backend

A single HTML file can be opened locally and hosted as a static GitHub Pages site for its browser-only experiences. **GitHub Pages cannot run Python/FastAPI, PyTorch inference, training, or Windows BAT files**. The AI `/analyze` endpoint needs a separately running backend. GitHub repository storage is not a GPU training service.

## Current hardware and hosted dashboard

The onboard imaging payload is now an **ESP32 camera**, replacing the previous ArduCAM hardware reference. This is a hardware documentation/UI terminology update; the existing optical model has **not** been retrained or validated using ESP32 camera image data. Upload and analyze images through the separate `/rgb` route.

GitHub Pages now serves the dashboard directly. Render provides only a 302 redirect to GitHub Pages; the static build script injects the browser enhancements into the published dashboard. The optional local FastAPI backend remains available separately.

## Hosting performance

Render's free 512 MB RAM service previously ran a PyTorch backend and encountered memory failures. It now runs only a minimal redirect, avoiding Python inference and model loading. Model accuracy still depends on independent validation.

## ESP32 telemetry dashboard (November 2026)

The existing full-size 3D dashboard is `web/ULTRON_SAT_MISSION_CONTROL_V5_IOS_GLASS_DOCK.html`.
The **live ESP32 readings extension** is `web/ultron_esp32_telemetry.js`, which is included by `build_static_dashboard.py` when GitHub Pages publishes the dashboard. The extension is kept separate from the large 3D HTML file to avoid altering shaders, 3D animation logic or other dashboard features.

**Live GitHub Pages dashboard:** https://shaikmdfaaz08-cpu.github.io/Ultron-SAT/  
**Render redirect:** https://ultron-sat.onrender.com/

**Supported readings:** TMP102 temperature; INA219 monitored 5 V bus voltage, current and power; MPU6050 accelerometer and gyroscope; LDR ADC light reading. The panel reads newline-delimited JSON telemetry from a USB-connected ESP32 or ground LoRa receiver using desktop Chromium Web Serial at 115200 baud. It also imports historical SD `.log` files and exports CSV. The latest MainLogger source samples physical sensors and sends USB JSON approximately once a second; SD logs, camera photos and optional LoRa packet transmission are separately scheduled at 60 seconds. Older uploaded sketches may still sample every 30 seconds.

**Important:** The sensor panel does **not** automatically receive readings through the public Render server. USB serial works on the computer to which the hardware is connected, with a supported browser and user authorization. The separate ESP32-CAM sketch stores images on SD, not a live internet camera feed. The orbit, solar and battery graphics remain illustrative simulations unless explicitly wired to hardware. Changing ArduCAM text to ESP32 Cam does not retrain or recalibrate the camera AI model.

## Scientific limitations

A segmentation mask indicates a candidate oil slick, not verified pollution. Results require labeled validation, sensor calibration, and domain checks. CubeSat orbit and battery examples are simulations unless an actual telemetry protocol is integrated. Do not use the drift demo for emergency response decisions.

## Existing files

Previous project work has been retained. The new launch/training utilities do not delete old runs, models or datasets.

## Live camera and redundant links (November 2026)

See [LIVE_SYSTEM_SETUP.md](LIVE_SYSTEM_SETUP.md) for the current USB, LoRa ground receiver, camera-streaming and rolling SD implementation, what remains unimplemented, and hardware prerequisites. The Wi-Fi streaming firmware in `firmware/CameraWifiStream` is optional and replaces the UART still-photo sketch on a single ESP32-CAM. LoRa remains disabled in the published firmware until the permitted radio parameters and compatible hardware are verified.
