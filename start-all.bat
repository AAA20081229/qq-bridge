@echo off
title QQ Companion Suite - auto start
rem 1 5099 SnowLuma / 2 3080 DSH web / 3 3100 qq-bridge / 4 3111 watchdog / 5 desktop pet
rem 已经在跑的会跳过，不会重复启动。
rem 路径全部相对本文件推算：本文件在 <根目录>\qqbridge\qq-bridge\start-all.bat
rem 所以根目录 = %~dp0..\..  —— 整个 D:\whale 搬到别处也不用改这里。

set "ROOT=%~dp0..\.."
pushd "%ROOT%"
set "ROOT=%CD%"
popd
set "BRIDGE=%ROOT%\qqbridge\qq-bridge"

echo ============================================================
echo  ROOT = %ROOT%
echo ============================================================
echo.
echo [0/5] checking folders
if not exist "%ROOT%\SnowLuma\start-snowluma.bat" (
  echo        ERROR: not found %ROOT%\SnowLuma\start-snowluma.bat
  echo        SnowLuma folder has moved. Fix the path or move it back.
  goto :fail
)
if not exist "%BRIDGE%\start.bat" (
  echo        ERROR: not found %BRIDGE%\start.bat
  goto :fail
)

echo [1/5] SnowLuma :5099
netstat -ano | findstr /c:":5099" | findstr /i "LISTENING" >nul
if errorlevel 1 (
  start "SnowLuma" /min "%ROOT%\SnowLuma\start-snowluma.bat"
  %SystemRoot%\System32\ping.exe -n 11 127.0.0.1 >nul
) else (
  echo        already running - skipped
)

echo [2/5] DSH web :3080
netstat -ano | findstr /c:"127.0.0.1:3080" | findstr /i "LISTENING" >nul
if errorlevel 1 (
  start "DSH web" /min "%BRIDGE%\start-dsh-web.bat"
  %SystemRoot%\System32\ping.exe -n 13 127.0.0.1 >nul
) else (
  echo        already running - skipped
)

echo [3/5] qq-bridge :3100
netstat -ano | findstr /c:":3100" | findstr /i "LISTENING" >nul
if errorlevel 1 (
  start "qq-bridge" /min "%BRIDGE%\start.bat"
  %SystemRoot%\System32\ping.exe -n 9 127.0.0.1 >nul
) else (
  echo        already running - skipped
)

echo [4/5] watchdog :3111
netstat -ano | findstr /c:"127.0.0.1:3111" | findstr /i "LISTENING" >nul
if errorlevel 1 (
  start "watchdog" /min "%BRIDGE%\watchdog.bat"
) else (
  echo        already running - skipped
)

echo [5/5] desktop pet
tasklist | findstr /i "dsh-pet-standalone" >nul
if errorlevel 1 (
  if exist "%ROOT%\dsh-pet\dsh-pet-standalone-webm-chat.exe" (
    start "" /D "%ROOT%\dsh-pet" "%ROOT%\dsh-pet\dsh-pet-standalone-webm-chat.exe" --slot 0
  ) else (
    echo        SKIP: %ROOT%\dsh-pet\dsh-pet-standalone-webm-chat.exe not found
  )
) else (
  echo        already running - skipped
)

echo.
echo Done. This window closes in 5 seconds.
%SystemRoot%\System32\ping.exe -n 6 127.0.0.1 >nul
exit /b 0

:fail
echo.
echo Startup aborted - see the error above.
pause
exit /b 1
