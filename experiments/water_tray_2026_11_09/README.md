# ULTRON-SAT RGB water-tray experiment (20 extracted frames)

This experiment is based on the uploaded 20-page PDF captured on 2026-11-09.

**The GitHub repository currently contains a derived features CSV, not the actual JPEGs.** Original full-quality extracted JPEGs are provided separately in the downloadable dataset ZIP in the chat. Upload all 20 images into this repository's **images/** folder to enable training from their real pixels.

## Label interpretation

- frame_01.jpg through frame_12.jpg: provisional `dark_patch_visible`
- frame_13.jpg through frame_20.jpg: provisional `no_obvious_dark_patch`
- All frames have material identity **unverified**; no photo is confirmed to contain oil or pomegranate molasses.
- All 20 frames appear to be from one tray/session. A random train/test split would give severely misleading independent accuracy.

## How to upload photos

1. Extract the provided `ULTRON_SAT_RGB_EXTRACTED_20_IMAGES_AND_TRAINING.zip` on your computer.
2. Open `ULTRON_SAT_RGB_DATASET/images`. You should see `frame_01.jpg` through `frame_20.jpg`.
3. Go to the GitHub repository's `experiments/water_tray_2026_11_09/images/` directory.
4. Click **Add file -> Upload files**, drag all 20 JPEGs, and commit. Do not upload the original PDF instead of the actual image files.
5. The `Train experimental water tray RGB classifier` GitHub Action will start on a push that changes the experiment directory. Alternatively open Actions and click **Run workflow**.
6. Download the Action artifact called `water-tray-prototype`, which includes `experimental_appearance_model.json` and `training_report.json`.

The Action also works *before* the originals have been uploaded: it can train from the already-committed `features.csv` extracted from the 20 images. This is a limited appearance classifier, NOT the real six-class oil RGB segmentation model and not the separately deployed SAR model.

## How to use the experiment responsibly

A small feature-based logistic regression distinguishes **visible brown/dark patches** versus **no obvious patch**, not oil chemistry. Scores on the same 20 images are in-sample scores only. To make a real oil-versus-molasses model, first create verified ground-truth labels from multiple independent recording sessions, then split by session and evaluate on unseen tray setups. Pixel-level masks are separately required for segmentation.

To run locally from the repo root:

```bash
pip install numpy pillow scikit-learn
python A.I/train_water_tray_prototype.py --data experiments/water_tray_2026_11_09 --out runs/water_tray_prototype
```

If original JPEGs are present, the trainer recomputes all features from them; otherwise it consumes the committed numerical features. Never claim the training report's in-sample metric is generalization accuracy.
