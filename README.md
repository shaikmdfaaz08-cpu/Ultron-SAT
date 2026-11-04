# ULTRON SAT — Mission Control and Oil-Slick Segmentation

This repository contains a local AI oil-slick segmentation backend, Windows startup scripts, an existing web dashboard, trained U-Net weights, and engineering materials.

## Current components

- `web/ULTRON_SAT_MISSION_CONTROL_V5_IOS_GLASS_DOCK.html`: current hosted dashboard (selected by Render `ULTRON_DASHBOARD`).
- `backend/rgb_payload.py`: experimental six-class image analysis for the ESP32 camera payload, separate from SAR inference.
- `backend/app.py`: FastAPI service and trained-image inference endpoint.
- `runs/oil_unet_full/best.pt`: existing U-Net ResNet34 checkpoint (**already present**). Do not overwrite without validation.
- `A.I/train_oil_unet_csv.py`: training from CSV dataset split manifests.
- `A.I/train_oil_unet.py`: alternate image/mask directory training.
- `ULTRON_SAT_Launcher.bat`: starts local backend and serves dashboard.
- `SETUP_ULTRON_SAT.bat`: creates Windows Python environment and installs dependencies.
- `TRAIN_ULTRON_SAT.bat`: checks CSV dataset, runs smoke test or full training, and writes to *new* output paths.

## Local setup (Windows)

1. Install a compatible Python version and Git.
2. Clone/download this repository.
3. Run `SETUP_ULTRON_SAT.bat` once. Note: requirements install `torch` and computer-vision dependencies; training scripts additionally use `opencv-python` and `albumentations`.
4. Run `ULTRON_SAT_Launcher.bat`.
5. Browse to `http://127.0.0.1:8000/`. The backend must remain running for AI inference.

## Training

Put your licensed dataset at `DataSet/oilspill-detection-dataset-real/` with `splits/train.csv` and `splits/val.csv`. Each CSV must have `image_path` and `mask_path` columns. Paths are relative to the dataset root. The actual images and masks must exist at those paths. Do not assume they are included in this repository.

Run `TRAIN_ULTRON_SAT.bat`. Start with the 1-epoch smoke test, inspect losses and image-mask alignment, then run full training. The full option writes to `runs/oil_unet_new/` so the existing checkpoint is preserved. Check IoU/Dice on a truly held-out test set before deployment. It does **not** automatically switch the backend to the new model.

The backend currently expects a 256-pixel U-Net ResNet34 model at `runs/oil_unet_full/best.pt`. Training alternatives must match that architecture and preprocessing for inference. To serve a validated new checkpoint, set `ULTRON_CKPT` to the desired model path before starting the backend.

## Website vs backend

A single HTML file can be opened locally and hosted as a static GitHub Pages site for its browser-only experiences. **GitHub Pages cannot run Python/FastAPI, PyTorch inference, training, or Windows BAT files**. The AI `/analyze` endpoint needs a separately running backend. GitHub repository storage is not a GPU training service.

## Current hardware and hosted dashboard

The onboard imaging payload is now an **ESP32 camera**, replacing the previous ArduCAM hardware reference. This is a hardware documentation/UI terminology update; the existing optical model has **not** been retrained or validated using ESP32 camera image data. Upload and analyze images through the separate `/rgb` route.

Render serves `web/ULTRON_SAT_MISSION_CONTROL_V5_IOS_GLASS_DOCK.html` with `ULTRON_DASHBOARD` set to its filename. The main FastAPI app adds runtime navigation/detection updates and displays ESP32 terminology for remaining legacy dashboard labels.

## Hosting performance

The current Render free service has only 512 MB RAM and limited CPU, making PyTorch cold starts and memory usage problematic. A paid **2 GB or higher** instance (Render 1c-2g, Railway Hobby with allocated memory, Koyeb 2 GB, or Fly.io 2 GB) is more realistic for this workload. Migration does not automatically improve model accuracy, which requires validated labeled ESP32 optical imagery.

## ESP32 telemetry dashboard (November 2026)

The existing full-size 3D dashboard is `web/ULTRON_SAT_MISSION_CONTROL_V5_IOS_GLASS_DOCK.html`.
The **live ESP32 readings extension** is `web/ultron_esp32_telemetry.js`, which is injected by `backend/app.py` when Render serves the dashboard. The extension is kept separate from the large 3D HTML file to avoid altering shaders, 3D animation logic or other dashboard features.

**Live application:** https://ultron-sat.onrender.com/

**Supported readings:** TMP102 temperature; INA219 monitored 5 V bus voltage, current and power; MPU6050 accelerometer and gyroscope; LDR ADC light reading. The panel reads newline-delimited JSON telemetry from a USB-connected ESP32 or ground LoRa receiver using desktop Chromium Web Serial at 115200 baud. It also imports historical SD `.log` files and exports CSV. Samples typically arrive every 30 seconds per the supplied firmware.

**Important:** The sensor panel does **not** automatically receive readings through the public Render server. USB serial works on the computer to which the hardware is connected, with a supported browser and user authorization. The separate ESP32-CAM sketch stores images on SD, not a live internet camera feed. The orbit, solar and battery graphics remain illustrative simulations unless explicitly wired to hardware. Changing ArduCAM text to ESP32 Cam does not retrain or recalibrate the camera AI model.

## Scientific limitations

A segmentation mask indicates a candidate oil slick, not verified pollution. Results require labeled validation, sensor calibration, and domain checks. CubeSat orbit and battery examples are simulations unless an actual telemetry protocol is integrated. Do not use the drift demo for emergency response decisions.

## Existing files

Previous project work has been retained. The new launch/training utilities do not delete old runs, models or datasets.
