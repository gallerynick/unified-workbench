# 一站式工作台 - 客制化指南

## 概述

一站式工作台支持通过配置文件进行客制化，无需修改代码。您可以在 `public/custom/` 目录中放置自定义资源和配置文件。

## 客制化目录结构

```
frontend/public/custom/
├── config.json           # 主配置文件
├── logo-expanded.png     # 侧栏展开时的 Logo（可选）
├── logo-collapsed.png    # 侧栏收起时的 Logo（可选）
└── favicon.ico           # 网站图标（可选）
```

## 配置文件说明

### config.json

这是主配置文件，包含以下配置项：

```json
{
  "app": {
    "name": "一站式工作台",        // 完整名称，显示在侧栏展开时和首页
    "shortName": "工",            // 简短名称，显示在侧栏收起时
    "description": "面向小团队的内网一体化协作与信息管理平台"  // 首页描述
  },
  "branding": {
    "logoExpanded": "/custom/logo-expanded.png",  // 侧栏展开 Logo 路径（null 使用文字）
    "logoCollapsed": "/custom/logo-collapsed.png", // 侧栏收起 Logo 路径（null 使用文字）
    "favicon": "/custom/favicon.ico"               // 网站图标路径（可选）
  }
}
```

### 配置项说明

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `app.name` | string | 否 | 完整应用名称，默认为"一站式工作台" |
| `app.shortName` | string | 否 | 简短名称，默认为"工" |
| `app.description` | string | 否 | 应用描述，默认为"面向小团队的内网一体化协作与信息管理平台" |
| `branding.logoExpanded` | string/null | 否 | 侧栏展开时的 Logo 图片路径，null 则显示文字 |
| `branding.logoCollapsed` | string/null | 否 | 侧栏收起时的 Logo 图片路径，null 则显示文字 |
| `branding.favicon` | string/null | 否 | 网站图标路径 |

## 使用步骤

### 1. 基本客制化（仅修改文字）

1. 在 `frontend/public/custom/` 目录下创建 `config.json` 文件
2. 修改配置项，例如：

```json
{
  "app": {
    "name": "我的团队工作台",
    "shortName": "我",
    "description": "我们团队的专属协作平台"
  }
}
```

3. 重新构建前端或刷新页面即可看到效果

### 2. 添加自定义 Logo

1. 准备 Logo 图片（建议尺寸：高度 32px，宽度自适应）
2. 将图片放入 `frontend/public/custom/` 目录
3. 在 `config.json` 中配置图片路径：

```json
{
  "branding": {
    "logoExpanded": "/custom/logo-expanded.png",
    "logoCollapsed": "/custom/logo-collapsed.png"
  }
}
```

### 3. 完整客制化示例

```json
{
  "app": {
    "name": "ABC公司工作台",
    "shortName": "ABC",
    "description": "ABC公司内部协作与知识管理平台"
  },
  "branding": {
    "logoExpanded": "/custom/logo-full.png",
    "logoCollapsed": "/custom/logo-icon.png",
    "favicon": "/custom/favicon.ico"
  }
}
```

## 注意事项

1. **配置文件格式**：必须是有效的 JSON 格式
2. **图片路径**：相对于 `public/` 目录，以 `/` 开头
3. **缓存**：浏览器可能会缓存配置文件，修改后可能需要强制刷新（Ctrl+F5）
4. **默认值**：如果配置文件不存在或配置项缺失，将使用默认值
5. **图片格式**：支持 PNG、SVG、JPG 等常见格式，推荐使用 PNG 或 SVG

## 常见问题

### Q: 修改配置后没有生效？

A: 请尝试以下步骤：
1. 强制刷新浏览器（Ctrl+F5 或 Cmd+Shift+R）
2. 清除浏览器缓存
3. 确认 config.json 格式正确（可以使用 JSON 验证工具）

### Q: Logo 图片不显示？

A: 请检查：
1. 图片路径是否正确
2. 图片文件是否存在于指定路径
3. 图片格式是否支持

### Q: 如何恢复默认配置？

A: 删除 `public/custom/config.json` 文件即可恢复默认配置。

## 技术说明

客制化系统使用 `useCustomization` Hook 实现，该 Hook 会在应用启动时加载配置文件。如果配置文件不存在或加载失败，将自动使用默认配置。

配置文件位于 `public/custom/` 目录，这意味着：
- 配置文件会被打包到构建产物中
- 可以在不重新构建的情况下修改配置（需要刷新页面）
- 配置文件不会被 Git 跟踪（已在 .gitignore 中排除）
