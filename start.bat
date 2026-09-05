@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Baqaydgiri-Davotnoma

echo ========================================
echo   Baqaydgiri-Davotnoma  (offline)
echo ========================================
echo.
echo Folder: %CD%
echo.

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY where python3 >nul 2>&1 && set "PY=python3"

if not defined PY (
  echo [ERROR] Python not found in PATH.
  echo Install Python 3.10+ from https://www.python.org/downloads/
  echo During setup enable: Add python.exe to PATH
  echo.
  pause
  exit /b 1
)

echo Using: %PY%
%PY% --version
echo.

if not exist "server.py" (
  echo [ERROR] server.py not found in this folder.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creating .venv ...
  %PY% -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Could not create venv
    pause
    exit /b 1
  )
)

set "VENV_PY=%CD%\.venv\Scripts\python.exe"
set "VENV_PIP=%CD%\.venv\Scripts\pip.exe"

if not exist "%VENV_PY%" (
  echo [ERROR] .venv\Scripts\python.exe missing
  pause
  exit /b 1
)

echo [2/3] Installing packages (first time needs internet)...
"%VENV_PIP%" install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install failed. Check internet, then try again.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" copy /Y ".env.example" ".env" >nul
)

if exist "patch_scan.py" (
  echo Running patch_scan.py ...
  "%VENV_PY%" patch_scan.py
)

echo.
echo [3/3] Starting server...
echo Open browser: http://127.0.0.1:5000
echo Close this window or press Ctrl+C to stop.
echo ========================================
echo.

start "" "http://127.0.0.1:5000"
"%VENV_PY%" server.py

echo.
echo Server stopped.
pause
