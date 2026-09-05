@echo off
chcp 65001 >nul
cd /d "%~dp0"

title Бақайдгирӣ-Даъватнома
echo ========================================
echo   Бақайдгирӣ · Даъватнома  (offline)
echo ========================================
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  set PY=py -3
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    set PY=python
  ) else (
    echo [Хато] Python ёфт нашуд.
    echo Python 3.10+ насб кунед: https://www.python.org/downloads/
    echo Вақти насб: "Add python.exe to PATH" -ро фаъол кунед.
    pause
    exit /b 1
  )
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Сохтани муҳити virtual...
  %PY% -m venv .venv
  if errorlevel 1 (
    echo [Хато] venv сохта нашуд.
    pause
    exit /b 1
  )
)

set VENV_PY=.venv\Scripts\python.exe
set VENV_PIP=.venv\Scripts\pip.exe

echo [2/3] Санҷиши бастаҳо...
"%VENV_PIP%" install -q -r requirements.txt
if errorlevel 1 (
  echo [Хато] pip install ноком. Интернет лозим аст (як бор).
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [.env] аз .env.example сохта шуд.
  )
)

if exist "patch_scan.py" (
  "%VENV_PY%" patch_scan.py
)

echo [3/3] Сервер оғоз...
echo.
echo   Браузер:  http://127.0.0.1:5000
echo   Логин:    аз файли .env
echo   Қать:     ин равзанаро пӯшед ё Ctrl+C
echo ========================================
echo.

start "" "http://127.0.0.1:5000"

"%VENV_PY%" server.py

echo.
echo Сервер қатъ шуд.
pause
