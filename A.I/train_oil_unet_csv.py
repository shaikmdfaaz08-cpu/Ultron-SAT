import argparse
import csv
import json
import time
from pathlib import Path

import cv2
import numpy as np
import torch
import albumentations as A
from albumentations.pytorch import ToTensorV2
import segmentation_models_pytorch as smp
from torch.utils.data import Dataset, DataLoader

ROOT = Path("DataSet/oilspill-detection-dataset-real")


def load_split(name):
    csv_path = ROOT / "splits" / f"{name}.csv"
    with csv_path.open("r", newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    items = []
    for row in rows:
        image = ROOT / row["image_path"]
        mask = ROOT / row["mask_path"]
        if image.is_file() and mask.is_file():
            items.append((image, mask))
        else:
            print("Missing pair:", image, mask)

    if not items:
        raise RuntimeError(f"No valid image/mask pairs found in {csv_path}")
    return items


class OilDataset(Dataset):
    def __init__(self, items, size, transform=None):
        self.items = items
        self.size = size
        self.transform = transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, index):
        image_path, mask_path = self.items[index]

        image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
        mask = cv2.imread(str(mask_path), cv2.IMREAD_UNCHANGED)

        if image is None or mask is None:
            raise RuntimeError(f"Could not read {image_path} or {mask_path}")

        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        if mask.ndim == 3:
            mask = mask[:, :, 0]

        # Oil is labeled with value > 0
        mask = (mask > 0).astype(np.uint8)

        if self.transform:
            augmented = self.transform(image=image, mask=mask)
            image = augmented["image"]
            mask = augmented["mask"]

        # Ensure mask is float tensor with channel dimension [1, H, W]
        if not isinstance(mask, torch.Tensor):
            mask = torch.from_numpy(mask).float()
        else:
            mask = mask.float()
            
        if mask.ndim == 2:
            mask = mask.unsqueeze(0)

        return image, mask


def get_transforms(size, augment=False):
    if augment:
        return A.Compose([
            A.Resize(size, size),
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.5),
            A.RandomRotate90(p=0.5),
            A.ShiftScaleRotate(shift_limit=0.0625, scale_limit=0.1, rotate_limit=15, p=0.5),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ])
    else:
        return A.Compose([
            A.Resize(size, size),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ])


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    tp = fp = fn = 0

    for images, masks in loader:
        images, masks = images.to(device), masks.to(device)
        predictions = torch.sigmoid(model(images)) > 0.5
        truth = masks > 0.5

        tp += (predictions & truth).sum().item()
        fp += (predictions & ~truth).sum().item()
        fn += (~predictions & truth).sum().item()

    iou = tp / (tp + fp + fn + 1e-9)
    dice = 2 * tp / (2 * tp + fp + fn + 1e-9)
    return iou, dice


def main():
    parser = argparse.ArgumentParser(description="Enhanced Oil Spill Segmentation Training")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--encoder", type=str, default="resnet34")
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--out", default="runs/oil_unet_enhanced")
    args = parser.parse_args()

    # Reproducibility
    torch.manual_seed(42)
    np.random.seed(42)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    train_items = load_split("train")
    val_items = load_split("val")

    if not args.full:
        import random
        random.seed(42)
        random.shuffle(train_items)
        random.shuffle(val_items)
        train_items = train_items[:args.limit]
        val_items = val_items[:args.limit]

    print(f"Training pairs: {len(train_items)}")
    print(f"Validation pairs: {len(val_items)}")

    train_loader = DataLoader(
        OilDataset(train_items, args.size, transform=get_transforms(args.size, augment=True)),
        batch_size=args.batch, shuffle=True, num_workers=args.workers, pin_memory=True
    )
    val_loader = DataLoader(
        OilDataset(val_items, args.size, transform=get_transforms(args.size, augment=False)),
        batch_size=args.batch, shuffle=False, num_workers=args.workers, pin_memory=True
    )

    model = smp.Unet(
        encoder_name=args.encoder,
        encoder_weights="imagenet",
        in_channels=3,
        classes=1,
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)
    scaler = torch.cuda.amp.GradScaler(enabled=(device == "cuda"))

    bce = torch.nn.BCEWithLogitsLoss()
    dice_loss = smp.losses.DiceLoss(mode="binary", from_logits=True)

    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    best_iou = -1.0
    bad_epochs = 0
    history = []

    for epoch in range(1, args.epochs + 1):
        started = time.time()
        model.train()
        total_loss = 0.0

        for images, masks in train_loader:
            images, masks = images.to(device), masks.to(device)
            optimizer.zero_grad(set_to_none=True)

            with torch.cuda.amp.autocast(enabled=(device == "cuda")):
                logits = model(images)
                loss = bce(logits, masks) + dice_loss(logits, masks)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item() * images.size(0)

        scheduler.step()
        iou, dice = evaluate(model, val_loader, device)
        average_loss = total_loss / len(train_items)
        current_lr = optimizer.param_groups[0]["lr"]

        record = {
            "epoch": epoch,
            "loss": round(average_loss, 5),
            "val_iou": round(iou, 5),
            "val_dice": round(dice, 5),
            "lr": current_lr,
        }
        history.append(record)

        print(
            f"Epoch {epoch}/{args.epochs} | Loss: {average_loss:.4f} "
            f"| Val IoU: {iou:.4f} | Val Dice: {dice:.4f} "
            f"| LR: {current_lr:.2e} | {time.time() - started:.0f}s",
            flush=True,
        )

        with (output / "history.json").open("w") as f:
            json.dump(history, f, indent=2)

        if iou > best_iou:
            best_iou = iou
            bad_epochs = 0
            torch.save(model.state_dict(), output / "best.pt")
            print(f"[*] Saved new best model with IoU: {iou:.4f}")
        else:
            bad_epochs += 1
            if args.full and bad_epochs >= args.patience:
                print("Early stopping triggered.")
                break

    print(f"Training complete. Best checkpoint saved at: {output / 'best.pt'}")


if __name__ == "__main__":
    main()