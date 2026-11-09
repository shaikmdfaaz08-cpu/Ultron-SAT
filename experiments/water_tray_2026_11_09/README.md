# ULTRON-SAT RGB water-tray experiment (20 extracted frames)

This experiment is based on the uploaded 20-page PDF captured on 2026-11-09.

**Original files uploaded:** `images/frame_01.jpg` through `images/frame_20.jpg` are now committed in the GitHub repository, together with `features.csv` and a separately trained experimental appearance classifier. The model produces an image-level score, not pixel-level segmentation.

## Label interpretation

- frame_01.jpg through frame_12.jpg: provisional `dark_patch_visible`
- frame_13.jpg through frame_20.jpg: provisional `no_obvious_dark_patch`
- All frames have material identity **unverified**; no photo is confirmed to contain oil or pomegranate molasses.
- All 20 frames appear to be from one tray/session. A random train/test split would give severely misleading independent accuracy.

## How the original photos were uploaded

1. Extract the provided `ULTRON_SAT_RGB_EXTRACTED_20_IMAGES_AND_TRAINING.zip` on your computer.
2. Open `ULTRON_SAT_RGB_DATASET/images`. You should see `frame_01.jpg` through `frame_20.jpg`.
3. Go to the GitHub repository's `experiments/water_tray_2026_11_09/images/` directory.
4. Click **Add file -> Upload files**, drag all 20 JPEGs, and commit. Do not upload the original PDF instead of the actual image files.
5. The complete original 20-photo dataset is committed. GitHub itself does not retrain a model when someone uploads files.
6. The repository now includes a **prototype_model.json trained from the original 20 extracted JPEG pixels**. To retrain with additional correctly labeled photos, clone/download the repo and run the Python command below, then replace this model file on GitHub. Uploading the model JSON triggers the existing GitHub Pages deployment; uploading JPGs alone does not train or redeploy.

The training script works *before* the originals are uploaded by reading the saved `features.csv` extracted from them. When the original JPEGs are available in the `images/` folder, the script recomputes features directly from the photos. This is a limited appearance classifier, NOT the real six-class oil RGB segmentation model and not the separately deployed SAR model.

## How to use the experiment responsibly

A small feature-based logistic regression distinguishes **visible brown/dark patches** versus **no obvious patch**, not oil chemistry. Scores on the same 20 images are in-sample scores only. To make a real oil-versus-molasses model, first create verified ground-truth labels from multiple independent recording sessions, then split by session and evaluate on unseen tray setups. Pixel-level masks are separately required for segmentation.

To run locally from the repo root:

```bash
pip install numpy pillow scikit-learn
python A.I/train_water_tray_prototype.py --data experiments/water_tray_2026_11_09 --out runs/water_tray_prototype
```

The trainer writes `runs/water_tray_prototype/prototype_model.json` in the schema expected by `web/water_tray_rgb_core.js`, as well as a training report and a compatibility copy of the model. After examining the report, replace `experiments/water_tray_2026_11_09/prototype_model.json` in the GitHub UI with the new file content and commit to `main`. The Pages workflow automatically copies that file into `site-dist/models/water_tray_prototype.json` and republishes the website. 

If original JPEGs are present, the trainer recomputes features directly from them; otherwise it consumes the saved numerical features. The current data has only one scene and no independent validation. Never claim the training score is generalization accuracy.

## Dashboard overlays and 0–48h scenario

The public RGB section separately runs the 20-frame logistic-regression **whole-image** classifier and overlays a **colour-rule candidate mask** for visible dark/brown regions. This mask is NOT the output of a trained pixel segmentation model. The main comparison slider can show that candidate area. The RGB 0–48h visual translation is an illustrative demonstration with arbitrary pixel displacement, NOT measured oil spread, weather or a real geographic forecast. The original SAR U-Net model and forecast-driven drift panel remain separate; real 48h SAR weather projection needs true location, scale, and external weather/marine data.
