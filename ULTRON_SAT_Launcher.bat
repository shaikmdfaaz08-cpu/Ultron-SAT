
@echo off
title ULTRON SAT Launcher
cd /d "%~dp0"

set "PYTHON=%~dp0.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo ERROR: Python environment not found.
    pause
    exit /b 1
)

if not exist "%~dp0BACKEND\app.py" (
    echo ERROR: BACKEND\app.py not found.
    pause
    exit /b 1
)

echo Starting ULTRON SAT backend...
start "ULTRON SAT Backend" /D "%~dp0" "%ComSpec%" /k ""%PYTHON%" -m uvicorn BACKEND.app:app --host 127.0.0.1 --port 8000"

echo Waiting for backend startup...
timeout /t 5 /nobreak >nul

start "" "http://127.0.0.1:8000/"

echo Dashboard opened. Keep the backend window open.
exit /b 0
