#!/usr/bin/env python3
"""Evaluate production SAR U-Net on a separate labeled split.

Expected CSV columns: image_path,mask_path (relative to --dataset).
Masks must be single-channel class IDs. Supply --oil-id for multiclass masks.
This script DOES NOT train or overwrite any checkpoint.
"""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path
import cv2
import numpy as np
import torch
import segmentation_models_pytorch as smp

MEAN = np.array([.485, .456, .406], np.float32)
STD = np.array([.229, .224, .225], np.float32)

def pairs(root, split):
    csv_path = root / "splits" / (split + ".csv")
    if not csv_path.is_file():
        raise FileNotFoundError(f"Missing {csv_path}. A labeled holdout split is required.")
    entries = []
    with csv_path.open(encoding="utf-8-sig", newline="") as fp:
        rd = csv.DictReader(fp)
        if not {"image_path", "mask_path"}.issubset(set(rd.fieldnames or [])):
            raise ValueError("CSV requires columns image_path,mask_path")
        for row in rd:
            image = (root / row["image_path"]).resolve()
            mask = (root / row["mask_path"]).resolve()
            if not image.is_relative_to(root.resolve()) or not mask.is_relative_to(root.resolve()):
                raise ValueError("CSV paths must remain inside dataset root")
            if not image.is_file() or not mask.is_file():
                raise FileNotFoundError(f"Missing pair: {image}, {mask}")
            entries.append((image, mask))
    if not entries:
        raise ValueError("Empty labeled split")
    if len({str(p[0]) for p in entries}) != len(entries):
        raise ValueError("Repeated image in evaluation split")
    return entries

def load_model(path):
    model = smp.Unet("resnet34", encoder_weights=None, in_channels=3, classes=1).eval()
    weights = torch.load(path, map_location="cpu", weights_only=True)
    if isinstance(weights, dict):
        for key in ("model_state_dict", "state_dict", "model", "net"):
            if isinstance(weights.get(key), dict):
                weights = weights[key]
                break
        weights = {k.removeprefix("module."):v for k,v in weights.items()}
    model.load_state_dict(weights, strict=True)
    return model

def one_pair(model, image_path, mask_path, oil_id, interpolation, gray):
    rgb = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    mask = cv2.imread(str(mask_path), cv2.IMREAD_UNCHANGED)
    if rgb is None or mask is None or mask.ndim != 2:
        raise ValueError(f"Unreadable image or non-single-channel mask: {image_path}, {mask_path}")
    rgb = cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB)
    if rgb.shape[:2] != mask.shape[:2]:
        raise ValueError(f"Mask size mismatch: {image_path}")
    small = cv2.resize(rgb, (256, 256), interpolation=interpolation)
    if gray:
        v = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
        small = cv2.cvtColor(v, cv2.COLOR_GRAY2RGB)
    normalized = (small.astype(np.float32)/255. - MEAN)/STD
    x = torch.from_numpy(np.ascontiguousarray(normalized.transpose(2,0,1))).unsqueeze(0)
    with torch.inference_mode():
        p = torch.sigmoid(model(x)).squeeze().numpy()
    # Match deployed backend: upsample probability before threshold.
    prob = cv2.resize(p, (mask.shape[1], mask.shape[0]), interpolation=cv2.INTER_LINEAR)
    truth = (mask > 0) if oil_id is None else (mask == oil_id)
    return prob, truth

def scores(counts):
    tp, fp, fn, tn = map(int, counts)
    return {
        "tp":tp, "fp":fp, "fn":fn, "tn":tn,
        "iou":tp/max(1,tp+fp+fn),
        "dice":2*tp/max(1,2*tp+fp+fn),
        "precision":tp/max(1,tp+fp),
        "recall":tp/max(1,tp+fn),
    }

def evaluate(args):
    root=Path(args.dataset).resolve()
    checkpoint=Path(args.checkpoint).resolve()
    if not checkpoint.is_file():
        raise FileNotFoundError(f"Checkpoint absent: {checkpoint}")
    test=pairs(root,args.split)
    if args.split == "test":
        train=(root/"splits"/"train.csv")
        val=(root/"splits"/"val.csv")
        for path in (train,val):
            if path.is_file():
                other=pairs(root,path.stem)
                overlap={str(p[0]) for p in test}&{str(p[0]) for p in other}
                if overlap:
                    raise ValueError(f"Data leakage: {len(overlap)} test images also in {path.name}")
    torch.set_num_threads(max(1,args.threads))
    model=load_model(checkpoint)
    thresholds=[float(s) for s in args.thresholds.split(",")]
    if any(not 0 < t < 1 for t in thresholds):
        raise ValueError("Thresholds must lie strictly between 0 and 1")
    report={
        "checkpoint":str(checkpoint), "dataset":str(root), "split":args.split,
        "n_images":len(test),"oil_id":args.oil_id,"thresholds":thresholds,
        "note":"Holdout scores; not field-validated oil-spill detection.",
        "evaluation":[]
    }
    modes=["rgb","gray"] if args.both else ["gray" if args.gray else "rgb"]
    for mode in modes:
        total={t:np.zeros(4,dtype=np.int64) for t in thresholds}
        items=[]
        for image,mask in test:
            prob,truth=one_pair(model,image,mask,args.oil_id,
                                cv2.INTER_AREA if args.resize=="area" else cv2.INTER_LINEAR,
                                mode=="gray")
            row={"image":str(image.relative_to(root)), "oil_fraction":round(float(truth.mean()),6)}
            for t in thresholds:
                predicted=prob >= t
                tp=np.logical_and(predicted,truth).sum()
                fp=np.logical_and(predicted,~truth).sum()
                fn=np.logical_and(~predicted,truth).sum()
                tn=np.logical_and(~predicted,~truth).sum()
                total[t]+=np.array([tp,fp,fn,tn])
                row[f"iou_{t:g}"]=round(tp/max(1,tp+fp+fn),5)
            items.append(row)
        report["evaluation"].append({"mode":mode,"by_threshold":[{"threshold":t,**scores(total[t])}
                                     for t in thresholds],"per_image":items})
    output=Path(args.out)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2),encoding="utf-8")
    for mode in report["evaluation"]:
        print(f"{mode['mode']} - {len(test)} labeled images")
        for m in mode["by_threshold"]:
            print(f" threshold={m['threshold']:.2f}: IoU={m['iou']:.3f} Dice={m['dice']:.3f} "
                  f"precision={m['precision']:.3f} recall={m['recall']:.3f}")
    print(f"Report: {output}")
    if args.split == "test":
        print("Do not select a threshold based on the held-out test results; choose it using validation only.")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--dataset",default="DataSet/oilspill-detection-dataset-real")
    parser.add_argument("--checkpoint",default="runs/oil_unet_full/best.pt")
    parser.add_argument("--split",choices=["val","test"],default="test")
    parser.add_argument("--oil-id",type=int,default=None)
    parser.add_argument("--thresholds",default="0.30,0.40,0.50,0.60,0.70")
    parser.add_argument("--resize",choices=["area","linear"],default="area")
    parser.add_argument("--both",action="store_true",help="Evaluate source RGB and synthetic grayscale separately")
    parser.add_argument("--gray",action="store_true",help="Grayscale-only evaluation if --both is absent")
    parser.add_argument("--threads",type=int,default=2)
    parser.add_argument("--out",default="runs/holdout_evaluation.json")
    evaluate(parser.parse_args())
