@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   一站式工作台 - 一键启动脚本
echo ========================================
echo.

:: 检测本机局域网 IP（用于 WebRTC ICE + 启动后的地址提示）
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "LAN_IP=%%a"
  set "LAN_IP=!LAN_IP: =!"
  goto :found_ip
)
:found_ip
if "!LAN_IP!"=="" set "LAN_IP=未检测到"
echo 本机 IP: !LAN_IP!

:: 设置 HOST_IP 给 docker-compose
set "HOST_IP=!LAN_IP!,host.docker.internal"

:: 检查 Docker Desktop 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker Desktop 未运行！
    echo 请先启动 Docker Desktop，然后重试。
    echo.
    pause
    exit /b 1
)

:: 检查 .env 文件是否存在
if not exist ".env" (
    echo [信息] 正在从 .env.example 创建 .env ...
    copy .env.example .env >nul
)

:: 启动服务
echo [信息] 正在启动所有服务...
echo.

docker compose -p unified-workbench up -d --build

if errorlevel 1 (
    echo.
    echo [错误] 启动失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo   所有服务已启动！
echo ========================================
echo.
echo   本机 HTTP:  http://localhost
echo   本机 HTTPS: https://localhost
echo   局域网 HTTP:  http://!LAN_IP!
echo   局域网 HTTPS: https://!LAN_IP!
echo   API 文档: http://localhost/api/v1/docs
echo.

docker compose -p unified-workbench ps
