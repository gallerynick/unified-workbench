@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 一站式工作台 - 停止脚本（Windows）
:: 停止所有服务容器，保留数据和配置

cd /d "%~dp0"

:: 自动探测 docker
call "%~dp0scripts\docker-detect.bat"
if errorlevel 1 (
    echo [信息] 未检测到 docker（可能未安装），无需停止服务。
    goto :done
)
echo 使用 docker: %DOCKER_BIN%

echo.
echo ============================================
echo   一站式工作台 - 停止所有服务
echo ============================================
echo.

:: 停止主项目容器（保留数据卷）
echo 正在停止 Unified Workbench 服务...
"%DOCKER_BIN%" compose -p unified-workbench down

:: 停止 Mediamtx（独立容器，不在 compose 中）
echo 正在停止 Mediamtx...
"%DOCKER_BIN%" stop unified-workbench-mediamtx-1 2>nul
"%DOCKER_BIN%" rm unified-workbench-mediamtx-1 2>nul

echo.
echo ============================================
echo   所有服务已停止。
echo.
echo   重新启动：start.bat
echo ============================================
echo.

:done
pause
