# ULTRON SAT — Model quality and release checklist

## Current evidence (2026-11-03)
- Production SAR checkpoint: `runs/oil_unet_full/best.pt`.
- Training history contains 12 epochs. Best reported validation IoU = 0.66621, Dice = 0.79967 (epoch 11).
- These are *validation* metrics, NOT independent test metrics and NOT verified camera performance.
- Six-class RGB model uses `runs/oil_rgb_v3/best_rgb_model.pt`, separate from the binary SAR model.
- Render's free service has a ~512 MiB memory limit; deep learning model initialization can take time, and a restarted instance requires reloading.
- Production SAR inference now uses OpenCV INTER_AREA for 256x256 resize, to match original `A.I/train_oil_unet.py`.
- A screenshot of a grayscale photograph is not interchangeable with a SAR-derived training tile. Performance can degrade drastically outside the training distribution.

## 1. Get an independent labeled dataset
Create these files with *real* matched image/mask pairs:
- `DataSet/oilspill-detection-dataset-real/splits/train.csv`
- `DataSet/oilspill-detection-dataset-real/splits/val.csv`
- `DataSet/oilspill-detection-dataset-real/splits/test.csv`

CSV header: `image_path,mask_path`. Paths are relative to the dataset directory.
Masks must be single-channel class IDs with matching image dimensions. If multiple foreground classes are present, specify the numeric oil class with `--oil-id` instead of interpreting all nonzero pixels as oil. Include clean water, ships, wakes, shadows, and known negative examples. Never use identical or overlapping source scenes in train and test (split by acquisition/scene, not by overlapping tile).

Do NOT train the SAR model on unlabeled CubeSat photos or treat them as oil ground truth. An optical image camera needs separately labeled optical images; training on SAR alone doesn't establish optical camera accuracy.

## 2. Evaluate the currently deployed SAR model
From the repository root in a Python environment with `requirements.txt` installed:

```powershell
python "A.I/evaluate_sar_holdout.py" --split test --both --oil-id 1 --out runs/holdout_evaluation.json
```

Change `--oil-id` to match the dataset's verified labels. If your mask represents *only* oil as white/nonzero and all else black, omit `--oil-id`.
If the test CSV is absent, the script fails deliberately instead of fabricating metrics.

The result includes IoU, Dice, precision, recall, confusion counts, and per-image scores at thresholds 0.30, 0.40, 0.50, 0.60 and 0.70.
**Do not choose the threshold based on the test results**. First optimize on `--split val`, freeze the chosen threshold, and then run once on `--split test`.

## 3. If quality is insufficient, retrain off-production
Use `A.I/train_oil_unet_rgb_gray.py` with validated labeled pairs; it outputs a *new* checkpoint and does not replace the production weights:

```powershell
python "A.I/train_oil_unet_rgb_gray.py" --dataset "DataSet/oilspill-detection-dataset-real" --epochs 100 --batch 4 --workers 0 --out runs/oil_unet_rgb_gray_candidate
```

GPU strongly recommended; CPU training may be very slow. Do not assume 100 epochs always beats the old model; use early stopping and independent evaluation. This training script uses INTER_LINEAR, whereas the older production script used INTER_AREA; ensure candidate inference preprocessing matches its own training pipeline before deployment.

## 4. Acceptance criteria
- Verify that every input has a correct oil/non-oil ground-truth mask.
- Independent test results must be recorded for SAR and optical images *separately*.
- Compare candidate and production model on identical held-out data; require improvement in IoU and recall without unacceptable precision loss.
- Test both positive and negative images and inspect overlays for common failures.
- Verify startup succeeds on Render and that `/health` eventually reports `model_loaded: true`.
- Confirm `/analyze` works on a representative image and does not return 503 or 500.
- Confirm the RGB camera route separately via `/rgb/analyze`; `/rgb/health` can report false before the first RGB inference because RGB weights load lazily.
- Only after these checks promote candidate weights to production and redeploy. Preserve the working checkpoint for rollback.

## Why a larger red mask is not proof of improvement
A lower threshold or a larger rendered overlay can make a bad result look better without improving IoU, precision, or recall. For scientific integrity display predictions as predictions, never confirmed oil spills.
