@echo off
rem ============================================================
rem 一站式工作台 - docker 自动探测（Windows）
rem ------------------------------------------------------------
rem 供 start.bat / stop.bat / reset.bat 通过 call 调用。
rem 在 PATH 或 Docker Desktop 常见安装路径中探测可用的 docker，
rem 结果写入环境变量 DOCKER_BIN 并回传到调用方。
rem 注意：本文件不要使用 setlocal，否则 DOCKER_BIN 无法回传。
rem ============================================================

set "DOCKER_BIN="

rem 1) PATH 上的 docker 优先
where docker >nul 2>&1
if not errorlevel 1 (
  set "DOCKER_BIN=docker"
  goto :found
)

rem 2) Docker Desktop 常见安装路径（Program Files）
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
  set "DOCKER_BIN=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
  goto :found
)

rem 3) 备用：32 位 Program Files (x86)
if exist "%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe" (
  set "DOCKER_BIN=%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe"
  goto :found
)

:found
if defined DOCKER_BIN exit /b 0
echo [错误] 未找到可用的 docker，请安装并启动 Docker Desktop 后重试。
exit /b 1
