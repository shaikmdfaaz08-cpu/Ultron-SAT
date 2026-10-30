#!/usr/bin/env python3
"""Train a U-Net (ResNet34 encoder) to segment oil slicks (binary: oil vs everything else).

Example (MKLab-style folders, label value 1 = oil):
  python train_oil_unet.py --train-img data/train/images --train-mask data/train/labels_1D ^
      --test-img data/test/images --test-mask data/test/labels_1D --oil-id 1 --epochs 50

Quick smoke test (1 epoch, 32 images):  add  --epochs 1 --limit 32
Masks that are 0/255 instead of class ids:  --oil-id 255
"""
import argparse, glob, json, os, random, time
import cv2, numpy as np, torch
import segmentation_models_pytorch as smp
from torch.utils.data import Dataset, DataLoader

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def pairs(img_dir, mask_dir):
    exts = ('.jpg', '.jpeg', '.png', '.tif', '.tiff')
    imgs = sorted(f for f in glob.glob(os.path.join(img_dir, '*')) if f.lower().endswith(exts))
    stem = lambda p: os.path.splitext(os.path.basename(p))[0]
    masks = {stem(f): f for f in glob.glob(os.path.join(mask_dir, '*'))}
    out = [(i, masks[stem(i)]) for i in imgs if stem(i) in masks]
    if not out:
        raise SystemExit(f'No image/mask pairs in {img_dir} and {mask_dir}. '
                         'File names must match (img_001.jpg and img_001.png).')
    return out


class SegSet(Dataset):
    def __init__(self, items, size, oil_id, train):
        self.items, self.size, self.oil, self.train = items, size, oil_id, train

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        ip, mp = self.items[i]
        img = cv2.imread(ip, cv2.IMREAD_COLOR)[:, :, ::-1]
        m = cv2.imread(mp, cv2.IMREAD_UNCHANGED)
        if m.ndim == 3:            # use single-channel class-id masks (labels_1D), not colour masks
            m = m[:, :, 0]
        m = (m == self.oil).astype(np.uint8)
        img = cv2.resize(img, (self.size, self.size), interpolation=cv2.INTER_AREA)
        m = cv2.resize(m, (self.size, self.size), interpolation=cv2.INTER_NEAREST)
        if self.train:
            if random.random() < .5: img, m = img[:, ::-1], m[:, ::-1]
            if random.random() < .5: img, m = img[::-1], m[::-1]
            img = np.clip(img.astype(np.float32) * random.uniform(.85, 1.15), 0, 255)
        x = ((img.astype(np.float32) / 255. - MEAN) / STD).transpose(2, 0, 1)
        return (torch.from_numpy(np.ascontiguousarray(x)),
                torch.from_numpy(np.ascontiguousarray(m)).float().unsqueeze(0))


@torch.no_grad()
def evaluate(model, loader, dev):
    """IoU and Dice for the oil class, pooled over all pixels, threshold 0.5."""
    model.eval(); tp = fp = fn = 0
    for x, y in loader:
        x, y = x.to(dev), y.to(dev)
        p = torch.sigmoid(model(x).float()) > .5
        t = y > .5
        tp += (p & t).sum().item(); fp += (p & ~t).sum().item(); fn += (~p & t).sum().item()
    return tp / (tp + fp + fn + 1e-9), 2 * tp / (2 * tp + fp + fn + 1e-9)


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--train-img', required=True); a.add_argument('--train-mask', required=True)
    a.add_argument('--test-img'); a.add_argument('--test-mask')
    a.add_argument('--oil-id', type=int, default=1)
    a.add_argument('--size', type=int, default=512); a.add_argument('--epochs', type=int, default=50)
    a.add_argument('--batch', type=int, default=8); a.add_argument('--lr', type=float, default=3e-4)
    a.add_argument('--val-frac', type=float, default=.15); a.add_argument('--patience', type=int, default=12)
    a.add_argument('--workers', type=int, default=2); a.add_argument('--limit', type=int, default=0)
    a.add_argument('--no-pretrained', action='store_true'); a.add_argument('--seed', type=int, default=42)
    a.add_argument('--out', default='runs/oil_unet')
    args = a.parse_args()

    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    os.makedirs(args.out, exist_ok=True)
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    print('device:', dev, torch.cuda.get_device_name(0) if dev == 'cuda' else '(no GPU found: training will be very slow)')

    items = pairs(args.train_img, args.train_mask)
    random.Random(args.seed).shuffle(items)
    if args.limit: items = items[:args.limit]
    nval = max(1, int(len(items) * args.val_frac))
    val_items, tr_items = items[:nval], items[nval:]
    print(f'train {len(tr_items)}  val {len(val_items)}')
    mk = lambda it, tr, sh: DataLoader(SegSet(it, args.size, args.oil_id, tr), batch_size=args.batch,
                                       shuffle=sh, num_workers=args.workers, pin_memory=(dev == 'cuda'))
    tr_dl, va_dl = mk(tr_items, True, True), mk(val_items, False, False)

    model = smp.Unet('resnet34', encoder_weights=None if args.no_pretrained else 'imagenet',
                     in_channels=3, classes=1).to(dev)
    dice, bce = smp.losses.DiceLoss('binary', from_logits=True), torch.nn.BCEWithLogitsLoss()
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs))
    scaler = torch.cuda.amp.GradScaler(enabled=(dev == 'cuda'))

    best, bad, hist = -1.0, 0, []
    for ep in range(1, args.epochs + 1):
        t0 = time.time(); model.train(); tot = 0.0
        for x, y in tr_dl:
            x, y = x.to(dev), y.to(dev)
            with torch.autocast(device_type=dev, enabled=(dev == 'cuda')):
                logits = model(x)
            loss = bce(logits.float(), y) + dice(logits.float(), y)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
            tot += loss.item() * x.size(0)
        sched.step()
        iou, dsc = evaluate(model, va_dl, dev)
        hist.append({'epoch': ep, 'loss': tot / len(tr_items), 'val_iou': iou, 'val_dice': dsc})
        print(f'epoch {ep:3d}/{args.epochs}  loss {tot/len(tr_items):.4f}  val IoU {iou:.4f}  Dice {dsc:.4f}  {time.time()-t0:.0f}s', flush=True)
        json.dump(hist, open(os.path.join(args.out, 'history.json'), 'w'), indent=1)
        if iou > best:
            best, bad = iou, 0
            torch.save(model.state_dict(), os.path.join(args.out, 'best.pt'))
        else:
            bad += 1
            if bad >= args.patience:
                print('early stop (no validation improvement)'); break

    model.load_state_dict(torch.load(os.path.join(args.out, 'best.pt'), map_location=dev))
    if args.test_img and args.test_mask:
        te = pairs(args.test_img, args.test_mask)
        if args.limit: te = te[:args.limit]
        iou, dsc = evaluate(model, mk(te, False, False), dev); n, kind = len(te), 'held-out test set'
    else:
        iou, dsc = evaluate(model, va_dl, dev); n, kind = len(val_items), 'validation split (NOT held-out)'
    res = {'model': 'U-Net (ResNet34 encoder)', 'iou': round(iou, 4), 'dice': round(dsc, 4), 'n_test': n,
           'evaluated_on': kind, 'img_size': args.size, 'epochs_run': len(hist),
           'note': 'binary oil vs rest, pooled pixels, threshold 0.5'}
    json.dump(res, open(os.path.join(args.out, 'metrics.json'), 'w'), indent=1)
    print('FINAL', res)


if __name__ == '__main__':
    main()
