#!/usr/bin/env python3
"""Package the existing mission-control UI as a static site; no PyTorch server needed."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
web = root / "web"
out = root / "site-dist"
out.mkdir(exist_ok=True)
for path in web.rglob("*"):
    if not path.is_file():
        continue
    relative = path.relative_to(web)
    target = out / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)

source = web / "ULTRON_SAT_MISSION_CONTROL_V5_IOS_GLASS_DOCK.html"
if not source.is_file():
    raise SystemExit("Missing mission control dashboard; refusing to deploy an incomplete site.")
html = source.read_text(encoding="utf-8")
if "</body>" not in html.lower():
    raise SystemExit("Dashboard body closing tag missing; refusing to publish broken HTML.")
# Load each optional dashboard enhancement exactly once, in dependency order.
# This also avoids duplicate listeners and overlapping panels in older releases.
scripts = [
    "ultron_runtime_patch.js",
    "ultron_esp32_telemetry.js",
    "ultron_browser_oil_ai.js",
    "ultron_weather_drift.js",
    "ultron_inline_ai.js",
    "ultron_main_detection_bridge.js",
    "ultron_ai_button_fix.js",
    "ultron_ai_remote_bridge.js",
    "ultron_orbit_eps.js",
    "ultron_subsystem_activity.js",
    "static_cloud_notice.js",
]
missing = [name for name in scripts if f'{name}' not in html]
injection = "".join(f'<script src="{name}" defer></script>' for name in missing)
html = html.replace("</body>", injection + "</body>")
(out / "index.html").write_text(html, encoding="utf-8")
(out / ".nojekyll").write_text("", encoding="utf-8")
print(f"Static site ready, original dashboard {len(html):,} characters; copied web assets.")
