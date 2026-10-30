@echo off
title 一键恢复 QQ 机器人
rem 路径跟着本文件走：搬到哪个盘都不用改
cd /d "%~dp0"

echo ============================================================
echo   正在检查并恢复 QQ 机器人...
echo   （断电、断网、或者不知道哪里坏了的时候，双击这个就行）
echo ============================================================
echo.

call "%~dp0start-all.bat"

echo.
echo 等待各个服务启动（约 40 秒，别关窗口）...
%SystemRoot%\System32\ping.exe -n 41 127.0.0.1 >nul

echo.
echo ================ 检查结果 ================
set MISSING=
for %%p in (5099 3080 3100 3111 3000 3001) do (
  netstat -ano | findstr /c:":%%p" | findstr /i "LISTENING" >nul
  if errorlevel 1 (
    echo    %%p   没有起来
    set MISSING=1
  ) else (
    echo    %%p   正常
  )
)
tasklist | findstr /i "dsh-pet-standalone" >nul
if errorlevel 1 ( echo    桌宠   没有起来 ) else ( echo    桌宠   正常 )

echo.
if defined MISSING (
  echo ------------------------------------------------------------
  echo  [有东西没起来]
  echo.
  echo  1. 如果 3000 / 3001 没起来：小号掉线了，要扫码。
  echo     打开 http://127.0.0.1:5099  账号 admin，密码你自己设的，扫一下。
  echo.
  echo  2. 其他情况：再双击一次这个脚本试试。
  echo ------------------------------------------------------------
) else (
  echo ------------------------------------------------------------
  echo  [全部正常] 去 QQ 里跟小鲸说句话试试。
  echo ------------------------------------------------------------
)
echo.
echo 按任意键关闭窗口...
pause >nul
