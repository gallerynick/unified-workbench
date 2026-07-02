# API 尾部斜杠与 FastAPI 路由（一层 vs 二层子路由处理差异）

## 问题分类
前端 API / FastAPI / 路由定义

## 触发场景
修改前端 API 调用时，不清楚哪些端点需要尾部斜杠、哪些不需要，导致 307 重定向或 CORS 预检失败。

## 根因
FastAPI 对路由的尾部斜杠处理规则：

### 一层路由（需要尾部斜杠）
路由定义在 prefix 下直接挂载（如 `@router.get("/")` 在 `prefix="/tasks"` 下）：
```
/api/v1/tasks/  → 200 OK（直接匹配）
/api/v1/tasks   → 307 重定向到 /api/v1/tasks/
```
**前端调用必须带尾部斜杠**。

### 二层子路由（不需要尾部斜杠）
路由定义有两层结构（如 `@router.get("/folders")` 在 `prefix="/files"` 下）：
```
/api/v1/files/folders/  → 307 重定向到 /api/v1/files/folders
/api/v1/files/folders   → 200 OK（直接匹配）
```
**前端调用不能带尾部斜杠**，否则触发 307 → CORS 预检失败。

## 项目中受影响的端点

| 层级 | 端点 | 尾部斜杠 | 示例 |
|------|------|---------|------|
| 一层 | `/tasks`、`/contacts`、`/notes`... | **需要** | `/tasks/?page=1` |
| 二层 | `/files/folders` | **不要** | `/files/folders` |
| 二层 | `/finance/budgets` | **不要** | `/finance/budgets?page=1` |
| 二层 | `/finance/subscriptions` | **不要** | `/finance/subscriptions?page=1` |

## 判断方法
使用 OpenAPI 文档查询：
```bash
curl -s 'http://localhost:8000/api/v1/openapi.json' | python3 -c "
import json,sys
d=json.load(sys.stdin)
for p in d['paths']:
    if '/' in p.strip('/'):
        print(p)  # 二层路径（路径中包含多个 /）
"
```

## 易错点
- **不要批量修改**：规则不是"全部去尾斜杠"或"全部保留尾斜杠"，而是按层判断
- 新路由加到二层 prefix 下时，前端调用要去尾斜杠
- Nginx 日志中的 307 是判断是否需要尾斜杠的信号——有 307 就说明路径不对
