#!/usr/bin/env python3
"""Train a small visible-dark-patch prototype from user camera frames.
This is NOT a physical oil detector or a pixel segmentation model.
With one scene, no honest independent-scene test accuracy is available.
"""
from __future__ import annotations
import argparse, csv, json, warnings
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

LABELS = ("no_obvious_dark_patch", "dark_patch_visible")
FEATURES = ("dark_frac", "brown_frac", "very_dark_frac", "brown_dark_frac")

def image_features(path: Path):
    from PIL import Image
    with Image.open(path) as img:
        a = np.asarray(img.convert("RGB").resize((96,96)),dtype=np.float32)/255.
    r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    bright=.299*r+.587*g+.114*b
    dark=bright<.44
    brown=(r>1.13*g)&(r>1.16*b)&(r>.10)&(r<.81)&(g<.62)
    return [float(dark.mean()),float(brown.mean()),float((bright<.25).mean()),float((dark & brown).mean())]

def read_data(folder: Path):
    csvfile=folder/"features.csv"
    if not csvfile.exists():
        raise FileNotFoundError("Expected the saved derived features.csv in "+str(folder))
    with csvfile.open(newline="",encoding="utf-8") as f:
        rows=list(csv.DictReader(f))
    if not rows:raise ValueError("The feature table is empty")
    # If all original images have been uploaded to GitHub, extract pixel
    # features from the real photos. Otherwise use the saved derived features
    # that were extracted from the source PDF.
    images=folder/"images"
    all_images=images.is_dir() and all((images/r["filename"]).exists() for r in rows)
    if all_images:
        X=np.array([image_features(images/r["filename"]) for r in rows],dtype=float)
        source="original GitHub JPEG images"
    else:
        X=np.array([[float(row[k]) for k in FEATURES] for row in rows],dtype=float)
        source="saved features extracted from the user's original JPEG images (original JPEGs not committed)"
    labels=[r["visual_label"] for r in rows]
    if any(label not in LABELS for label in labels):
        raise ValueError("Unexpected visual label; manually review CSV")
    y=np.array([LABELS.index(label) for label in labels])
    scenes={r["scene_id"] for r in rows}
    if len(set(y))<2:raise ValueError("Both visual categories required")
    return X,y,rows,scenes,source

def run(folder:Path,out:Path):
    X,y,rows,scenes,source=read_data(folder)
    out.mkdir(parents=True,exist_ok=True)
    scaler=StandardScaler()
    normalized=scaler.fit_transform(X)
    classifier=LogisticRegression(C=2.0,max_iter=500,class_weight="balanced",random_state=7)
    classifier.fit(normalized,y)
    accuracy=float(classifier.score(normalized,y))
    # Model schema MUST match the browser's water_tray_rgb_core.js.
    # GitHub Pages copies experiments/.../prototype_model.json at build time.
    model={
      "model_name":"ULTRON-SAT RGB visible dark patch prototype",
      "trained_on":f"{len(rows)} frames from one water-tray session; {source}",
      "version":1,
      "verified_oil_detector":False,
      "material_labels_verified":False,
      "independent_test_accuracy":None,
      "classes":list(LABELS),"features":list(FEATURES),
      "mean":scaler.mean_.tolist(),
      "scale":scaler.scale_.tolist(),
      "coef":classifier.coef_[0].tolist(),
      "intercept":float(classifier.intercept_[0]),
      "training_accuracy_only":accuracy,
      "source":source,
      "warning":"One scene, provisional visual labels, uncalibrated score. NOT validated oil detection."
    }
    report={
      "n_images":len(rows),
      "class_counts":{label:int((y==i).sum()) for i,label in enumerate(LABELS)},
      "scene_count":len(scenes),
      "source":source,
      "training_accuracy_only":accuracy,
      "independent_test_accuracy":None,
      "segmentation_model":False,
      "oil_or_molasses_identity_verified":False,
      "note":"This result is not evidence of oil-spill recognition or generalization to new trays."
    }
    (out/"prototype_model.json").write_text(json.dumps(model,indent=2)+"\n",encoding="utf8")
    # Compatibility with earlier training-package filename.
    (out/"experimental_appearance_model.json").write_text(json.dumps(model,indent=2)+"\n",encoding="utf8")
    (out/"training_report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print(json.dumps(report,indent=2))
    return report

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--data",type=Path,default=Path("experiments/water_tray_2026_11_09"))
    parser.add_argument("--out",type=Path,default=Path("runs/water_tray_prototype"))
    args=parser.parse_args()
    run(args.data,args.out)
