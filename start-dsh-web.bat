@echo off
chcp 65001 >nul
title DSH Web API (127.0.0.1:3080) - keep this window open
cd /d "%~dp0"
:loop
rem --- single-instance guard: if 3080 is already listening, do not start another one ---
netstat -ano | findstr /c:"127.0.0.1:3080" | findstr /i "LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo  Port 3080 is already in use - another DSH web instance is running.
  echo  This window will close in 5 seconds.
  %SystemRoot%\System32\ping.exe -n 6 127.0.0.1 >nul
  exit /b 0
)
echo.
echo ============================================================
echo  Starting DeepSeek Harness web profile ...
echo    API : http://127.0.0.1:3080
echo  Keep this window open while qq-bridge is running.
echo  Close this window (or Ctrl+C) to stop the service.
echo ============================================================
echo.
rem --- NOTE: must use CALL. dsh.cmd is a batch file; calling it without CALL
rem --- transfers control away and this watchdog loop would never continue.
call "%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" web
echo.
echo DSH web exited (code %errorlevel%). Restarting in 5 seconds ...
%SystemRoot%\System32\ping.exe -n 6 127.0.0.1 >nul
goto loop
