
#!/usr/bin/env python3
"""Run the trained model on one image or a folder and export files for the Ultron Sat dashboard.

  python infer_export.py --weights runs/oil_unet/best.pt --image test_image.jpg ^
      --km-per-pixel 0.01 --metrics runs/oil_unet/metrics.json --out export

For each image it writes:  NAME_image.png, NAME_mask.png (white = oil), NAME_overlay.png, NAME_results.json
In the dashboard upload NAME_image.png (Your image), NAME_mask.png (Model mask) and NAME_results.json.
--km-per-pixel is the ground size of ONE ORIGINAL image pixel in km (Sentinel-1 is about 0.01 km = 10 m;
check your dataset documentation, the images may have been resampled).
"""
import argparse, glob, json, os
import cv2, numpy as np, torch
import segmentation_models_pytorch as smp

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--weights', required=True); a.add_argument('--image', required=True)
    a.add_argument('--size', type=int, default=512); a.add_argument('--km-per-pixel', type=float, required=True)
    a.add_argument('--metrics'); a.add_argument('--out', default='export')
    args = a.parse_args()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = smp.Unet('resnet34', encoder_weights=None, in_channels=3, classes=1).to(dev)
    model.load_state_dict(torch.load(args.weights, map_location=dev)); model.eval()
    met = json.load(open(args.metrics)) if args.metrics else {}
    paths = sorted(glob.glob(os.path.join(args.image, '*'))) if os.path.isdir(args.image) else [args.image]
    os.makedirs(args.out, exist_ok=True)
    for p in paths:
        bgr = cv2.imread(p, cv2.IMREAD_COLOR)
        if bgr is None: continue
        h, w = bgr.shape[:2]
        x = cv2.resize(bgr[:, :, ::-1], (args.size, args.size), interpolation=cv2.INTER_AREA)
        x = torch.from_numpy(((x.astype(np.float32) / 255. - MEAN) / STD).transpose(2, 0, 1)).unsqueeze(0).to(dev)
        with torch.no_grad():
            prob = torch.sigmoid(model(x))[0, 0].cpu().numpy()
        prob = cv2.resize(prob, (w, h), interpolation=cv2.INTER_LINEAR)
        mask = (prob > .5).astype(np.uint8)
        px = int(mask.sum()); name = os.path.splitext(os.path.basename(p))[0]
        k = min(640 / w, 400 / h)            # the dashboard letterboxes images into 640 x 400
        ov = bgr.copy(); ov[mask > 0] = (0.5 * ov[mask > 0] + 0.5 * np.array([255, 208, 56])).astype(np.uint8)
        cv2.imwrite(os.path.join(args.out, name + '_image.png'), bgr)
        cv2.imwrite(os.path.join(args.out, name + '_mask.png'), mask * 255)
        cv2.imwrite(os.path.join(args.out, name + '_overlay.png'), ov)
        res = {'model': met.get('model', 'U-Net (ResNet34 encoder)'), 'iou': met.get('iou'), 'dice': met.get('dice'),
               'n_test': met.get('n_test'), 'image': name + '_image.png', 'mask': name + '_mask.png',
               'oil_pixels': px, 'area_km2': round(px * args.km_per_pixel ** 2, 2),
               'km_per_pixel': args.km_per_pixel / k,          # per displayed pixel, used by the dashboard
               'km_per_pixel_original': args.km_per_pixel,
               'mean_oil_probability': round(float(prob[mask > 0].mean()), 3) if px else 0.0}
        json.dump(res, open(os.path.join(args.out, name + '_results.json'), 'w'), indent=1)
        print(name, 'oil pixels', px, 'area km2', res['area_km2'])


if __name__ == '__main__':
    main()
