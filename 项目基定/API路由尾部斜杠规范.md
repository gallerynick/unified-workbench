# API 路由尾部斜杠规范

## 问题背景

项目曾多次出现登录后所有 API 请求返回 HTTP 404 的问题。根本原因是前后端路由的尾部斜杠（trailing slash）不一致。

---

## 技术原理

### FastAPI 的 `redirect_slashes` 行为

FastAPI 默认 `redirect_slashes=True`，即：
- 请求 `/api/v1/users` 时，如果路由定义为 `/api/v1/users/`，FastAPI 会返回 **307 Temporary Redirect** 到 `/api/v1/users/`
- 浏览器的 `fetch` API 默认跟随重定向（`redirect: 'follow'`），所以功能上不会报错

**但是**，307 重定向会带来以下问题：
1. **额外的网络往返**：每次不匹配的请求都会多一次 HTTP 往返
2. **POST 请求体丢失风险**：虽然 307 理论上保留方法和体，但某些代理/客户端可能不正确处理
3. **调试困难**：Network 面板中出现大量 307 请求，增加排查难度

### 曾经的错误配置

项目曾设置 `redirect_slashes=False`（在 `main.py` 中），这导致：
- FastAPI 不再自动重定向 `/path` → `/path/`
- 前端发送不带斜杠的请求直接返回 404
- 问题反复出现，每次新增 API 都需要检查斜杠一致性

**教训**：不要禁用 `redirect_slashes`，除非有非常明确的技术理由。

---

## 规范

### 后端路由定义

所有后端路由的 list/create 端点**必须**使用 `"/"` 作为路径：

```python
# ✅ 正确
@router.get("/", response_model=UnifiedResponse[ListResponse])
async def list_items(...):
    ...

@router.post("/", response_model=UnifiedResponse[ItemResponse])
async def create_item(...):
    ...

# ❌ 错误 — 不要使用空字符串
@router.get("", response_model=UnifiedResponse[ListResponse])
async def list_items(...):
    ...
```

### 前端 API 调用

所有前端 API 的 list/create 端点**必须**使用尾部斜杠：

```typescript
// ✅ 正确 — list 端点
return request<ListResponse>(`/items/${query ? `?${query}` : ''}`);

// ❌ 错误 — 缺少尾部斜杠
return request<ListResponse>(`/items${query ? `?${query}` : ''}`);

// ✅ 正确 — create 端点
return request<Item>('/items/', { method: 'POST', body: data });

// ❌ 错误 — 缺少尾部斜杠
return request<Item>('/items', { method: 'POST', body: data });
```

### detail/update/delete 端点

这些端点使用 `/{id}` 格式，**不需要**尾部斜杠：

```typescript
// ✅ 正确
return request<Item>(`/items/${id}`);
return request<Item>(`/items/${id}`, { method: 'PUT', body: data });
return request<null>(`/items/${id}`, { method: 'DELETE' });
```

---

## 检查清单

### 新增 API 端点时

- [ ] 后端 list/create 路由使用 `"/"` 而非 `""`
- [ ] 前端 list 调用使用 `` `/items/${query ? `?${query}` : ''}` ``
- [ ] 前端 create 调用使用 `'/items/'`
- [ ] 前端 detail/update/delete 调用使用 `` `/items/${id}` ``

### 代码审查时

- [ ] 检查所有新增的 `request<...>(...)` 调用是否有尾部斜杠
- [ ] 检查后端 `@router.get/post` 路径是否为 `"/"`

---

## 快速验证命令

```bash
# 检查前端 API 文件中缺少尾部斜杠的 list 端点
grep -n "return request.*\`/[a-z-]*\${" frontend/src/api/*.ts

# 检查前端 API 文件中缺少尾部斜杠的 create 端点
grep -n "'/[a-z-]*', { method: 'POST'" frontend/src/api/*.ts

# 检查后端路由中使用空字符串的端点
grep -n '@router\.\(get\|post\)("")' backend/app/api/*.py
```

---

## 历史问题记录

### 问题 1：`redirect_slashes=False` 导致全局 404

**时间**：2026-06-19  
**原因**：`main.py` 中设置了 `redirect_slashes=False`，导致 FastAPI 不自动重定向  
**修复**：移除该设置，恢复默认行为  
**教训**：不要禁用 FastAPI 的默认行为，除非有明确的技术理由

### 问题 2：前端 API 文件斜杠不一致

**时间**：2026-06-19  
**原因**：部分前端 API 文件使用 `/items${query}` 而非 `/items/${query}`  
**修复**：批量修复所有前端 API 文件，统一使用尾部斜杠  
**教训**：新增 API 时必须检查斜杠一致性

---

## 自动化建议

### ESLint 规则（可选）

可以创建自定义 ESLint 规则，检测前端 API 调用中缺少尾部斜杠的情况：

```javascript
// .eslintrc.js
rules: {
  'no-restricted-syntax': ['warn', {
    selector: 'TemplateLiteral[value=/^\/[a-z-]+\\${/]',
    message: 'API list endpoints should have trailing slash: /items/${query}',
  }],
}
```

### CI 检查（可选）

在 CI 流程中添加检查脚本：

```bash
# check-trailing-slash.sh
#!/bin/bash
if grep -rn "return request.*\`/[a-z-]*\${" frontend/src/api/*.ts; then
  echo "ERROR: Found API calls without trailing slash"
  exit 1
fi
```

---

## 总结

| 场景 | 后端路由 | 前端调用 |
|------|----------|----------|
| List 端点 | `@router.get("/")` | `` `/items/${query ? `?${query}` : ''}` `` |
| Create 端点 | `@router.post("/")` | `'/items/'` |
| Detail 端点 | `@router.get("/{id}")` | `` `/items/${id}` `` |
| Update 端点 | `@router.put("/{id}")` | `` `/items/${id}` `` |
| Delete 端点 | `@router.delete("/{id}")` | `` `/items/${id}` `` |

遵循以上规范，可以避免尾部斜杠导致的 404 问题。
