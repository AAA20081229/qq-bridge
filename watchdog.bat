@echo off
chcp 65001 >nul
title QQ bridge watchdog - keep this window open
cd /d "%~dp0"
echo ============================================================
echo  Watchdog: checks 5099 / 3080 / 3100 every 60s and restarts
echo  whatever is down. Log: %~dp0state\watchdog.log
echo ============================================================
echo.
node "%~dp0tools\watchdog.js"
echo.
echo Watchdog exited. Press any key to close.
pause >nul
