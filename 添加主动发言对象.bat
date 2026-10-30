@echo off
chcp 65001 >nul
title Add a proactive chat target
cd /d "%~dp0"
echo ============================================================
echo   Add a QQ id to the "AI may start a conversation" list
echo   Type a QQ number for a private chat, e.g.  123456789
echo   Type g: + group number for a group,  e.g.  g:876543210
echo   Leave it empty and press Enter to cancel.
echo ============================================================
echo.
set "TARGET="
set /p "TARGET=QQ id: "
if not defined TARGET (
  echo Cancelled.
  ping -n 3 127.0.0.1 >nul
  exit /b 0
)
echo.
node "%~dp0tools\add-proactive.js" "%TARGET%"
echo.
pause
