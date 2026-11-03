"""Optional six-class LADOS RGB payload for ArduCAM/aerial photos.

Separate from the existing binary SAR model. Set ULTRON_RGB_CKPT to the
fine-tuned state_dict path (default: runs/oil_rgb_v3/best_rgb_model.pt).
The UI is always available; /rgb/analyze returns 503 until weights are installed.
"""
from __future__ import annotations

import base64
import io
import os
import threading
from pathlib import Path

import numpy as np
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from PIL import Image, ImageOps

router = APIRouter()
ROOT = Path(__file__).resolve().parent.parent
RGB_CKPT = Path(os.environ.get("ULTRON_RGB_CKPT", str(ROOT / "runs/oil_rgb_v3/best_rgb_model.pt")))
CLASSES = ("background", "emulsion", "oil", "oil-platform", "sheen", "ship")
COLORS = ((0, 0, 0), (255, 165, 0), (255, 63, 68), (145, 89, 195), (255, 226, 74), (52, 179, 255))
MEAN = np.array((0.485, 0.456, 0.406), dtype=np.float32)
STD = np.array((0.229, 0.224, 0.225), dtype=np.float32)
_lock = threading.Lock()
_model = None
_load_error = None

def _model_or_error():
    global _model, _load_error
    with _lock:
        if _model is not None:
            return _model, None
        if not RGB_CKPT.is_file():
            return None, "RGB checkpoint not installed on this server"
        try:
            import torch
            import segmentation_models_pytorch as smp
            torch.set_num_threads(max(1, min(2, os.cpu_count() or 1)))
            model = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=6)
            weights = torch.load(RGB_CKPT, map_location="cpu", weights_only=True)
            model.load_state_dict(weights, strict=True)
            _model = model.eval().to("cpu")
            _load_error = None
        except Exception as exc:
            _load_error = f"RGB checkpoint load failed: {exc}"
        return _model, _load_error

def _png_b64(image):
    b = io.BytesIO()
    image.save(b, format="PNG")
    return base64.b64encode(b.getvalue()).decode("ascii")

@router.get("/rgb/health")
def rgb_health():
    return {"checkpoint_present": RGB_CKPT.is_file(),
            "model_loaded": _model is not None,
            "classes": CLASSES,
            "checkpoint": str(RGB_CKPT),
            "note": "RGB model is separate from SAR inference and requires its own weights."}

@router.post("/rgb/analyze")
def rgb_analyze(file: UploadFile = File(...)):
    data = file.file.read(15 * 1024 * 1024 + 1)
    if not data or len(data) > 15 * 1024 * 1024:
        return JSONResponse({"error": "Upload a nonempty image smaller than 15 MB"}, status_code=413)
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.format not in ("JPEG", "PNG", "TIFF"):
                raise ValueError("Only JPG, PNG or TIFF are supported.")
            w, h = im.size
            if min(w, h) < 16 or w*h > 36000000:
                raise ValueError("Image dimensions outside supported limits.")
            original = ImageOps.exif_transpose(im).convert("RGB")
            rgb = np.asarray(original.resize((256, 256), Image.Resampling.BILINEAR))
    except Exception as exc:
        return JSONResponse({"error": f"Invalid image: {exc}"}, status_code=400)
    model, error = _model_or_error()
    if model is None:
        return JSONResponse({"error": error or "RGB model unavailable", "help": "Install ULTRON_RGB_CKPT on Render."}, status_code=503)
    try:
        import torch
        x = (rgb.astype(np.float32) / 255.0 - MEAN) / STD
        tensor = torch.from_numpy(np.ascontiguousarray(x.transpose(2, 0, 1))).unsqueeze(0)
        with _lock, torch.inference_mode():
            pred = model(tensor).argmax(1)[0].numpy().astype(np.uint8)
        mask = Image.fromarray(pred, mode="L").resize((w, h), Image.Resampling.NEAREST)
        palette = np.asarray(COLORS, dtype=np.uint8)
        colored = Image.fromarray(palette[np.asarray(mask)], mode="RGB")
        over = Image.blend(original, colored, 0.4)
        counts = np.bincount(np.asarray(mask).ravel(), minlength=6)
        return {"filename": Path(file.filename or "photo").name[:150],
                "width": w, "height": h,
                "classes": [{"name": c, "pixel_fraction": round(float(counts[i]) / (w*h), 6)} for i, c in enumerate(CLASSES)],
                "overlay_png_b64": _png_b64(over),
                "mask_png_b64": _png_b64(colored),
                "caution": "Experimental color-photograph segmentation, not proof of a real oil spill. Not validated on ArduCAM images."}
    except Exception as exc:
        return JSONResponse({"error": f"Inference failed: {exc}"}, status_code=500)

@router.get("/rgb", response_class=HTMLResponse)
def rgb_page():
    return """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ULTRON SAT — RGB Payload</title>
<style>body{font:16px system-ui;background:#071421;color:#e8f4ff;max-width:950px;margin:32px auto;padding:18px}a{color:#72daff}.panel{background:#102b3c;padding:24px;border-radius:16px;margin:15px 0}button{background:#1d98b0;border:0;padding:12px 20px;border-radius:9px;color:white;cursor:pointer}img{max-width:100%;border-radius:9px}input{max-width:100%}#results{white-space:pre-wrap}</style></head><body>
<a href="/">← Mission Control</a><h1>ULTRON SAT / RGB Camera Payload</h1><p>Color photograph segmentation: emulsion, oil, oil-platform, sheen, ship, background. Separate from the SAR model.</p>
<div class="panel"><label>Camera JPEG / PNG / TIFF <input id="file" type="file" accept="image/jpeg,image/png,image/tiff"></label> <button id="go">Analyze camera image</button><p id="status"></p></div>
<div class="panel"><h2>Detection overlay</h2><img id="overlay" alt="Result will appear here"><div id="results"></div></div><p>Experimental model. Results require human verification; camera domain performance has not been measured.</p>
<script>document.getElementById('go').onclick=async()=>{const f=document.getElementById('file').files[0],s=document.getElementById('status'),r=document.getElementById('results'),img=document.getElementById('overlay');if(!f){s.textContent='Choose an image first';return} s.textContent='Analyzing...';r.textContent='';img.removeAttribute('src');const fd=new FormData();fd.append('file',f);try{const response=await fetch('/rgb/analyze',{method:'POST',body:fd});const d=await response.json();if(!response.ok)throw Error(d.error||'Analysis failed');img.src='data:image/png;base64,'+d.overlay_png_b64;r.textContent=d.classes.map(x=>x.name+': '+(x.pixel_fraction*100).toFixed(2)+'%').join('\\n')+'\\n\\n'+d.caution;s.textContent='Analysis completed'}catch(e){s.textContent='Error: '+e.message}};</script></body></html>"""
