# CORS 预检失败（OPTIONS 400 / Failed to fetch）

## 问题分类
网络请求 / CORS / 前端路径

## 触发场景
某些管理页面（文件中心、财务中心、密钥中心）打开后显示 "Failed to fetch" 或 "获取失败"。

## 根因
三层根因：

### 层1：OPTIONS 预检 400
浏览器对跨域/同源请求的 CORS 预检（OPTIONS）返回 400，导致后续 GET 请求被阻。

### 层2：二层子路由的 307 重定向
项目中**仅有的三个二层子路由** GET 端点：
- `/api/v1/files/folders`（router prefix `/files` + `@router.get("/folders")`）
- `/api/v1/finance/budgets`
- `/api/v1/finance/subscriptions`

前端 API 调用带了尾部斜杠（如 `/files/folders/`）。FastAPI 对尾部斜杠返回 307 重定向到无斜杠路径。浏览器收到重定向后对目标 URL 重新做 CORS 预检 → 失败。

**一层路由（如 `/tasks/`、`/contacts/`）不受此影响**：FastAPI CORS 中间件直接处理 OPTIONS，不经过路由重定向。

### 层3：Nginx 默认 HTTP/1.0
Nginx 代理 API 请求时默认使用 `proxy_http_version 1.0`。FastAPI CORS 中间件在 HTTP/1.0 下无法正确处理 OPTIONS 预检。直接访问后端（`localhost:8000`）OPTIONS 正常，经 Nginx 后返回 400。

## 修复方案
双重修复：

### 1. 前端修复（files.ts / budgets.ts / subscriptions.ts）
对三个二层子路由去掉尾部斜杠：
```ts
// 修复前
return request('/files/folders/');
return request(`/finance/budgets/${query ? `?${query}` : ''}`);

// 修复后
return request('/files/folders');
return request(`/finance/budgets${query ? `?${query}` : ''}`);
```

### 2. Nginx 修复（shared.conf）
在 `/api` location 块中添加 `proxy_http_version 1.1`：
```nginx
location /api {
    proxy_pass http://backend;
    proxy_http_version 1.1;  # ← 关键修复
    # ... 其他配置
}
```

## 易错点
- **绝对不要批量修改所有 API 的尾部斜杠**！一层路由需要尾部斜杠，只改三个二层子路由
- CORS 预检结果会被浏览器缓存（`access-control-max-age: 600` = 10 分钟），修复后需等待缓存过期或手动清除
- 判断是否为二层子路由：看路由定义是否有两层 prefix（如 `/files` + `/folders`）
