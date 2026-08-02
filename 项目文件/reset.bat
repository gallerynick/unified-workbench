@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 一站式工作台 - 彻底重置脚本（Windows）
:: 删除所有容器、数据卷、文件，回到未初始化状态

cd /d "%~dp0"

:: ============================================================
:: 0. 警告与确认
:: ============================================================
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║          ⚠️   彻 底 重 置 警 告   ⚠️           ║
echo ╠══════════════════════════════════════════════════╣
echo ║  此操作将永久删除以下内容：                      ║
echo ║  • 所有数据库数据（用户/内容/文件记录等）        ║
echo ║  • 所有上传文件                                  ║
echo ║  • 所有备份数据                                  ║
echo ║  • Redis 缓存与队列数据                          ║
echo ║  • 所有 Docker 容器（含 Mediamtx）               ║
echo ║                                                  ║
echo ║  ⛔ 此操作不可撤销！                             ║
echo ╚══════════════════════════════════════════════════╝
echo.
set /p confirm="输入 YES 确认重置（其他任意键取消）: "

if /i not "!confirm!"=="YES" (
    echo 已取消。
    goto :end
)

echo.
echo 开始重置...

:: ============================================================
:: 1. 停止并删除所有工作台容器（含 Mediamtx）
:: ============================================================
echo → 停止所有容器...
docker compose -p unified-workbench down --remove-orphans 2>nul

:: Mediamtx 可能不在此 compose 中，单独处理
for /f "tokens=*" %%i in ('docker ps -a --filter "name=mediamtx" --format "{{.ID}}" 2^>nul') do (
    echo → 停止 Mediamtx 容器...
    docker stop %%i 2>nul
    docker rm %%i 2>nul
)

:: ============================================================
:: 2. 删除 Docker 数据卷
:: ============================================================
echo → 删除数据库卷...
docker volume rm unified-workbench_pg_data 2>nul

echo → 删除 Redis 卷...
docker volume rm unified-workbench_redis_data 2>nul

:: 删除孤立卷（名称前缀匹配 unified-workbench）
echo → 清理遗留卷...
for /f "tokens=*" %%i in ('docker volume ls --filter "name=unified-workbench" -q 2^>nul') do (
    docker volume rm %%i 2>nul
)

:: ============================================================
:: 3. 删除持久化文件数据
:: ============================================================
if exist "data\files\*" (
    echo → 删除上传文件...
    del /f /s /q "data\files\*" 2>nul
    for /d %%d in ("data\files\*") do rmdir /s /q "%%d" 2>nul
)

if exist "data\backups\*" (
    echo → 删除备份文件...
    del /f /s /q "data\backups\*" 2>nul
    for /d %%d in ("data\backups\*") do rmdir /s /q "%%d" 2>nul
)

:: ============================================================
:: 4. 完成后提示
:: ============================================================
echo.
echo ===========================================
echo    系统已彻底重置，回到未初始化状态。
echo    使用 start.bat 重新初始化启动。
echo ===========================================
echo.

:end
pause
