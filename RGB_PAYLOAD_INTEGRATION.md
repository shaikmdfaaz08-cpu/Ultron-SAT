# RGB camera payload integration (2026-11-03)

## What is implemented
- Separate `GET /rgb` page with JPEG/PNG/TIFF upload and 6-class color segmentation overlay.
- Separate `POST /rgb/analyze` endpoint for a LADOS-trained U-Net/ResNet34, RGB input size 256 and ImageNet normalization.
- `GET /rgb/health` reports whether the RGB checkpoint is installed.
- Existing `/analyze` and production SAR model are **unchanged**.
- Missing RGB model yields an explicit 503 error, never simulated detection.
- All results are experimental: no ArduCAM-specific or real-spill operational validation.

## Required model file (not committed here)
The Google Colab fine-tuned checkpoint has been backed up by the team at
`MyDrive/ULTRON_SAT_RGB/finetuned/best_rgb_finetuned.pt`.
Install that `state_dict` at `runs/oil_rgb_v3/best_rgb_model.pt` for deployment,
or set `ULTRON_RGB_CKPT` to its exact accessible **server-local** path.
Cloud Google Drive paths are not automatically accessible from Render.

**Critical:** The current GitHub branch contains integration code but **not** the model weights. `/rgb` can render before weights arrive, but image inference will not work until the checkpoint is installed. Do not claim deployed RGB inference until `/rgb/health` shows `checkpoint_present: true` and image upload has been tested.

## LADOS class mapping (verified against COCO polygons)
0 background; 1 emulsion; 2 oil; 3 oil-platform; 4 sheen; 5 ship.
The RGB model has **six outputs** and is not interchangeable with the binary SAR checkpoint.

## Verified experiments
- SAR production: independent 22-image test IoU 67.01%, Dice 80.25%.
- LADOS RGB training: 2,370 train, 675 validation, 343 test, 15 epochs.
- RGB first run: best validation slick (emulsion/oil/sheen) mean IoU 72.39%.
- RGB first run independent test: 71.43% slick mean IoU; oil-platform IoU 0%.
- RGB fine-tuning: 10 additional epochs, best validation slick mean IoU 73.65%. Independent test for fine-tuned checkpoint **not yet run**.
- These scores are on different modalities/datasets; cannot be compared as direct model rankings.

## Still pending
- Real ESP32/LoRa serial telemetry integration; teammate's firmware not yet received.
- Real ArduCAM image transfer and testing; camera library issue reported.
- Actual wind/current forecast, georeferenced imagery, 48-hour trajectory, real pipeline map layers: **not verified or implemented by this addition**.
- Raspberry Pi, satellite hardware interfaces, and orbital imaging capability are not implied.

## Production notes
Render may have limited RAM for two ResNet34 inference models. Check service logs during RGB loading and test both RGB and SAR endpoints under actual deployment resources. If memory is insufficient, run RGB as a separate service.
