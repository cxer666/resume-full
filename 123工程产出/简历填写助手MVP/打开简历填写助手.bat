@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo 正在启动 简历填写助手...
echo 访问地址：http://127.0.0.1:17888/
echo 请保持此窗口运行，关闭窗口后助手服务会停止。
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py
  goto :after_run
)

where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
  goto :after_run
)

set "CODEX_PY=C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%CODEX_PY%" (
  "%CODEX_PY%" server.py
  goto :after_run
)

echo 未找到 Python。请先安装 Python 3.10+，或在 PowerShell 中运行：
echo winget install Python.Python.3.12
echo.
pause
goto :end

:after_run
echo.
echo 简历填写助手已关闭。如需继续使用，请重新双击本文件。
pause

:end
endlocal
