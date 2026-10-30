"""
ULTRON SAT - deploy fixes.

Put this file in the project root (the folder that contains BACKEND, WEB, RUNS),
then run:   python apply_fixes.py

It edits your files in place and saves a .bak copy of each one it changes.
Safe to run twice: anything already fixed is skipped.
"""
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def say(ok, msg):
    print(("[ok]   " if ok else "[skip] ") + msg)


# 1. Lowercase folder names (Render runs Linux, where case matters)
for name in ("BACKEND", "WEB", "RUNS"):
    if name in os.listdir(ROOT):
        os.rename(ROOT / name, ROOT / (name + "_tmp"))
        os.rename(ROOT / (name + "_tmp"), ROOT / name.lower())
        say(True, f"renamed folder {name} -> {name.lower()}")


def edit(path, pairs):
    if path is None or not path.is_file():
        say(False, f"file not found: {path}")
        return
    text = path.read_text(encoding="utf-8")
    shutil.copy(path, path.with_name(path.name + ".bak"))
    for label, pattern, repl in pairs:
        text, n = re.subn(pattern, lambda m: repl, text)
        say(n > 0, f"{path.name}: {label}" + ("" if n else " (already fixed or text not found)"))
    path.write_text(text, encoding="utf-8")


# 2. Dashboard HTML
web = ROOT / "web"
dash = web / "Ultron Sat Dashboard.html"
if not dash.is_file():
    found = sorted(web.glob("*.html")) if web.is_dir() else []
    dash = found[0] if found else None

edit(dash, [
    ("privacy text (2 places)",
     re.escape("It is only sent to the backend on your computer."),
     "The image is processed in memory on the analysis server and is not saved."),
    ("finish How to Use step 6",
     r"View the simulated satellite telemetry and use\s*</li>",
     "View the simulated satellite telemetry, or paste Tinkercad Serial Monitor "
     "lines and press Replay.\n    </li>"),
    ("wrap limitations list in a card",
     r"</div>\s*<ul>\s*<li>Highlighted pixels",
     '</div>\n<div class="card" style="--i:8"><h2>Limitations</h2>\n<ul>\n<li>Highlighted pixels'),
])

# 3. Backend
edit(ROOT / "backend" / "app.py", [
    ("dashboard filename",
     r'DASHBOARD = ROOT / "web" / "[^"]*"',
     'WEB_DIR = ROOT / "web"\n'
     'DASHBOARD = WEB_DIR / os.environ.get("ULTRON_DASHBOARD", "Ultron Sat Dashboard.html")\n'
     'if not DASHBOARD.is_file():\n'
     '    _found = sorted(WEB_DIR.glob("*.html"))\n'
     '    if _found:\n'
     '        DASHBOARD = _found[0]'),
    ("upload size limit from environment",
     r"MAX_UPLOAD_BYTES = 50 \* 1024 \* 1024",
     'MAX_UPLOAD_BYTES = int(os.environ.get("ULTRON_MAX_MB", "50")) * 1024 * 1024'),
    ("pixel limit from environment",
     r"MAX_PIXELS = 36_000_000[^\n]*",
     'MAX_PIXELS = int(os.environ.get("ULTRON_MAX_PIXELS", "36000000"))  # ~6000 x 6000 locally'),
    ("thread count from environment",
     r"torch\.set_num_threads\(max\(1, min\(4, os\.cpu_count\(\) or 1\)\)\)",
     'torch.set_num_threads(int(os.environ.get("ULTRON_THREADS", max(1, min(4, os.cpu_count() or 1)))))'),
    ("load model in the background",
     r'    load_model\(\)\n    print\(f"\[ULTRON SAT\][^\n]*\n',
     "    threading.Thread(target=load_model, daemon=True).start()\n"),
])

# 4. requirements.txt
(ROOT / "requirements.txt").write_text(
    "--extra-index-url https://download.pytorch.org/whl/cpu\n"
    "fastapi\nuvicorn\npython-multipart\npillow\nnumpy\nscipy\n"
    "torch\ntorchvision\nsegmentation-models-pytorch\n",
    encoding="utf-8")
say(True, "wrote requirements.txt")

print("\nDone. Next: check that backend/__init__.py exists, then push to GitHub.")
print("Delete the *.bak files before you push.")
