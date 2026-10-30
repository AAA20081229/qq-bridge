@echo off
chcp 65001 >nul
title QQ bridge watchdog - keep this window open
cd /d "%~dp0"
echo ============================================================
echo  Watchdog: keeps qq-bridge connected to SnowLuma.
echo  Every 60s it checks SnowLuma(3000) and the bridge WS(3001).
echo  If SnowLuma is alive but the bridge lost its socket,
echo  it restarts the bridge automatically.
echo.
echo  Log: %~dp0state\watchdog.log
echo ============================================================
echo.
node "%~dp0tools\watchdog.js"
echo.
echo Watchdog exited. Press any key to close.
pause >nul
