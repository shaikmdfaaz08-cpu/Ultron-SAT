#!/usr/bin/env python3
"""Train a 3-channel U-Net on RGB plus grayscale satellite tiles.

Requires labeled image/mask CSVs in DataSet/oilspill-detection-dataset-real/splits/.
CSV columns: image_path,mask_path; paths relative to dataset root.
RGB and grayscale use the SAME 3-channel network and ImageNet normalization,
compatible with backend/app.py. Grayscale samples are replicated across channels.
This script NEVER overwrites the production checkpoint.
"""
import argparse
import csv
import json
import random
import time
from pathlib import Path

import cv2
import numpy as np
import torch
import segmentation_models_pytorch as smp
from torch.utils.data import DataLoader, Dataset

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def read_pairs(root, split):
    path = root / "splits" / (split + ".csv")
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Supply labeled training images/masks before training.")
    pairs = []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            image, mask = root / row["image_path"], root / row["mask_path"]
            if not image.is_file() or not mask.is_file():
                raise FileNotFoundError(f"Missing labeled pair: {image} / {mask}")
            pairs.append((image, mask))
    if not pairs:
        raise ValueError(f"No image/mask pairs in {path}")
    return pairs

class OilPairs(Dataset):
    def __init__(self, pairs, size, train, gray_probability=0.5, mask_oil_id=None, force_gray=False):
        self.pairs, self.size, self.train = pairs, size, train
        self.gray_probability, self.mask_oil_id = gray_probability, mask_oil_id
        self.force_gray = force_gray

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, index):
        ip, mp = self.pairs[index]
        image = cv2.imread(str(ip), cv2.IMREAD_UNCHANGED)
        mask = cv2.imread(str(mp), cv2.IMREAD_UNCHANGED)
        if image is None or mask is None:
            raise ValueError(f"Unreadable pair: {ip}, {mp}")
        if image.ndim == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:
            image = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
        else:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        if mask.ndim == 3:
            raise ValueError(f"Mask {mp} is multi-channel; supply a single-channel class-ID mask.")
        if self.mask_oil_id is None:
            mask = (mask > 0).astype(np.uint8)
        else:
            mask = (mask == self.mask_oil_id).astype(np.uint8)
        image = cv2.resize(image, (self.size, self.size), interpolation=cv2.INTER_LINEAR)
        mask = cv2.resize(mask, (self.size, self.size), interpolation=cv2.INTER_NEAREST)
        if self.train:
            if random.random() < 0.5:
                image, mask = np.fliplr(image), np.fliplr(mask)
            if random.random() < 0.5:
                image, mask = np.flipud(image), np.flipud(mask)
            if random.random() < 0.5:
                k = random.randint(1, 3)
                image, mask = np.rot90(image, k), np.rot90(mask, k)
        if self.force_gray or (self.train and random.random() < self.gray_probability):
            gray = cv2.cvtColor(np.ascontiguousarray(image), cv2.COLOR_RGB2GRAY)
            image = np.repeat(gray[..., None], 3, axis=2)
        if self.train:
            image = np.clip(image.astype(np.float32) * random.uniform(0.85, 1.15), 0, 255)
        image = (image.astype(np.float32) / 255.0 - MEAN) / STD
        x = torch.from_numpy(np.ascontiguousarray(image.transpose(2, 0, 1)))
        y = torch.from_numpy(np.ascontiguousarray(mask[None])).float()
        return x, y

@torch.no_grad()
def score(model, loader, device):
    model.eval()
    tp = fp = fn = 0
    for x, y in loader:
        logits = model(x.to(device))
        pred = torch.sigmoid(logits.float()) >= 0.5
        truth = y.to(device) > 0.5
        tp += (pred & truth).sum().item()
        fp += (pred & ~truth).sum().item()
        fn += (~pred & truth).sum().item()
    return dict(iou=tp / max(1, tp + fp + fn),
                dice=2 * tp / max(1, 2 * tp + fp + fn),
                tp=tp, fp=fp, fn=fn)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", default="DataSet/oilspill-detection-dataset-real")
    p.add_argument("--epochs", type=int, default=100)
    p.add_argument("--size", type=int, default=256,
                   help="Keep 256 for compatibility with the current deployed backend.")
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=0.0002)
    p.add_argument("--workers", type=int, default=0)
    p.add_argument("--patience", type=int, default=20)
    p.add_argument("--gray-probability", type=float, default=0.5)
    p.add_argument("--oil-id", type=int, default=None,
                   help="Set when masks contain multiple classes; otherwise all values >0 count as oil.")
    p.add_argument("--out", default="runs/oil_unet_rgb_gray_v2")
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()
    if args.size != 256:
        raise ValueError("Current Render backend only accepts 256x256; use --size 256.")
    if not 0 <= args.gray_probability <= 1:
        raise ValueError("--gray-probability must be between 0 and 1.")
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    root = Path(args.dataset)
    train, val = read_pairs(root, "train"), read_pairs(root, "val")
    if set(train) & set(val):
        raise ValueError("Train and validation CSVs share identical image/mask pairs.")
    print(f"Device: {device}; train={len(train)}; val={len(val)}; grayscale fraction={args.gray_probability}")
    if device == "cpu":
        print("WARNING: Heavy training on CPU may be very slow. A CUDA GPU is recommended.")
    def loader(data, training=False, gray=False):
        ds = OilPairs(data, args.size, training, args.gray_probability, args.oil_id, gray)
        return DataLoader(ds, batch_size=args.batch, shuffle=training, num_workers=args.workers,
                          pin_memory=(device == "cuda"))
    train_dl, val_rgb, val_gray = loader(train, True), loader(val), loader(val, gray=True)
    model = smp.Unet(encoder_name="resnet34", encoder_weights="imagenet",
                     in_channels=3, classes=1).to(device)
    bce = torch.nn.BCEWithLogitsLoss()
    dice_loss = smp.losses.DiceLoss(mode="binary", from_logits=True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    best, bad, history = -1.0, 0, []
    for epoch in range(1, args.epochs + 1):
        model.train()
        losses = []
        started = time.time()
        for x, y in train_dl:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad(set_to_none=True)
            logits = model(x)
            loss = bce(logits, y) + dice_loss(logits, y)
            loss.backward()
            optimizer.step()
            losses.append(loss.item())
        scheduler.step()
        rgb, gray = score(model, val_rgb, device), score(model, val_gray, device)
        combined = 0.5 * (rgb["iou"] + gray["iou"])
        record = {"epoch": epoch, "loss": float(np.mean(losses)),
                  "rgb": rgb, "grayscale": gray, "mean_iou": combined}
        history.append(record)
        (out / "history.json").write_text(json.dumps(history, indent=2))
        print(f"epoch={epoch} loss={record['loss']:.4f} RGB IoU={rgb['iou']:.4f} "
              f"gray IoU={gray['iou']:.4f} mean={combined:.4f} "
              f"seconds={time.time()-started:.0f}", flush=True)
        if combined > best + 1e-5:
            best, bad = combined, 0
            torch.save(model.state_dict(), out / "best.pt")
            (out / "metrics.json").write_text(json.dumps(record, indent=2))
        else:
            bad += 1
            if bad >= args.patience:
                print("Early stopping: no improvement on both-modality validation.")
                break
    print("Saved best validation checkpoint:", out / "best.pt")
    print("Do not replace the production checkpoint until an independent test set passes.")

if __name__ == "__main__":
    main()
