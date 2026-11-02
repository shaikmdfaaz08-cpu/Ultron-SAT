@echo off
setlocal
title ULTRON SAT - Training
cd /d "%~dp0"
set "PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
  echo Run SETUP_ULTRON_SAT.bat first.
  pause
  exit /b 1
)
set "DATA=DataSet\oilspill-detection-dataset-real"
if not exist "%DATA%\splits\train.csv" (
  echo MISSING: %DATA%\splits\train.csv
  echo Obtain the authorized dataset and place it in this expected directory.
  pause
  exit /b 1
)
if not exist "%DATA%\splits\val.csv" (
  echo MISSING: %DATA%\splits\val.csv
  pause
  exit /b 1
)
echo.
echo 1. Smoke test - 1 epoch, 8 image pairs
echo 2. Full training - separate output directory
choice /c 12 /m "Select training mode"
if errorlevel 2 goto full
"%PYTHON%" "A.I\train_oil_unet_csv.py" --epochs 1 --limit 8 --batch 2 --workers 0 --out "runs\oil_unet_smoke"
goto done
:full
echo Training on full dataset, output runs\oil_unet_new
"%PYTHON%" "A.I\train_oil_unet_csv.py" --full --epochs 30 --workers 0 --out "runs\oil_unet_new"
:done
if errorlevel 1 echo Training failed. Check logs and dataset.
echo Existing runs\oil_unet_full\best.pt is not overwritten.
pause
