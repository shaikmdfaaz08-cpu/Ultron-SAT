"""ULTRON-SAT Render entrypoint — lightweight redirect only.

Keep the public Render hostname as an opener for the GitHub Pages site.
No trained models, sensor data, dashboards, or image processing run here.
For local AI inference use backend.legacy_ai_app:app instead.
The existing Render start command remains: uvicorn backend.app:app ...
"""
from __future__ import annotations

import json

GITHUB_PAGES = "https://shaikmdfaaz08-cpu.github.io/Ultron-SAT/"
HEALTH_BODY = json.dumps({
    "status": "ok",
    "mode": "redirect-only",
    "destination": GITHUB_PAGES,
}, separators=(",", ":")).encode("utf-8")


async def app(scope, receive, send):
    """Dependency-free ASGI redirect; uvicorn is the only required package."""
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
    if scope["type"] != "http":
        return

    if scope.get("path") == "/health":
        status = 200
        body = HEALTH_BODY
        headers = [
            (b"content-type", b"application/json; charset=utf-8"),
            (b"content-length", str(len(body)).encode("ascii")),
            (b"cache-control", b"no-store"),
        ]
    else:
        status = 302
        body = b""
        headers = [
            (b"location", GITHUB_PAGES.encode("ascii")),
            (b"content-length", b"0"),
            (b"cache-control", b"no-store"),
        ]

    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body",
                "body": b"" if scope.get("method") == "HEAD" else body})
