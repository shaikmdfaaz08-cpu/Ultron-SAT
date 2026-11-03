@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ULTRON SAT - Safe Local RGB and Grayscale Training
echo.
echo ==========================================
echo   ULTRON SAT - SAFE LOCAL AI TRAINING
echo ==========================================
echo.
if not exist ".venv\Scripts\python.exe" (
  echo ERROR: Python virtual environment missing.
  echo Run SETUP_ULTRON_SAT.bat first.
  pause
  exit /b 1
)
if not exist "DataSet\oilspill-detection-dataset-real\splits\train.csv" (
  echo ERROR: Missing train.csv containing labeled image/mask pairs.
  echo Place your labeled dataset under DataSet\oilspill-detection-dataset-real\
  echo Nothing has been trained or replaced.
  pause
  exit /b 1
)
if not exist "DataSet\oilspill-detection-dataset-real\splits\val.csv" (
  echo ERROR: Missing val.csv containing separate validation images.
  echo Nothing has been trained or replaced.
  pause
  exit /b 1
)
echo [1] Test setup with ONE epoch (recommended first)
echo [2] Full SAFE training - max 35 epochs, patience 7
echo [3] Cancel
choice /C 123 /N /M "Choose 1, 2, or 3: "
if errorlevel 3 exit /b 0
if errorlevel 2 goto full
if errorlevel 1 goto smoke
:smoke
set "EPOCHS=1"
set "PATIENCE=1"
set "OUTPUT=runs\oil_rgb_gray_smoke"
goto train
:full
set "EPOCHS=35"
set "PATIENCE=7"
set "OUTPUT=runs\oil_rgb_gray_local_candidate"
if exist "%OUTPUT%\best.pt" (
  echo.
  echo ERROR: A previous candidate exists at %OUTPUT%\best.pt
  echo Move/rename that output folder first to avoid overwriting an earlier candidate.
  pause
  exit /b 1
)
:train
echo.
echo Starting training, writing only to %OUTPUT%.
echo Existing production SAR and RGB checkpoints will NOT be changed.
echo Press Ctrl+C to cancel training at any time.
echo.
".venv\Scripts\python.exe" -u "A.I\train_oil_unet_rgb_gray.py" --dataset "DataSet\oilspill-detection-dataset-real" --epochs %EPOCHS% --patience %PATIENCE% --batch 2 --workers 0 --size 256 --lr 0.0001 --gray-probability 0.5 --out "%OUTPUT%"
if errorlevel 1 (
 echo.
 echo TRAINING FAILED. Review the error above, dataset labels and dependency versions.
 pause
 exit /b 1
)
echo.
echo Training completed. Review %OUTPUT%\metrics.json
echo Do NOT deploy this model until it passes independent evaluation.
pause
