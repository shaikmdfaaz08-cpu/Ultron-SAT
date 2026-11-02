@echo off
setlocal
title ULTRON SAT Setup
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher not found. Install Python 3.10+ first.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" py -m venv .venv
if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment creation failed.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Dependency installation failed. Review the errors.
  pause
  exit /b 1
)
echo Setup completed.
pause
