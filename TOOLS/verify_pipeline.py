r"""
ULTRON SAT - end-to-end verification of the REAL checkpoint.

Run from PowerShell:
    & "C:\Users\shaik\OneDrive\Documents\Ultron_SAT\.venv\Scripts\python.exe" `
      "C:\Users\shaik\OneDrive\Documents\ultronsat\tools\verify_pipeline.py" --split val --limit 10

Then, only after checking the output:
    ...\python.exe ...\verify_pipeline.py --split test

This script:
  1. Loads the same checkpoint/model code used by backend.app.
  2. Audits relevant preprocessing lines in ai/predict_oil_unet.py.
  3. Evaluates segmentation against the selected CSV's ground-truth masks.
  4. Reports per-image and pooled metrics, plus empty-mask counts.
  5. Saves image | ground truth | prediction | overlay panels and a metrics CSV.

Important:
  - Validation data is not held-out test performance.
  - The test split should only be evaluated for final reporting, not model selection.
  - Metrics on the current dataset do not establish performance in UAE waters unless
    the held-out images are actually from that region.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from BACKEND import app as be  # noqa: E402

DATA = ROOT / "DataSet" / "oilspill-detection-dataset-real"


def dice_iou(pred: np.ndarray, gt: np.ndarray) -> tuple[float, float]:
    """Dice/IoU for one binary image. Both-empty is counted as perfect agreement."""
    pred = np.asarray(pred, dtype=bool)
    gt = np.asarray(gt, dtype=bool)
    inter = float(np.logical_and(pred, gt).sum())
    p = float(pred.sum())
    g = float(gt.sum())
    if p + g == 0:
        return 1.0, 1.0
    union = p + g - inter
    return 2.0 * inter / (p + g), inter / union if union else 1.0


def find_csv(split: str) -> Path:
    names = {
        "train": ("train",),
        "val": ("val", "valid", "validation"),
        "test": ("test",),
    }[split]
    candidates = [
        p for p in DATA.rglob("*.csv")
        if any(name in p.stem.lower() for name in names)
    ]
    if not candidates:
        found = [str(p) for p in DATA.rglob("*.csv")]
        sys.exit(f"No CSV for split '{split}' under {DATA}. CSVs found: {found}")
    # Prefer an exact stem match, then the shortest path.
    return sorted(
        candidates,
        key=lambda p: (p.stem.lower() not in names, len(str(p)))
    )[0]


def resolve_path(value: str, csv_path: Path) -> Path:
    raw = str(value).strip().strip('"').strip("'")
    q = Path(raw.replace("\\", "/"))
    bases = (csv_path.parent, DATA, ROOT, Path.cwd())
    for base in bases:
        candidate = (base / q).resolve()
        if candidate.is_file():
            return candidate
    # Fallback to basename search only if unique; never silently pick an arbitrary duplicate.
    hits = list(DATA.rglob(q.name))
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        sys.exit(
            f"Ambiguous filename '{raw}' in {csv_path}; matches: "
            + ", ".join(str(p) for p in hits[:10])
        )
    sys.exit(f"Cannot find file '{raw}' referenced by {csv_path.name}")


def find_column(columns, patterns, exclude=()):
    """Choose a likely column, prioritising more specific patterns."""
    for pattern in patterns:
        for col in columns:
            name = str(col).strip().lower()
            if re.search(pattern, name) and not any(re.search(x, name) for x in exclude):
                return col
    return None


def print_preprocessing_audit() -> None:
    print("\n=== 2. Preprocessing audit: ai/predict_oil_unet.py ===")
    script = ROOT / "A.I" / "predict_oil_unet.py"
    if not script.is_file():
        print(f"Not found: {script}")
        return

    pattern = re.compile(
        r"resize|cv2|Image\.|normal|mean|std|thresh|sigmoid|"
        r"INTER|BILINEAR|NEAREST|albument|255",
        re.I,
    )
    for line_no, line in enumerate(
        script.read_text(encoding="utf-8", errors="replace").splitlines(), 1
    ):
        if pattern.search(line):
            print(f"  L{line_no}: {line.rstrip()}")
    print(
        "  Compare these lines with backend/app.py predict_probability(): "
        "resize method, target size, RGB/channel order, scaling, mean/std, and threshold."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=["train", "val", "test"], default="test")
    parser.add_argument("--csv", help="Explicit CSV path; overrides --split lookup")
    parser.add_argument("--limit", type=int, default=0, help="Evaluate only the first N rows")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--panels", type=int, default=6, help="Number of visual panels to save")
    parser.add_argument("--image-col", help="Explicit image-path CSV column")
    parser.add_argument("--mask-col", help="Explicit mask-path CSV column")
    args = parser.parse_args()

    if not 0.0 <= args.threshold <= 1.0:
        parser.error("--threshold must be between 0 and 1")
    if args.limit < 0 or args.panels < 0:
        parser.error("--limit and --panels must be >= 0")

    print("=== 1. Checkpoint ===")
    be.load_model()
    if be.STATE.model is None:
        sys.exit(f"FAILED to load model: {be.STATE.error}")
    parameter_count = sum(p.numel() for p in be.STATE.model.parameters())
    print(
        f"Loaded {be.CKPT_PATH} OK; {parameter_count / 1e6:.1f} M parameters; "
        f"resize backend = {be.RESIZE_BACKEND}"
    )

    print_preprocessing_audit()

    csv_path = Path(args.csv).expanduser().resolve() if args.csv else find_csv(args.split)
    if not csv_path.is_file():
        sys.exit(f"CSV not found: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"\n=== 3. Dataset: {csv_path} ({len(df)} rows) ===")
    print(f"Columns: {list(df.columns)}")

    image_col = args.image_col or find_column(
        df.columns,
        [r"^image$", r"image_path", r"img_path", r"image", r"img", r"file"],
        exclude=[r"mask", r"label", r"ground.?truth", r"(^|_)gt($|_)"],
    )
    mask_col = args.mask_col or find_column(
        df.columns,
        [r"mask_path", r"^mask$", r"mask", r"label_path", r"ground.?truth", r"label", r"(^|_)gt($|_)"],
    )
    if image_col not in df.columns or mask_col not in df.columns:
        sys.exit(
            "Could not identify valid image/mask columns. "
            f"Detected image={image_col!r}, mask={mask_col!r}. "
            "Inspect the printed columns and rerun with --image-col NAME --mask-col NAME."
        )
    print(f"Using image column '{image_col}' and mask column '{mask_col}'")

    if args.limit:
        df = df.head(args.limit).copy()
    if df.empty:
        sys.exit(f"No rows to evaluate in {csv_path}")

    output_dir = ROOT / "runs" / "verify"
    output_dir.mkdir(parents=True, exist_ok=True)

    records = []
    total_intersection = 0
    total_predicted = 0
    total_ground_truth = 0
    empty_gt_count = 0
    empty_pred_count = 0

    for index, (_, row) in enumerate(df.iterrows()):
        image_path = resolve_path(row[image_col], csv_path)
        mask_path = resolve_path(row[mask_col], csv_path)

        with Image.open(image_path) as image:
            rgb = np.asarray(image.convert("RGB"))
        with Image.open(mask_path) as mask_image:
            gt_image = mask_image.convert("L")

        height, width = rgb.shape[:2]
        gt = np.asarray(gt_image) > 0
        if gt.shape != (height, width):
            print(
                f"WARNING {image_path.name}: mask size {gt.shape[::-1]} != "
                f"image size {(width, height)}; resizing GT with nearest-neighbour."
            )
            gt = np.asarray(
                gt_image.resize((width, height), Image.Resampling.NEAREST)
            ) > 0

        probability = be.predict_probability(rgb)

        # Model-input resolution: use nearest-neighbour for binary ground truth.
        gt256 = np.asarray(
            Image.fromarray(gt.astype(np.uint8) * 255).resize(
                (256, 256), Image.Resampling.NEAREST
            )
        ) > 0
        dice256, iou256 = dice_iou(probability >= args.threshold, gt256)

        # Original resolution: use the same postprocessing as the web API.
        _, predicted_mask, _, _ = be.build_mask(
            probability, width, height, args.threshold, 0
        )
        intersection = int(np.logical_and(predicted_mask, gt).sum())
        predicted_pixels = int(predicted_mask.sum())
        gt_pixels = int(gt.sum())

        total_intersection += intersection
        total_predicted += predicted_pixels
        total_ground_truth += gt_pixels
        if gt_pixels == 0:
            empty_gt_count += 1
        if predicted_pixels == 0:
            empty_pred_count += 1

        dice_full, iou_full = dice_iou(predicted_mask, gt)
        records.append(
            {
                "image": image_path.name,
                "gt_percent": float(gt.mean() * 100.0),
                "pred_percent": float(predicted_mask.mean() * 100.0),
                "dice_256": dice256,
                "iou_256": iou256,
                "dice_full": dice_full,
                "iou_full": iou_full,
                "gt_empty": gt_pixels == 0,
                "prediction_empty": predicted_pixels == 0,
            }
        )

        if index < args.panels:
            overlay = rgb.astype(np.float32).copy()
            overlay[predicted_mask] = (
                0.5 * overlay[predicted_mask]
                + 0.5 * np.array([255, 60, 90], dtype=np.float32)
            )
            gt_rgb = np.stack([gt.astype(np.uint8) * 255] * 3, axis=-1)
            pred_rgb = np.stack([predicted_mask.astype(np.uint8) * 255] * 3, axis=-1)
            panel = np.hstack([rgb, gt_rgb, pred_rgb, overlay.astype(np.uint8)])
            safe_stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", image_path.stem)[:80]
            Image.fromarray(panel).save(
                output_dir / f"{args.split}_{index:02d}_{safe_stem}.png"
            )

        if (index + 1) % 10 == 0 or index + 1 == len(df):
            print(f"Processed {index + 1}/{len(df)} images")

    results = pd.DataFrame(records)
    pd.set_option("display.width", 220)
    pd.set_option("display.max_columns", None)
    print("\n=== 4. Per-image results ===")
    print(results.round(4).to_string(index=False))

    pooled_denominator = total_predicted + total_ground_truth
    pooled_dice = (
        2.0 * total_intersection / pooled_denominator
        if pooled_denominator else 1.0
    )
    pooled_union = total_predicted + total_ground_truth - total_intersection
    pooled_iou = total_intersection / pooled_union if pooled_union else 1.0

    print(
        f"\n=== 5. Summary: split='{args.split}', n={len(results)}, "
        f"threshold={args.threshold} ==="
    )
    print(
        f"Mean per-image Dice/IoU at 256x256: "
        f"{results['dice_256'].mean():.4f} / {results['iou_256'].mean():.4f}"
    )
    print(
        f"Mean per-image Dice/IoU original: "
        f"{results['dice_full'].mean():.4f} / {results['iou_full'].mean():.4f}"
    )
    print(f"Pooled Dice/IoU original: {pooled_dice:.4f} / {pooled_iou:.4f}")
    print(f"Median per-image Dice at 256x256: {results['dice_256'].median():.4f}")
    print(f"Images with empty ground truth: {empty_gt_count}/{len(results)}")
    print(f"Images with empty prediction: {empty_pred_count}/{len(results)}")
    print(
        "Training reported best VALIDATION Dice ~= 0.7997 / IoU ~= 0.6662. "
        "Compare with the full val run; a mismatch may indicate preprocessing or "
        "evaluation-protocol differences."
    )
    if args.split != "test":
        print(
            f"NOTE: '{args.split}' is not the held-out test split; "
            "do not report these as test performance."
        )
    print(
        "Regional caveat: these numbers do not establish UAE/Middle East performance "
        "unless this split contains independent, region-labelled imagery."
    )

    metrics_path = output_dir / f"metrics_{args.split}.csv"
    results.to_csv(metrics_path, index=False)
    print(f"\nMetrics CSV: {metrics_path}")
    print(f"Visual panels saved in: {output_dir}")


if __name__ == "__main__":
    main()
