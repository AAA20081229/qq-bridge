@echo off
chcp 65001 >nul
title Add to whitelist
cd /d "%~dp0"
echo ============================================================
echo   Add a QQ id to the bot whitelist.
echo   Type a QQ number or a group number - it detects which.
echo   Force it with g: / p: if the detection is wrong.
echo   Leave empty and press Enter to cancel.
echo ============================================================
echo.
set "TARGET="
set /p "TARGET=QQ id: "
if not defined TARGET (
  echo Cancelled.
  %SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul
  exit /b 0
)
echo.
node "%~dp0tools\add-allow.js" "%TARGET%"
echo.
echo Press any key to close.
pause >nul
