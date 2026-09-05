@echo off
echo Серверро қатъ кардан (порт 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo Тамом.
timeout /t 2 >nul
