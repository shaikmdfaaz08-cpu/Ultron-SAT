@echo off
setlocal
title ULTRON SAT Mission Control
cd /d "%~dp0"
set "PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
 echo Run SETUP_ULTRON_SAT.bat first.
 pause
 exit /b 1
)
if not exist "backend\legacy_ai_app.py" (
 echo Missing backend\legacy_ai_app.py
 pause
 exit /b 1
)
if not exist "runs\oil_unet_full\best.pt" echo WARNING: Existing trained checkpoint not found.
set "ULTRON_DASHBOARD=Ultron_Sat_Mission_Control_ULTRA.html"
if not exist "web\%ULTRON_DASHBOARD%" (
 echo ULTRA dashboard not uploaded yet. Using existing dashboard.
 set "ULTRON_DASHBOARD=Ultron Sat Dashboard.html"
)
start "ULTRON SAT Backend" /D "%~dp0" "%ComSpec%" /k ""%PYTHON%" -m uvicorn backend.legacy_ai_app:app --host 127.0.0.1 --port 8000"
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:8000/"
echo Keep backend running for trained AI inference.
endlocal
