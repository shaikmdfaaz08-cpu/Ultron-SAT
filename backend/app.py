"""
ULTRON SAT - local oil-spill segmentation API.

Loads the trained U-Net (ResNet34 encoder, segmentation_models_pytorch) ONCE at startup,
runs CPU inference on uploaded images, and returns a binary mask at the ORIGINAL image size.
Nothing is sent to any external service. If the model cannot run, the API says so - it never
falls back to brightness thresholding.

Run (from the project root, venv active):
    python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import base64
import io
import os
import logging
import threading
import time
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, RedirectResponse
from PIL import Image, ImageOps
from scipy import ndimage as ndi

# --------------------------------------------------------------------------- config
ROOT = Path(__file__).resolve().parent.parent
CKPT_PATH = Path(os.environ.get("ULTRON_CKPT", ROOT / "runs" / "oil_unet_full" / "best.pt"))
WEB_DIR = ROOT / "web"
DASHBOARD = WEB_DIR / os.environ.get("ULTRON_DASHBOARD", "Ultron Sat Dashboard.html")
if not DASHBOARD.is_file():
    _found = sorted(WEB_DIR.glob("*.html"))
    if _found:
        DASHBOARD = _found[0]

INPUT_SIZE = 256                                   # training resize
MEAN = np.array([0.485, 0.456, 0.406], np.float32)  # ImageNet normalisation (as in training)
STD = np.array([0.229, 0.224, 0.225], np.float32)
# How the 256x256 resize is done must match training/predict_oil_unet.py.
# "pil" = Pillow bilinear (default). Set ULTRON_RESIZE=cv2 if your script uses cv2.INTER_LINEAR.
RESIZE_BACKEND = os.environ.get("ULTRON_RESIZE", "cv2_area").lower()

MAX_UPLOAD_BYTES = int(os.environ.get("ULTRON_MAX_MB", "50")) * 1024 * 1024
MAX_PIXELS = int(os.environ.get("ULTRON_MAX_PIXELS", "36000000"))  # ~6000 x 6000 locally
MIN_SIDE = 16
ALLOWED_FORMATS = {"JPEG", "PNG", "TIFF"}
CACHE_SIZE = 8
API_VERSION = "1.0"

Image.MAX_IMAGE_PIXELS = MAX_PIXELS * 2            # Pillow decompression-bomb guard


# --------------------------------------------------------------------------- errors
class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


# --------------------------------------------------------------------------- model
class ModelState:
    model = None
    torch = None
    error: str | None = None
    device = "cpu"
    info: dict = {}
    lock = threading.Lock()


STATE = ModelState()
MODEL_INIT_DONE = threading.Event()
LOGGER = logging.getLogger('ultron.models')


def _torch_load(torch, path: Path):
    last = None
    for kw in ({"weights_only": True}, {"weights_only": False}, {}):
        try:
            return torch.load(path, map_location="cpu", **kw)
        except TypeError:          # older torch without weights_only
            continue
        except Exception as e:     # e.g. weights_only refuses a pickled dict -> try next
            last = e
    raise RuntimeError(f"torch.load failed: {last}")


def load_model() -> None:
    try:
        import torch
        import segmentation_models_pytorch as smp
    except Exception as e:
        STATE.error = f"Could not import torch / segmentation_models_pytorch: {e}"
        LOGGER.error("SAR model import failure: %s", STATE.error, exc_info=True)
        return
    if not CKPT_PATH.is_file():
        STATE.error = f"Checkpoint not found: {CKPT_PATH}"
        LOGGER.error("SAR model missing checkpoint: %s", CKPT_PATH)
        return
    try:
        torch.set_num_threads(int(os.environ.get("ULTRON_THREADS", max(1, min(4, os.cpu_count() or 1)))))
        ckpt = _torch_load(torch, CKPT_PATH)
        if isinstance(ckpt, torch.nn.Module):                      # fully pickled model
            model = ckpt
        else:
            model = smp.Unet(encoder_name="resnet34", encoder_weights=None,
                             in_channels=3, classes=1)
            sd = ckpt
            if isinstance(ckpt, dict):
                for key in ("model_state_dict", "state_dict", "model", "net"):
                    if isinstance(ckpt.get(key), dict):
                        sd = ckpt[key]
                        break
            sd = {(k[7:] if k.startswith("module.") else k): v for k, v in sd.items()}
            model.load_state_dict(sd, strict=True)
        model.eval().to("cpu")
        st = CKPT_PATH.stat()
        STATE.model, STATE.torch, STATE.error = model, torch, None
        LOGGER.warning("SAR checkpoint loaded: %s", CKPT_PATH)
        STATE.info = {
            "name": "U-Net / ResNet34 oil-spill segmenter",
            "architecture": "U-Net",
            "encoder": "ResNet34",
            "library": f"segmentation_models_pytorch, torch {torch.__version__}",
            "checkpoint": str(CKPT_PATH.relative_to(ROOT)) if CKPT_PATH.is_relative_to(ROOT) else str(CKPT_PATH),
            "checkpoint_size_mb": round(st.st_size / 1e6, 1),
            "checkpoint_modified": time.strftime("%Y-%m-%d %H:%M", time.localtime(st.st_mtime)),
            "input_size": INPUT_SIZE,
            "device": STATE.device,
            "resize_backend": RESIZE_BACKEND,
        }
    except Exception as e:
        STATE.model = None
        STATE.error = f"Failed to load checkpoint {CKPT_PATH.name}: {e}"
        LOGGER.exception("SAR checkpoint load FAILED: %s", STATE.error)


def predict_probability(rgb: np.ndarray) -> np.ndarray:
    """rgb: HxWx3 uint8 -> 256x256 float32 sigmoid probability map (same preprocessing as training)."""
    torch = STATE.torch
    if RESIZE_BACKEND in ("cv2_area", "cv2"):
        import cv2
        # Match A.I/train_oil_unet.py / SegSet exactly (production checkpoint).
        small = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)
    elif RESIZE_BACKEND == "cv2_linear":
        import cv2
        small = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    else:
        small = np.asarray(Image.fromarray(rgb).resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR))
    x = (small.astype(np.float32) / 255.0 - MEAN) / STD
    t = torch.from_numpy(np.ascontiguousarray(x.transpose(2, 0, 1))).unsqueeze(0)
    with STATE.lock, torch.no_grad():
        logits = STATE.model(t)
        prob = torch.sigmoid(logits)[0, 0].cpu().numpy().astype(np.float32)
    return prob


# --------------------------------------------------------------------------- image decoding
def decode_image(data: bytes) -> tuple[np.ndarray, str, list[str]]:
    """Validate and decode to HxWx3 uint8 RGB. Returns (rgb, source_format, warnings)."""
    warnings: list[str] = []
    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        if fmt not in ALLOWED_FORMATS:
            raise ApiError(415, "unsupported_format",
                           f"Unsupported image format '{fmt}'. Use JPG, PNG or TIFF.")
        w, h = img.size
        if min(w, h) < MIN_SIDE:
            raise ApiError(400, "image_too_small", f"Image is {w}x{h}px; minimum side is {MIN_SIDE}px.")
        if w * h > MAX_PIXELS:
            raise ApiError(413, "image_too_large",
                           f"Image is {w}x{h}px ({w*h/1e6:.0f} MP); the limit is {MAX_PIXELS/1e6:.0f} MP.")
        img.load()
    except ApiError:
        raise
    except Exception as e:
        raise ApiError(400, "invalid_image", f"Could not read the file as an image: {e}")

    img = ImageOps.exif_transpose(img)
    if img.mode in ("I;16", "I;16B", "I;16L", "I", "F"):
        a = np.asarray(img).astype(np.float32)
        lo, hi = np.percentile(a, [1, 99])
        if hi <= lo:
            hi = lo + 1.0
        a8 = (np.clip((a - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)
        rgb = np.stack([a8] * 3, axis=-1)
        warnings.append("Image was not 8-bit; it was rescaled with a 1-99 percentile stretch. "
                        "Results may differ from 8-bit training tiles.")
    else:
        if img.mode in ("L", "LA"):
            warnings.append("Single-channel image was replicated to 3 channels. Training tiles were "
                            "RGB SAR-derived composites, so channel meaning may not match.")
        rgb = np.asarray(img.convert("RGB"))
    return np.ascontiguousarray(rgb), fmt, warnings


# --------------------------------------------------------------------------- post-processing
def build_mask(prob256: np.ndarray, width: int, height: int, threshold: float, min_region_px: int):
    """Upsample the PROBABILITY map (bilinear, float) to original size, THEN threshold.

    Thresholding after upsampling gives a clean binary mask with smooth edges; resizing an
    already-binary mask with bilinear interpolation would create in-between values.
    """
    prob_full = np.asarray(Image.fromarray(prob256).resize((width, height), Image.BILINEAR))
    mask = prob_full >= threshold

    labels, n = ndi.label(mask, structure=np.ones((3, 3), bool))   # 8-connectivity
    regions = []
    region_count = 0
    if n:
        sizes = np.bincount(labels.ravel(), minlength=n + 1)
        keep = sizes >= max(1, int(min_region_px))
        keep[0] = False
        mask = keep[labels]
        kept_ids = np.nonzero(keep)[0]
        region_count = int(kept_ids.size)
        slices = ndi.find_objects(labels)
        order = kept_ids[np.argsort(sizes[kept_ids])[::-1]][:50]
        total = width * height
        for rank, lid in enumerate(order, 1):
            sl = slices[lid - 1]
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            regions.append({"id": rank, "pixels": int(sizes[lid]), "fraction": float(sizes[lid] / total),
                            "bbox": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]})
    return prob_full, mask, regions, region_count


def png_b64(arr: np.ndarray, mode: str = "L") -> str:
    buf = io.BytesIO()
    Image.fromarray(arr, mode).save(buf, format="PNG", compress_level=6)
    return base64.b64encode(buf.getvalue()).decode()


CACHE: "OrderedDict[str, dict]" = OrderedDict()
CACHE_LOCK = threading.Lock()


def build_result(entry: dict, threshold: float, min_region_px: int, min_detect_percent: float,
                 input_type: str, include_images: bool) -> dict:
    t0 = time.perf_counter()
    W, H = entry["width"], entry["height"]
    prob_full, mask, regions, region_count = build_mask(entry["prob"], W, H, threshold, min_region_px)
    flagged = int(mask.sum())
    frac = flagged / float(W * H)
    detected = flagged > 0 and frac * 100.0 >= min_detect_percent
    warnings = list(entry["warnings"])
    domain_trusted = input_type == "sar_rgb"
    if not domain_trusted:
        warnings.insert(0, "Input was declared as NOT SAR-derived RGB. The model was trained only on "
                           "Sentinel-1 SAR-derived tiles; output on other imagery is unreliable and must "
                           "not be interpreted as oil detection.")
    if frac > 0.5:
        warnings.append("More than half of the image is flagged. This often indicates out-of-domain "
                        "input or a threshold that is too low.")
    if frac * 100.0 < min_detect_percent and flagged > 0:
        warnings.append("Flagged pixels exist but are below the minimum detected-pixel proportion.")
    res = {
        "analysis_id": entry["id"],
        "filename": entry["filename"],
        "source_format": entry["format"],
        "width": W, "height": H,
        "model": STATE.info,
        "threshold": threshold,
        "min_region_px": int(min_region_px),
        "min_detect_percent": min_detect_percent,
        "inference_ms": entry["inference_ms"],
        "postprocess_ms": None,
        "flagged_pixels": flagged,
        "flagged_fraction": frac,
        "status": "detected" if detected else "not_detected",
        "domain": {"declared": input_type, "trusted": domain_trusted},
        "region_count": region_count,
        "regions": regions,
        "mean_prob_flagged": float(prob_full[mask].mean()) if flagged else None,
        "max_prob": float(prob_full.max()),
        "warnings": warnings,
        "notes": {
            "inference_ms": "Preprocessing + U-Net forward pass on CPU (excludes upload and post-processing).",
            "mean_prob_flagged": "Mean sigmoid output over flagged pixels. An uncalibrated per-pixel model "
                                 "score - NOT the probability that a real oil spill exists.",
            "pixels": "Model-predicted potential oil pixels, not confirmed oil. Pixel share is not a "
                      "real-world area without spatial calibration.",
        },
    }
    if include_images:
        res["mask_png_b64"] = png_b64((mask.astype(np.uint8) * 255))
        if entry["format"] == "TIFF" and entry.get("preview"):
            res["preview_png_b64"] = entry["preview"]
    res["postprocess_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return res


# --------------------------------------------------------------------------- app
def _initialize_sar_model():
    try:
        load_model()
    finally:
        MODEL_INIT_DONE.set()


@asynccontextmanager
async def lifespan(_: FastAPI):
    MODEL_INIT_DONE.clear()
    if os.environ.get("ULTRON_DASHBOARD_ONLY", "0") == "1":
        # Keep the existing mission-control page, USB telemetry, and 3D visuals
        # online on Render Free without importing/loading torch at startup.
        STATE.error = "Cloud AI inference is temporarily disabled to protect dashboard availability. CubeSat USB telemetry and simulations remain available."
        MODEL_INIT_DONE.set()
        LOGGER.warning("Dashboard-only mode: SAR model disabled to avoid Render Free out-of-memory restarts")
    else:
        threading.Thread(target=_initialize_sar_model, daemon=True).start()
    yield


app = FastAPI(title="ULTRON SAT local API", version=API_VERSION, lifespan=lifespan)

# Optional six-class color camera payload; does not replace SAR inference.
from backend.rgb_payload import router as rgb_router
app.include_router(rgb_router)
app.add_middleware(
    CORSMiddleware,
    # Only needed if the dashboard is opened as a file:// page (origin "null") or from another local port.
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000", "null",
                   "https://shaikmdfaaz08-cpu.github.io"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def _api_error(_, e: ApiError):
    return JSONResponse({"error": {"code": e.code, "message": e.message}}, status_code=e.status)


@app.exception_handler(RequestValidationError)
async def _validation_error(_, e: RequestValidationError):
    msg = "; ".join(f"{'.'.join(str(p) for p in x['loc'][1:])}: {x['msg']}" for x in e.errors())
    return JSONResponse({"error": {"code": "bad_request", "message": f"Invalid request - {msg}"}}, status_code=422)


@app.exception_handler(Exception)
async def _unhandled(_, e: Exception):
    return JSONResponse({"error": {"code": "internal_error", "message": f"Unexpected server error: {e}"}},
                        status_code=500)


def _check_params(threshold: float, min_region_px: int, min_detect_percent: float, input_type: str):
    if not 0.0 <= threshold <= 1.0:
        raise ApiError(400, "bad_threshold", "threshold must be between 0 and 1.")
    if min_region_px < 0:
        raise ApiError(400, "bad_min_region", "min_region_px must be >= 0.")
    if not 0.0 <= min_detect_percent <= 100.0:
        raise ApiError(400, "bad_min_detect", "min_detect_percent must be between 0 and 100.")
    if input_type not in ("sar_rgb", "other"):
        raise ApiError(400, "bad_input_type", "input_type must be 'sar_rgb' or 'other'.")


def _require_model():
    if os.environ.get("ULTRON_DASHBOARD_ONLY", "0") == "1":
        raise ApiError(503, "ai_temporarily_disabled",
                       "Cloud AI analysis is temporarily disabled to keep the dashboard available on Render Free. ESP32 USB telemetry still works.")
    # The model starts in a background thread. A request during cold startup
    # must not fail immediately while the checkpoint is still initializing.
    if STATE.model is None and not MODEL_INIT_DONE.is_set():
        MODEL_INIT_DONE.wait(timeout=75)
    if STATE.model is None:
        if not MODEL_INIT_DONE.is_set():
            raise ApiError(503, "model_initializing",
                           "SAR model is still initializing. Retry shortly.")
        raise ApiError(503, "model_unavailable",
                       STATE.error or "SAR model initialization failed.")


@app.get("/health")
def health():
    return {"status": "ok", "api_version": API_VERSION, "model_loaded": STATE.model is not None,
            "model_loading": not MODEL_INIT_DONE.is_set(),
            "error": STATE.error, "model": STATE.info, "device": STATE.device,
            "limits": {"max_upload_mb": MAX_UPLOAD_BYTES // (1024 * 1024), "max_megapixels": MAX_PIXELS // 1_000_000}}


@app.post("/analyze")
def analyze(file: UploadFile = File(...),
            threshold: float = Form(0.5),
            min_region_px: int = Form(0),
            min_detect_percent: float = Form(0.1),
            input_type: str = Form("sar_rgb"),
            include_images: bool = Form(True)):
    _check_params(threshold, min_region_px, min_detect_percent, input_type)
    _require_model()
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise ApiError(400, "empty_file", "The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError(413, "file_too_large", f"File exceeds {MAX_UPLOAD_BYTES // (1024*1024)} MB.")

    rgb, fmt, warnings = decode_image(data)
    H, W = rgb.shape[:2]
    if float(rgb.std()) < 2.0:
        warnings.append("Image has almost no contrast; a meaningful detection is unlikely.")
    if min(W, H) < 128:
        warnings.append("Image is much smaller than the 256x256 model input and was upscaled.")

    t0 = time.perf_counter()
    try:
        prob = predict_probability(rgb)
    except Exception as e:
        raise ApiError(500, "inference_failed", f"Model inference failed: {e}")
    inference_ms = round((time.perf_counter() - t0) * 1000, 1)

    preview = None
    if fmt == "TIFF":   # browsers cannot display TIFF; send a PNG preview of what the model saw
        buf = io.BytesIO(); Image.fromarray(rgb).save(buf, format="PNG")
        preview = base64.b64encode(buf.getvalue()).decode()

    entry = {"id": uuid.uuid4().hex, "filename": Path(file.filename or "image").name[:200],
             "format": fmt, "width": W, "height": H, "prob": prob, "warnings": warnings,
             "inference_ms": inference_ms, "preview": preview}
    with CACHE_LOCK:
        CACHE[entry["id"]] = entry
        while len(CACHE) > CACHE_SIZE:
            CACHE.popitem(last=False)
    return build_result(entry, threshold, min_region_px, min_detect_percent, input_type, include_images)


@app.post("/remask")
def remask(analysis_id: str = Form(...),
           threshold: float = Form(0.5),
           min_region_px: int = Form(0),
           min_detect_percent: float = Form(0.1),
           input_type: str = Form("sar_rgb"),
           include_images: bool = Form(True)):
    """Re-threshold a previous analysis without re-running the network."""
    _check_params(threshold, min_region_px, min_detect_percent, input_type)
    with CACHE_LOCK:
        entry = CACHE.get(analysis_id)
        if entry:
            CACHE.move_to_end(analysis_id)
    if entry is None:
        raise ApiError(404, "analysis_expired",
                       "That analysis is no longer on the server (server restarted or cache full). "
                       "Click 'Analyze Image' to run the model again.")
    return build_result(entry, threshold, min_region_px, min_detect_percent, input_type, include_images)


@app.get("/camera-samples")
def camera_samples():
    """Original optical camera test archive; separate from model training data."""
    path = WEB_DIR / "camera_test_archive.html"
    if not path.is_file():
        raise ApiError(404, "gallery_missing", "Camera archive was not deployed.")
    return FileResponse(path, media_type="text/html", headers={"Cache-Control": "no-store"})


@app.get("/ultron_esp32_telemetry.js")
def esp32_telemetry_script():
    path = WEB_DIR / "ultron_esp32_telemetry.js"
    if not path.is_file():
        raise ApiError(404, "telemetry_script_missing", "ESP32 telemetry script not installed.")
    return FileResponse(path, media_type="application/javascript",
                        headers={"Cache-Control": "no-store"})


@app.get("/ultron_runtime_patch.js")
def runtime_patch():
    path = WEB_DIR / "ultron_runtime_patch.js"
    if not path.is_file():
        raise ApiError(404, "patch_missing", "Dashboard UI patch not installed.")
    return FileResponse(path, media_type="application/javascript", headers={"Cache-Control": "no-store"})


@app.get("/")
def index():
    # The submitted Render URL stays constant while the RAM-free static site hosts Mission Control.
    if os.environ.get("ULTRON_DASHBOARD_ONLY", "0") == "1":
        return RedirectResponse("https://shaikmdfaaz08-cpu.github.io/Ultron-SAT/", status_code=302)
    if not DASHBOARD.is_file():
        raise ApiError(404, "dashboard_missing", f"Dashboard file not found: {DASHBOARD}")
    # Inject a small UI enhancement without copying the large dashboard into GitHub again.
    html = DASHBOARD.read_text(encoding="utf-8")
    tags = ('<script src="/ultron_runtime_patch.js" defer></script>'
            '<script src="/ultron_esp32_telemetry.js" defer></script>')
    if '/ultron_esp32_telemetry.js' not in html:
        html = html.replace("</body>", tags + "</body>")
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
