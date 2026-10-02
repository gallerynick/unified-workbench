@echo off
chcp 65001 >nul
rem ============================================================
rem 一站式工作台 - 构建缓存清理（手动执行，Windows）
rem ------------------------------------------------------------
rem 用法：
rem   scripts\prune-cache.bat            交互确认后清理
rem   scripts\prune-cache.bat --force    跳过确认
rem   scripts\prune-cache.bat --help     显示帮助
rem
rem 【重要】为什么用 buildx prune -a，而不是裸 prune 或 --filter：
rem   2026-10-01 在 buildx v0.35.0-desktop.2 上逐条实测：
rem     --filter until=notaduration  -> 正常报错（说明过滤器确实被解析）
rem     --filter until=99999h        -> 0B（匹配不到任何记录，行为正确）
rem     --filter until=20h           -> 0B（当时有 24-43h 的旧代，却清不掉）
rem     裸 builder prune -f          -> 只清「可回收」部分，且会留下删不掉的重复层
rem     buildx prune -a -f           -> 7.064GB OK 彻底清空，缓存降到 51MB
rem
rem   实测发现两类问题：
rem   1) until 过滤器虽能解析，但匹配不到应清的历史代，做不了「保留期」
rem   2) 多次改 Dockerfile 后会残留多份同内容的层（曾出现 1.11GB x3、
rem      824MB x3），裸 prune 删不掉它们，可回收量归零而占用居高不下
rem   只有 -a（连内部/前端缓存一并清除）能真正清干净。
rem
rem 【代价】-a 会清空全部构建缓存，下次构建是【全量重建】：
rem   实测 CACHED=0、269 行下载、约 220-320s。所以请在【不急着重建】
rem   的时候手动跑。清空后再构建一次，缓存会回到「单代干净」状态
rem   （实测约 5.1GB，无重复层）。
rem
rem 【地板】缓存体积约等于镜像层体积，单代约 5.1GB：
rem   COPY /usr/local 2.51GB + pip 1.11GB + torch 0.82GB + apt 0.53GB。
rem   想压到更低只能减小镜像本体（剥离 __pycache__/torch 测试与头文件
rem   约 353MB，或把 ASR 依赖拆成可选约 1.49GB），本脚本无法突破这个地板。
rem
rem 清理范围：
rem   • 构建缓存   docker builder prune -f
rem   • 悬空镜像   docker image prune -f
rem
rem 明确不做（会丢数据）：
rem   • 不删卷：不加 --volumes，不跑 docker volume prune。
rem   • 不动 frontend\dist、node_modules。
rem
rem 说明：本脚本【不再】被 start.bat 调用。启动流程完全不碰构建缓存。
rem ============================================================

set "FORCE=0"
for %%a in (%*) do (
  if /i "%%a"=="--force" set "FORCE=1"
  if /i "%%a"=="-f" set "FORCE=1"
  if /i "%%a"=="--help" goto :usage
  if /i "%%a"=="-h" goto :usage
)
goto :afterargs

:usage
echo 用法: scripts\prune-cache.bat [选项]
echo.
echo 选项:
echo   --force, -f   跳过交互确认
echo   --help, -h    显示本帮助
echo.
echo 说明:
echo   手动清理构建缓存与悬空镜像。会清掉所有「无镜像引用」的缓存层，
echo   下次重建时这些步骤需重新执行。不会触碰任何卷，也不会动
echo   frontend\dist 与 node_modules。本脚本不被 start.bat 调用。
exit /b 0

:afterargs
rem ── 探测 docker（独立执行时自行调用探测库）──
if not defined DOCKER_BIN (
  if exist "%~dp0docker-detect.bat" call "%~dp0docker-detect.bat"
  if not defined DOCKER_BIN (
    echo [错误] 未找到可用的 docker
    exit /b 1
  )
)

echo.
echo   当前构建缓存：
"%DOCKER_BIN%" system df 2>nul | findstr /b /c:"Build Cache"
echo.

if not "%FORCE%"=="1" (
  set /p ANS=  将清理所有可回收缓存层，下次重建需重跑这些步骤。继续？[y/N] 
  if /i not "!ANS!"=="y" (
    echo   已取消
    exit /b 0
  )
)

setlocal enabledelayedexpansion
set "BFREE="
set "IFREE="

rem 汇总行有两种措辞，都要取到：
rem   docker 29.x buildx ： "Total:<TAB>6.257MB"     -> token1=Total: token2=值
rem   docker image prune ： "Total reclaimed space: 0B" -> token1=Total token4=值
for /f "tokens=1,2" %%a in ('"%DOCKER_BIN%" buildx prune -a -f 2^>nul') do if "%%a"=="Total:" set "BFREE=%%b"
for /f "tokens=1,4" %%a in ('"%DOCKER_BIN%" image prune -f 2^>nul') do if "%%a"=="Total" set "IFREE=%%d"

echo.
if defined BFREE (
  if "!BFREE!"=="0B" (
    echo   . 无待清理的构建缓存
  ) else (
    echo   OK 已释放 !BFREE! 构建缓存
  )
) else (
  echo   . 无待清理的构建缓存
)
if defined IFREE (
  if not "!IFREE!"=="0B" echo   OK 已释放 !IFREE! 悬空镜像
)
echo   . 未触碰任何卷，未动 frontend\dist、node_modules
echo.
exit /b 0
