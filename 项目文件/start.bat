@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   一站式工作台 - 一键启动脚本
echo ========================================
echo.

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
    echo [信息] 未找到 .env 文件，正在从 .env.example 创建...
    copy .env.example .env >nul
    echo [信息] 已创建 .env 文件。请根据需要修改配置后重新运行此脚本。
    echo.
    pause
    exit /b 0
)

:: 启动服务
echo [信息] 正在启动所有服务...
echo.

docker compose up -d --build

if errorlevel 1 (
    echo.
    echo [错误] 启动失败！请检查错误信息。
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   所有服务已启动！
echo ========================================
echo.
echo   前端界面: http://localhost
echo   后端 API: http://localhost/api/v1
echo   API 文档: http://localhost/api/v1/docs
echo.
echo   数据库:   localhost:5432
echo   Redis:    localhost:6379
echo.
echo ========================================
echo.

:: 显示服务状态
docker compose ps

echo.
echo 按任意键退出...
pause >nul
