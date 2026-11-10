"""ULTRON-SAT Render entrypoint: retain the existing GitHub Pages redirect.

Optional low-rate public camera relay:
  POST /camera/push        (secret write-token in X-ULTRON-CAMERA-KEY)
  GET  /camera/frame.jpg   (last fresh frame, no public upload token)
  GET  /camera/status      (availability only; no private configuration)

Only ESP32-CAM JPEG frames are kept, in process memory, for at most 15 seconds.
This is opt-in tray-only broadcast for a public demo, not storage or AI inference.
"""
from __future__ import annotations

import hmac
import json
import os
import time

GITHUB_PAGES = "https://shaikmdfaaz08-cpu.github.io/Ultron-SAT/"
CAMERA_ORIGIN = "https://shaikmdfaaz08-cpu.github.io"
MAX_JPEG_BYTES = 160_000
STALE_AFTER_SECONDS = 15
MIN_UPLOAD_INTERVAL_SECONDS = 0.65
_CAMERA_KEY = os.environ.get("ULTRON_CAMERA_UPLOAD_TOKEN", "")
_frame: bytes | None = None
_last_frame_at = 0.0
_camera_seq = 0

def response_headers(content_type: str, body: bytes, cors: bool = False):
    out = [
        (b"content-type", content_type.encode("ascii")),
        (b"content-length", str(len(body)).encode("ascii")),
        (b"cache-control", b"no-store, max-age=0"),
        (b"x-content-type-options", b"nosniff"),
    ]
    if cors:
        out += [(b"access-control-allow-origin", CAMERA_ORIGIN.encode("ascii")),
                (b"vary", b"origin")]
    return out

async def respond(send, status: int, body: bytes = b"", content_type: str = "application/json", cors=False, head=False, extra=()):
    headers = response_headers(content_type, body, cors) + list(extra)
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": b"" if head else body})

def jdoc(**kw):
    return json.dumps(kw, separators=(",", ":")).encode("utf-8")

async def get_image_data(receive):
    data = bytearray()
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            return None
        if message["type"] != "http.request":
            return None
        chunk = message.get("body", b"")
        if len(data) + len(chunk) > MAX_JPEG_BYTES:
            return None
        data.extend(chunk)
        if not message.get("more_body", False):
            return bytes(data)

async def app(scope, receive, send):
    global _frame, _last_frame_at, _camera_seq
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
        return
    if scope["type"] != "http":
        return

    path = scope.get("path", "/")
    method = scope.get("method", "GET").upper()
    head = method == "HEAD"
    headers = {k.lower(): v for k, v in scope.get("headers", [])}
    if path == "/health":
        await respond(send, 200, jdoc(status="ok", mode="redirect-with-opt-in-camera-relay", destination=GITHUB_PAGES), head=head)
        return
    if path == "/camera/status" and method in ("GET", "HEAD"):
        age = time.monotonic() - _last_frame_at if _last_frame_at else None
        fresh = bool(_frame and age is not None and age <= STALE_AFTER_SECONDS)
        await respond(send, 200, jdoc(connected=fresh, age_seconds=round(age, 1) if age is not None and fresh else None, frame_id=_camera_seq if fresh else None, mode="tray-only-public-preview"), cors=True, head=head)
        return
    if path == "/camera/frame.jpg" and method in ("GET", "HEAD"):
        if _frame and time.monotonic() - _last_frame_at <= STALE_AFTER_SECONDS:
            await respond(send, 200, _frame, "image/jpeg", cors=True, head=head)
        else:
            await respond(send, 503, jdoc(error="Camera not transmitting a fresh frame"), cors=True, head=head)
        return
    if path == "/camera/push" and method == "POST":
        if not _CAMERA_KEY:
            await respond(send, 503, jdoc(error="Camera upload is not configured"))
            return
        given = headers.get(b"x-ultron-camera-key", b"")
        if not hmac.compare_digest(given, _CAMERA_KEY.encode("utf8")):
            await respond(send, 403, jdoc(error="Upload authorization failed"))
            return
        ctype = headers.get(b"content-type", b"").split(b";")[0].lower()
        if ctype != b"image/jpeg":
            await respond(send, 415, jdoc(error="Expected image/jpeg"))
            return
        length = headers.get(b"content-length", b"")
        if length:
            try:
                n = int(length)
            except ValueError:
                n = -1
            if n < 4 or n > MAX_JPEG_BYTES:
                await respond(send, 413, jdoc(error="JPEG too large or empty"))
                return
        if _last_frame_at and time.monotonic() - _last_frame_at < MIN_UPLOAD_INTERVAL_SECONDS:
            await respond(send, 429, jdoc(error="Too many frames"))
            return
        frame = await get_image_data(receive)
        if not frame or len(frame) < 4 or not frame.startswith(b"\xff\xd8") or not frame.endswith(b"\xff\xd9"):
            await respond(send, 400, jdoc(error="Invalid JPEG frame"))
            return
        _frame = frame
        _last_frame_at = time.monotonic()
        _camera_seq += 1
        await respond(send, 200, jdoc(status="accepted", frame_id=_camera_seq))
        return

    # All the original Render opener routes stay unchanged.
    await respond(send, 302, b"", "text/plain", head=head,
                  extra=((b"location", GITHUB_PAGES.encode("ascii")),))
