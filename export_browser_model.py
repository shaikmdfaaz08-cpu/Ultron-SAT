#!/usr/bin/env python3
"""Export the existing trained SAR U-Net to ONNX for browser-side inference."""
import os
from pathlib import Path
import torch
import segmentation_models_pytorch as smp

root=Path(__file__).resolve().parent
checkpoint=root/"runs/oil_unet_full/best.pt"
out=root/"site-dist/models/oil_sar_unet.onnx"
if not checkpoint.is_file():
    raise SystemExit("Trained SAR checkpoint missing. Never publish a fake model.")
out.parent.mkdir(parents=True,exist_ok=True)
try:
    obj=torch.load(checkpoint,map_location="cpu",weights_only=True)
except Exception as exc:
    raise SystemExit("Checkpoint cannot be safely loaded: "+str(exc))
if isinstance(obj,torch.nn.Module):
    model=obj
else:
    model=smp.Unet(encoder_name="resnet34",encoder_weights=None,in_channels=3,classes=1)
    state=obj
    if isinstance(obj,dict):
        for key in ("model_state_dict","state_dict","model","net"):
            if isinstance(obj.get(key),dict):
                state=obj[key];break
    state={(k[7:] if k.startswith("module.") else k):v for k,v in state.items()}
    model.load_state_dict(state,strict=True)
model.eval().cpu()
torch.set_num_threads(2)
example=torch.zeros(1,3,256,256,dtype=torch.float32)
with torch.no_grad():
    torch.onnx.export(model,example,str(out),opset_version=17,
                      input_names=["image"],output_names=["logits"],
                      do_constant_folding=True)
print(f"Exported ONNX model: {out.stat().st_size/1e6:.1f}MB")
if out.stat().st_size>98*1024*1024:
    raise SystemExit("ONNX model too large for reliable GitHub Pages; reduce safely or host the original separately.")
# Check ONNX output matches original trained model.
import onnxruntime as ort
import numpy as np
np.random.seed(2026)
test=np.random.randn(1,3,256,256).astype(np.float32)*0.2
with torch.no_grad():
    reference=model(torch.from_numpy(test)).numpy()
session=ort.InferenceSession(str(out),providers=["CPUExecutionProvider"])
prediction=session.run(None,{"image":test})[0]
diff=float(np.max(np.abs(reference-prediction)))
print("ONNX agreement (max absolute logits difference):",diff)
if not np.isfinite(diff) or diff>0.02:
    raise SystemExit("ONNX output failed PyTorch agreement validation")
