@echo off
setlocal
title COAC Tool Aid Launcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Install Node.js 22 or newer, then run this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo npm was not found. Reinstall Node.js and include npm.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing the website for the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation failed. Check the message above.
    pause
    exit /b 1
  )
)

echo Starting COAC Tool Aid...
start "COAC Tool Aid Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url='http://127.0.0.1:5173'; $limit=(Get-Date).AddSeconds(35); " ^
  "while((Get-Date) -lt $limit){ try { Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2 | Out-Null; Start-Process $url; exit 0 } catch { Start-Sleep -Milliseconds 700 } }; exit 1"

if errorlevel 1 (
  echo.
  echo The website is taking longer than expected.
  echo Open http://127.0.0.1:5173 in your browser when the server is ready.
  pause
)

endlocal
