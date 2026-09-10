@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ========================================
echo   一站式工作台 - 一键启动脚本
echo ========================================
echo.

:: ── 参数：--skip-build 跳过前端构建 ──
if defined SKIP_FRONTEND_BUILD set "SKIP_BUILD=!SKIP_FRONTEND_BUILD!" else set "SKIP_BUILD=0"
for %%a in (%*) do (
  if /i "%%a" == "--skip-build" set "SKIP_BUILD=1"
)

:: [1/3] 环境检查
echo [1/3] 环境检查...
call "%~dp0scripts\docker-detect.bat"
if errorlevel 1 (
    echo [错误] 未找到可用的 docker！
    echo 请安装并启动 Docker Desktop，然后重试。
    echo.
    pause
    exit /b 1
)
echo 使用 docker: %DOCKER_BIN%

:: 检查 Docker daemon 是否运行
"%DOCKER_BIN%" info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker Desktop 未运行！
    echo 请先启动 Docker Desktop，然后重试。
    echo.
    pause
    exit /b 1
)

:: 检测本机局域网 IP（用于 WebRTC ICE + 启动后的地址提示）
set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "LAN_IP=%%a"
  set "LAN_IP=!LAN_IP: =!"
  goto :found_ip
)
:found_ip
if "!LAN_IP!"=="" set "LAN_IP=未检测到"
echo 本机 IP: !LAN_IP!

:: 设置 HOST_IP 给 docker-compose（WebRTC ICE 多候选项）
set "HOST_IP=!LAN_IP!,host.docker.internal"

:: 检查 .env 文件是否存在
if not exist ".env" (
    echo [信息] 正在从 .env.example 创建 .env ...
    copy .env.example .env >nul
)

:: [2/3] 前端构建
:: frontend\Dockerfile 直接 COPY dist（容器内不跑 npm）。
:: 若 dist 过期，docker compose --build 会命中缓存并静默复用旧产物，
:: 表现为「全部服务已启动」但改动并未生效。故先本地构建。
echo.
echo [2/3] 前端构建...
if "!SKIP_BUILD!"=="1" (
    echo   已跳过前端构建（--skip-build）
    if not exist "frontend\dist\index.html" (
        echo [错误] frontend\dist 不存在，无法跳过前端构建
        pause
        exit /b 1
    )
    goto :frontend_done
)
where node >nul 2>&1
if errorlevel 1 (
    if exist "frontend\dist\index.html" (
        echo   [警告] 未找到 node，沿用现有 frontend\dist
        goto :frontend_done
    )
    echo [错误] 未找到 node 且 frontend\dist 不存在，无法构建前端
    pause
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo   node_modules 缺失，执行 npm install ...
    pushd frontend
    call npm install
    if errorlevel 1 (
        popd
        echo [错误] npm install 失败
        pause
        exit /b 1
    )
    popd
)
pushd frontend
call npm run build
if errorlevel 1 (
    popd
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
popd
echo   前端构建完成
:frontend_done

:: [3/3] 启动服务
echo.
echo [3/3] 正在启动所有服务...
echo.

"%DOCKER_BIN%" compose -p unified-workbench up -d --build
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
echo   API 文档: https://localhost/api/v1/docs
echo.

"%DOCKER_BIN%" compose -p unified-workbench ps
