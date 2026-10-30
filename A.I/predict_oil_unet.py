
import argparse
from pathlib import Path

import cv2
import numpy as np
import torch
import albumentations as A
from albumentations.pytorch import ToTensorV2
import segmentation_models_pytorch as smp


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument(
        "--checkpoint",
        default="runs/oil_unet_full/best.pt",
        help="Trained model checkpoint",
    )
    parser.add_argument(
        "--out",
        default="runs/predicted_oil_mask.png",
        help="Output mask path",
    )
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()

    image_path = Path(args.image)
    checkpoint_path = Path(args.checkpoint)
    output_path = Path(args.out)

    if not image_path.is_file():
        raise FileNotFoundError(f"Input image not found: {image_path}")
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    device = torch.device("cpu")

    model = smp.Unet(
        encoder_name="resnet34",
        encoder_weights=None,
        in_channels=3,
        classes=1,
    ).to(device)

    state = torch.load(checkpoint_path, map_location=device, weights_only=True)
    model.load_state_dict(state)
    model.eval()

    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Could not read image: {image_path}")

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    transform = A.Compose([
        A.Resize(256, 256),
        A.Normalize(
            mean=(0.485, 0.456, 0.406),
            std=(0.229, 0.224, 0.225),
        ),
        ToTensorV2(),
    ])

    tensor = transform(image=image)["image"].unsqueeze(0).to(device)

    with torch.no_grad():
        probabilities = torch.sigmoid(model(tensor))[0, 0].cpu().numpy()

    binary = (probabilities >= args.threshold).astype(np.uint8) * 255

    # Resize the predicted mask back to the original image dimensions.
    binary = cv2.resize(
        binary,
        (image.shape[1], image.shape[0]),
        interpolation=cv2.INTER_NEAREST,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), binary):
        raise RuntimeError(f"Could not save prediction: {output_path}")

    oil_pixels = int(np.count_nonzero(binary))
    total_pixels = int(binary.size)
    print(f"Prediction saved: {output_path}")
    print(f"Predicted positive pixels: {oil_pixels}/{total_pixels}")
    print(f"Predicted positive area: {100 * oil_pixels / total_pixels:.2f}%")
    print("Note: positive pixels are model predictions, not confirmed oil.")


if __name__ == "__main__":
    main()
