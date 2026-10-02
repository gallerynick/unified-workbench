# 变更日志

本项目遵循语义化版本（SemVer）：`MAJOR.MINOR.PATCH`

| 段位 | 含义 |
|------|------|
| **MAJOR** | 不兼容变更（数据库结构破坏性变更、API 破坏性变更、部署方式变更） |
| **MINOR** | 向后兼容的新功能 |
| **PATCH** | 向后兼容的问题修复 |

---

## 发布流程

版本号有 **3 处**定义，必须同步更新：

| 位置 | 字段 |
|------|------|
| `项目文件/backend/app/version.py` | `__version__` |
| 仓库根目录 `.unified-workbench` | `min_version` |
| `README.md` 顶部徽章 | `version-X.Y.Z` |

打 tag 与推送：

```bash
git add -A && git commit -m "release: v2.0.0"
git tag v2.0.0
git push origin master
git push origin v2.0.0
```

### tag 格式硬约束

应用内置的「检查更新」通过 `git ls-remote --tags` 读取 tag（见
`项目文件/backend/app/services/updater.py` 的 `_parse_tags`），逻辑是：
去掉 `refs/tags/` → 去掉前导 `v` → 必须匹配 `^\d+\.\d+\.\d+$`，
取所有合规 tag 中最大者，与 `__version__` 比较。

| tag | 是否识别 |
|-----|----------|
| `v2.0.0` / `2.0.0` | ✅ |
| `v2.0` | ❌ 只有两段 |
| `v2.0.0-rc1` | ❌ 带后缀 |
| `pre-2fa` / `restore-*` | ❌ 不匹配 |

### 升级路径

用户侧当前为**手动更新**：`git pull && ./start.sh`。

> 应用内「立即更新」按钮在 `项目基定/应用标识文件基定.md` 第 3.2 节中是设计意图，
> 但 `updater.py` 目前**只实现了检查更新，未实现执行更新**——backend 容器未挂载源码
> 仓库、`dist/` 被 gitignore、compose 自建服务未 pin `image:` tag，三处结构性障碍未解决。
> 在补齐之前，请把「检查更新」视为只读的版本提示，不要指望它自动升级。

---

## 发布前检查清单

- [ ] `cd 项目文件/frontend && npm run build` 通过（`tsc -b` 无错误）
- [ ] `cd 项目文件/backend && pytest` 通过
- [ ] 干净环境验证：全新目录 `git clone` → `./start.sh` → 健康检查全绿 → `/welcome` 建管理员 → 登录正常
- [ ] 数据库迁移可升级：上一版本库执行 `alembic upgrade head` 不报错，数据不丢
- [ ] 3 处版本号一致（`version.py` / `.unified-workbench` / README 徽章）
- [ ] 本文件补全本次变更条目
- [ ] `git tag` 并推送 master 与 tag

---

## [未发布] v2.0.0 — 2026-XX-XX

`version.py` 已推进到 2.0.0，但**尚未打 tag**，在更新器眼里还不存在
（当前最大 tag 为 `v1.0.1`）。待开发收尾后补全以下条目并正式发布。

### 新增

- （待补）

### 修复

- （待补）

### 变更

- （待补）

### 数据库迁移

- （待补：列出 alembic 迁移编号，供升级用户核对）

---

## v1.0.1

- （历史版本，条目待从开发日志回填）

## v1.0.0

- （历史版本，条目待从开发日志回填）

## v0.1.0

- （历史版本，条目待从开发日志回填）
