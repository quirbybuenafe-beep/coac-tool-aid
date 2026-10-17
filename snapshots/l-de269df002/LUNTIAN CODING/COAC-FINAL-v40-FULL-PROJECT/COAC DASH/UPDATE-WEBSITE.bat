@echo off
setlocal
title COAC Tool Aid Updater

set "COAC_ROOT=D:\COAC"
set "UPDATER_SCRIPT=%~dp0tools\update-website.ps1"

if not exist "%UPDATER_SCRIPT%" (
  echo.
  echo The updater script was not found:
  echo %UPDATER_SCRIPT%
  echo.
  pause
  exit /b 1
)

echo.
echo COAC TOOL AID - ONE-CLICK UPDATE
echo --------------------------------
echo Close the old website server before continuing.
echo The permanent installation folder is D:\COAC
echo The updater will use the newest complete COAC-Tool-Aid ZIP in Downloads.
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%UPDATER_SCRIPT%" -ProjectRoot "%COAC_ROOT%"
if errorlevel 1 (
  echo.
  echo Update was not completed. Read the message above.
  pause
  exit /b 1
)

echo.
echo Update complete. Starting the website from D:\COAC...
timeout /t 2 /nobreak >nul

if not exist "%COAC_ROOT%\START-WEBSITE.bat" (
  echo.
  echo START-WEBSITE.bat was not found in D:\COAC.
  echo The update copied incompletely.
  pause
  exit /b 1
)

call "%COAC_ROOT%\START-WEBSITE.bat"
endlocal
