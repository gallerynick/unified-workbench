---
version: alpha
name: ui-design-specification
description: 以内容为核心的界面设计系统。全幅区块交替使用深浅底色，搭配紧凑字距的显示字体与单一交互蓝色。界面框架退居其次，让内容成为主角——无需装饰性渐变、无需阴影装饰，仅在内容图像置于底色表面时使用唯一签名式投影。

colors:
  primary: "#0066cc"
  primary-focus: "#0071e3"
  primary-on-dark: "#2997ff"
  ink: "#1d1d1f"
  body: "#1d1d1f"
  body-on-dark: "#ffffff"
  body-muted: "#cccccc"
  ink-muted-80: "#333333"
  ink-muted-48: "#7a7a7a"
  divider-soft: "#f0f0f0"
  hairline: "#e0e0e0"
  canvas: "#ffffff"
  canvas-parchment: "#f5f5f7"
  surface-pearl: "#fafafc"
  surface-tile-1: "#272729"
  surface-tile-2: "#2a2a2c"
  surface-tile-3: "#252527"
  surface-black: "#000000"
  surface-chip-translucent: "#d2d2d7"
  on-primary: "#ffffff"
  on-dark: "#ffffff"
  # Status colors
  color-success: "#52c41a"
  color-success-bg: "#f6ffed"
  color-success-dark: "#73d13d"
  color-success-bg-dark: "#162312"
  color-warning: "#faad14"
  color-warning-bg: "#fffbe6"
  color-warning-dark: "#d89614"
  color-warning-bg-dark: "#2b2111"
  color-error: "#ff4d4f"
  color-error-bg: "#fff2f0"
  color-error-dark: "#ff7875"
  color-error-bg-dark: "#2a1215"
  color-info: "#1677ff"
  color-info-bg: "#e6f4ff"
  color-info-dark: "#1668dc"
  color-info-bg-dark: "#111d2c"
  # Extended background / text / border tokens
  bg-secondary: "#fafafa"
  bg-secondary-dark: "#141414"
  bg-tertiary: "#f5f5f5"
  bg-tertiary-dark: "#262626"
  text-secondary: "#8c8c8c"
  text-secondary-dark: "#a6a6a6"
  text-tertiary: "#bfbfbf"
  text-tertiary-dark: "#595959"
  border-primary: "#d9d9d9"
  border-primary-dark: "#434343"
  border-secondary: "#f0f0f0"
  border-secondary-dark: "#303030"
  border-tertiary: "#e8e8e8"
  border-tertiary-dark: "#303030"

typography:
  hero-display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.07
    letterSpacing: -0.28px
  display-lg:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0
  display-md:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 34px
    fontWeight: 600
    lineHeight: 1.47
    letterSpacing: -0.374px
  lead:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.14
    letterSpacing: 0.196px
  lead-airy:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 24px
    fontWeight: 300
    lineHeight: 1.5
    letterSpacing: 0
  tagline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 21px
    fontWeight: 600
    lineHeight: 1.19
    letterSpacing: 0.231px
  body-strong:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.24
    letterSpacing: -0.374px
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.47
    letterSpacing: -0.374px
  dense-link:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 2.41
    letterSpacing: 0
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: -0.224px
  caption-strong:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.29
    letterSpacing: -0.224px
  button-large:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 18px
    fontWeight: 300
    lineHeight: 1.0
    letterSpacing: 0
  button-utility:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.29
    letterSpacing: -0.224px
  fine-print:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.0
    letterSpacing: -0.12px
  micro-legal:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: -0.08px
  nav-link:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.0
    letterSpacing: -0.12px
  heading-1:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  heading-2:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  heading-3:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  heading-4:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-xs:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  body-mono:
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  none: 0px
  xs: 5px
  sm: 8px
  md: 11px
  lg: 18px
  pill: 9999px
  full: 9999px
  chip: 4px
  circular: 50%

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 17px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 80px
  content-pad: 24px
  content-pad-sm: 8px
  card-gap: 16px
  section-gap: 16px

shadows:
  sm: "0 1px 2px rgba(0, 0, 0, 0.06)"
  sm-dark: "0 1px 2px rgba(0, 0, 0, 0.2)"
  md: "0 4px 12px rgba(0, 0, 0, 0.08)"
  md-dark: "0 4px 12px rgba(0, 0, 0, 0.3)"
  lg: "0 8px 24px rgba(0, 0, 0, 0.12)"
  lg-dark: "0 8px 24px rgba(0, 0, 0, 0.4)"

zIndex:
  dropdown: 1000
  sticky: 1020
  fixed: 1030
  modal: 1050
  tooltip: 1070

animation:
  fast: 0.15s
  normal: 0.2s
  slow: 0.3s
  ease: ease
  ease-in-out: ease-in-out

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: 11px 22px
  button-primary-focus:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  button-primary-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  button-secondary-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: 11px 22px
  button-dark-utility:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-utility}"
    rounded: "{rounded.sm}"
    padding: 8px 15px
  button-pearl-capsule:
    backgroundColor: "{colors.surface-pearl}"
    textColor: "{colors.ink-muted-80}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.pill}"
    padding: 14px 28px
  button-icon-circular:
    backgroundColor: "{colors.surface-chip-translucent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 44px
  text-link:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.body}"
  text-link-on-dark:
    backgroundColor: transparent
    textColor: "{colors.primary-on-dark}"
    typography: "{typography.body}"
  global-nav:
    backgroundColor: "{colors.surface-black}"
    textColor: "{colors.on-dark}"
    typography: "{typography.nav-link}"
    height: 44px
  sub-nav-frosted:
    backgroundColor: "{colors.canvas-parchment}"
    textColor: "{colors.ink}"
    typography: "{typography.tagline}"
    height: 52px
  content-tile-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.none}"
    padding: 80px
  content-tile-parchment:
    backgroundColor: "{colors.canvas-parchment}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.none}"
    padding: 80px
  content-tile-dark:
    backgroundColor: "{colors.surface-tile-1}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.none}"
    padding: 80px
  content-tile-dark-2:
    backgroundColor: "{colors.surface-tile-2}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.none}"
  content-tile-dark-3:
    backgroundColor: "{colors.surface-tile-3}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.none}"
  utility-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    padding: 24px
  option-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 12px 16px
  option-chip-selected:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  search-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: 12px 20px
    height: 44px
  floating-sticky-bar:
    backgroundColor: "{colors.canvas-parchment}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 64px
    padding: 12px 32px
  hero-quote-card:
    backgroundColor: "{colors.surface-tile-1}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.none}"
    padding: 80px
  footer:
    backgroundColor: "{colors.canvas-parchment}"
    textColor: "{colors.ink-muted-80}"
    typography: "{typography.fine-print}"
    padding: 64px
  # Card & Container
  card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: 1px solid {colors.border-secondary}
    rounded: "{rounded.sm}"
    padding: 16px
  card-hover:
    backgroundColor: "{colors.bg-tertiary}"
    border: 1px solid {colors.border-primary}
  card-grid:
    grid: "repeat(auto-fill, minmax(300px, 1fr))"
    gap: "{spacing.sm}"
  # Modal
  modal:
    backgroundColor: "{colors.canvas}"
    padding: 24px
    rounded: "{rounded.sm}"
    width: 560px
    shadow: "{shadows.md}"
  modal-large:
    backgroundColor: "{colors.canvas}"
    padding: 24px
    rounded: "{rounded.sm}"
    width: 800px
    shadow: "{shadows.md}"
  modal-small:
    backgroundColor: "{colors.canvas}"
    padding: 24px
    rounded: "{rounded.sm}"
    width: 480px
    shadow: "{shadows.md}"
  # Table
  table:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rowHeight: 54px
    cellPadding: 12px 16px
  table-header:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.caption-strong}"
  table-row-hover:
    backgroundColor: "{colors.bg-secondary}"
  # Form Elements
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    border: 1px solid {colors.border-primary}
    rounded: "{rounded.sm}"
    height: 32px
    padding: 4px 11px
  input-focus:
    border: 1px solid {colors.color-info}
    boxShadow: "0 0 0 2px rgba(22, 119, 255, 0.1)"
  input-error:
    border: 1px solid {colors.color-error}
    textColor: "{colors.color-error}"
  textarea:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    border: 1px solid {colors.border-primary}
    rounded: "{rounded.sm}"
    padding: 6px 11px
  select:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    border: 1px solid {colors.border-primary}
    rounded: "{rounded.sm}"
    height: 32px
    padding: 4px 11px
  switch:
    width: 44px
    height: 22px
    backgroundColor: "{colors.divider-soft}"
    activeBackground: "{colors.color-info}"
    rounded: "{rounded.pill}"
  checkbox:
    size: 16px
    border: 1px solid {colors.border-primary}
    activeBackground: "{colors.color-info}"
    rounded: 2px
  radio:
    size: 16px
    border: 1px solid {colors.border-primary}
    activeBackground: "{colors.color-info}"
    rounded: "{rounded.full}"
  slider:
    trackColor: "{colors.color-info}"
    trackHeight: 4px
    thumbSize: 14px
    rounded: "{rounded.full}"
  rate:
    size: 16px
    color: "{colors.color-warning}"
  # Feedback
  alert-success:
    backgroundColor: "{colors.color-success-bg}"
    textColor: "{colors.color-success}"
    borderLeft: 4px solid {colors.color-success}
    typography: "{typography.body-sm}"
  alert-warning:
    backgroundColor: "{colors.color-warning-bg}"
    textColor: "{colors.color-warning}"
    borderLeft: 4px solid {colors.color-warning}
    typography: "{typography.body-sm}"
  alert-error:
    backgroundColor: "{colors.color-error-bg}"
    textColor: "{colors.color-error}"
    borderLeft: 4px solid {colors.color-error}
    typography: "{typography.body-sm}"
  alert-info:
    backgroundColor: "{colors.color-info-bg}"
    textColor: "{colors.color-info}"
    borderLeft: 4px solid {colors.color-info}
    typography: "{typography.body-sm}"
  empty-state:
    textColor: "{colors.text-tertiary}"
    typography: "{typography.body-sm}"
  spin:
    size: 20px
    color: "{colors.color-info}"
  skeleton:
    backgroundColor: "linear-gradient(90deg, {colors.bg-secondary} 25%, {colors.bg-tertiary} 50%, {colors.bg-secondary} 75%)"
    rounded: "{rounded.sm}"
  # Navigation
  sider:
    backgroundColor: "{colors.canvas}"
    width: 240px
    collapsedWidth: 80px
    height: 100vh
    borderRight: 1px solid {colors.border-secondary}
  sider-menu-item:
    height: 40px
    padding: 0 16px
    rounded: "{rounded.sm}"
    typography: "{typography.body-sm}"
  sider-menu-item-active:
    backgroundColor: "{colors.color-info-bg}"
    textColor: "{colors.color-info}"
  sider-menu-item-hover:
    backgroundColor: "{colors.bg-tertiary}"
  header:
    height: 64px
    backgroundColor: "{colors.canvas}"
    borderBottom: 1px solid {colors.border-secondary}
    padding: 0 24px
    position: sticky
    top: 0
    zIndex: 100
  breadcrumb:
    textColor: "{colors.text-secondary}"
    activeColor: "{colors.color-info}"
    separator: "{colors.text-tertiary}"
    typography: "{typography.body-sm}"
  tabs:
    borderBottom: 1px solid {colors.border-secondary}
    activeColor: "{colors.color-info}"
    activeBorderBottom: "2px solid {colors.color-info}"
    typography: "{typography.body}"
  steps:
    textColor: "{colors.text-secondary}"
    currentColor: "{colors.color-info}"
    typography: "{typography.body-sm}"
  timeline:
    dotColor: "{colors.color-info}"
    textColor: "{colors.text-secondary}"
  # Data Display
  badge:
    backgroundColor: "{colors.color-error}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-xs}"
    rounded: "{rounded.pill}"
  badge-dot:
    size: 6px
    rounded: "{rounded.full}"
    backgroundColor: "{colors.color-error}"
  tag:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.ink}"
    typography: "{typography.body-xs}"
    rounded: "{rounded.chip}"
    padding: 2px 8px
  tag-primary:
    backgroundColor: "{colors.color-info-bg}"
    textColor: "{colors.color-info}"
  tag-success:
    backgroundColor: "{colors.color-success-bg}"
    textColor: "{colors.color-success}"
  tag-warning:
    backgroundColor: "{colors.color-warning-bg}"
    textColor: "{colors.color-warning}"
  tag-error:
    backgroundColor: "{colors.color-error-bg}"
    textColor: "{colors.color-error}"
  avatar:
    size: 32px
    rounded: "{rounded.full}"
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text-secondary}"
  avatar-lg:
    size: 48px
  divider:
    height: 1px
    backgroundColor: "{colors.border-secondary}"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-xs}"
    padding: 6px 8px
    rounded: "{rounded.sm}"
    shadow: "{shadows.md}"
  popover:
    backgroundColor: "{colors.canvas}"
    border: 1px solid {colors.border-primary}
    rounded: "{rounded.sm}"
    padding: 12px
    shadow: "{shadows.md}"
  progress:
    trackColor: "{colors.bg-tertiary}"
    fillColor: "{colors.color-info}"
    height: 6px
    rounded: "{rounded.full}"
  description:
    labelColor: "{colors.text-secondary}"
    textColor: "{colors.ink}"
    borderBottom: 1px solid {colors.border-secondary}
    typography: "{typography.body-sm}"
  statistic:
    valueColor: "{colors.ink}"
    valueTypography: "{typography.heading-3}"
    labelColor: "{colors.text-secondary}"
    labelTypography: "{typography.body-sm}"
  scrollbar-thumb:
    width: 8px
    backgroundColor: "rgba(0, 0, 0, 0.15)"
    backgroundColor-dark: "rgba(255, 255, 255, 0.15)"
    rounded: 4px
  scrollbar-thumb-hover:
    backgroundColor: "rgba(0, 0, 0, 0.25)"
    backgroundColor-dark: "rgba(255, 255, 255, 0.25)"
  # Result (403/404/success/error pages)
  result:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    iconSize: 72px
  result-404:
    textColor: "{colors.text-secondary}"
    iconColor: "{colors.color-info}"
  result-403:
    textColor: "{colors.text-secondary}"
    iconColor: "{colors.color-info}"
  # Drawer (slide-out panel)
  drawer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    width: 520px
    bodyPadding: 24px
    shadow: "{shadows.lg}"
  drawer-notification:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    width: 420px
    bodyPadding: 0
    shadow: "{shadows.lg}"
  drawer-mobile-menu:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    width: 250px
    bodyPadding: 0
  # Upload (file upload with drag-and-drop)
  upload-drag:
    backgroundColor: "{colors.bg-tertiary}"
    border: 2px dashed {colors.border-primary}
    rounded: "{rounded.sm}"
    height: 150px
    textColor: "{colors.text-secondary}"
  # Collapse (accordion)
  collapse:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    border: 1px solid {colors.border-secondary}
    itemPadding: 16px
  # Descriptions (description list)
  descriptions:
    labelColor: "{colors.text-secondary}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    borderBottom: 1px solid {colors.border-secondary}
    column: xs 1 / sm 2
  # InputNumber (numeric input)
  input-number:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    border: 1px solid {colors.border-primary}
    rounded: "{rounded.sm}"
    height: 32px
  # DatePicker
  date-picker:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    border: 1px solid {colors.border-primary}
    rounded: "{rounded.sm}"
    height: 32px
  # Tree (hierarchical data)
  tree:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    nodeHeight: 28px
    nodePadding: 0 8px
  # Segmented (segmented control)
  segmented:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    activeColor: "{colors.color-info}"
    activeBg: "{colors.canvas}"
  # List (list display)
  list:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    itemPadding: 12px 16px
    itemBorder: 1px solid {colors.border-secondary}
  # Dropdown (dropdown menu)
  dropdown:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    shadow: "{shadows.md}"
    border: 1px solid {colors.border-primary}
---

# UI 设计规范

## 概述

本设计系统是一套**以内容为核心、界面框架退居其次**的界面语言。每个页面由全幅内容区块堆叠而成——交替使用浅深色画布，每个区块以标题为核心，配以简洁描述文案和蓝色胶囊形交互按钮，辅以高质量内容图像。内容本身即主角。

字体排版自信克制；色彩体系为纯白、暖白（Parchment）或近黑色区块；交互元素仅使用单一蓝色。

信息密度低于常见 SaaS 标准。每个区块约占一屏高度，无装饰性边框——无描边、无渐变、无装饰性框架、无标题阴影。层级仅出现在内容图像置于表面时（唯一一处投影 `rgba(0, 0, 0, 0.22) 3px 5px 30px` 用于赋予视觉重量）。整体效果如同美术馆陈列——墙面退隐，展品成为焦点。

功能型页面（配置器、工具卡片网格）沿用同一骨架但切换模式。配置器引入紧凑的白色工具卡片网格（`{rounded.lg}` 18px 圆角 + 细边框），配以常驻细导航条。深色页面更显编辑化。各页面共享同一套排版系统、间距节奏和单一蓝色强调色——这是一套设计语言在不同体量下的表达。

**核心特征：**

- 内容优先；界面框架退居其次。
- 全幅区块交替使用白/暖白 ↔ 近黑底色，颜色切换本身即为分区线。
- 单一蓝色强调色（`{colors.primary}` — #0066cc）承载所有交互元素，无第二品牌色。
- 两种按钮范式：蓝色胶囊形主按钮（`{rounded.pill}`）和紧凑工具矩形（`{rounded.sm}`）。
- 系统字体族 + 显示字号使用负字距，形成紧凑清晰的标题质感。
- 仅在内容图像需要呼吸时使用唯一一处微柔投影。
- 双层导航：纤细全局导航 + 内容专属毛玻璃子导航，右侧常驻主行动按钮。
- 区块节奏：浅色英雄区 → 深色内容区块 → 浅色工具区 → 深色区块 → 暖白页脚——可预期的节拍。

## 色彩

> **分析来源页面：** 主页、专题页、工具页、配置器页、配件索引页。色彩系统在五个表面完全一致，仅表面模式组合不同。

### 品牌与强调色

- **行动蓝**（`{colors.primary}` — #0066cc）：单一品牌级交互色。所有文本链接、所有蓝色胶囊按钮和焦点环的根源。按下状态通过全局缩放微交互（`transform: scale(0.95)`）切换，而非色值变化。
- **焦点蓝**（`{colors.primary-focus}` — #0071e3）：行动蓝略亮变体，专用于键盘焦点环（`outline: 2px solid`）。
- **浅底亮蓝**（`{colors.primary-on-dark}` — #2997ff）：深色表面上的文本链接和行内强调色，行动蓝在近黑底色上会消失时使用此色。

### 底色

- **纯白**（`{colors.canvas}` — #ffffff）：主导画布。内容区、工具卡片、网格布局。
- **暖白**（`{colors.canvas-parchment}` — #f5f5f7）：标志性浅底色。用于交替浅色区块、页脚区域和工具区默认页面底色。与纯白差异微妙但足以形成节奏。
- **珍珠白**（`{colors.surface-pearl}` — #fafafc）：近白色，用于次级"幽灵"按钮填充——比暖白底色更浅，使按钮在 `{colors.canvas-parchment}` 上仍可读作按钮。
- **近黑区块 1**（`{colors.surface-tile-1}` — #272729）：主页内容网格上的主深色区块表面。
- **近黑区块 2**（`{colors.surface-tile-2}` — #2a2a2c）：微步更亮，用于深色区块直接位于或紧邻区块 1 时，创造最微妙的分离感。
- **近黑区块 3**（`{colors.surface-tile-3}` — #252527）：微步更暗，用于堆栈底部和内嵌视频/播放器框架。
- **纯黑**（`{colors.surface-black}` — #000000）：留予真正的虚空——视频播放器背景、全幅摄影覆盖层、全局导航栏背景。
- **半透明灰芯片**（`{colors.surface-chip-translucent}` — #d2d2d7）：摄影上圆形控制按钮所用的半透明灰色芯片基础色值。生产环境中以约 64% 透明度应用为 `rgba(210, 210, 215, 0.64)`。

### 文本色

- **近黑墨色**（`{colors.ink}` — #1d1d1f）：每个标题、每个正文段落、深色工具按钮填充的墨色。选用近黑而非纯黑，使页面感觉更接近摄影而非印刷。
- **正文**（`{colors.body}` — #1d1d1f）：与 ink 同色值——浅底色上所有文本使用同一个近黑色调。
- **深色正文**（`{colors.body-on-dark}` — #ffffff）：深色区块上和全局导航栏上的所有文本。
- **浅色正文**（`{colors.body-muted}` — #cccccc）：深色区块上纯白过亮时的次级文案。
- **墨色弱 80**（`{colors.ink-muted-80}` — #333333）：珍珠白按钮表面上的正文——比纯黑略柔和。
- **墨色弱 48**（`{colors.ink-muted-48}` — #7a7a7a）：禁用按钮文本和法规模拟文本。

### 描边线

- **分隔浅线**（`{colors.divider-soft}` — #f0f0f0）：次级按钮上的"边框"色——功能上作为环形阴影而非硬线。生产环境中常以 `rgba(0, 0, 0, 0.04)` 应用。
- **发丝线**（`{colors.hairline}` — #e0e0e0）：工具卡片和选项芯片上的 1px 发丝描边。

### 渐变

**无装饰性渐变。** 内容摄影中的大气感（产品渲染的光影、反射）源于图像本身，非 CSS 渐变叠加。深色英雄区使用摄影大气（自然风景、产品静物），但系统未定义渐变 token。

## 字体排版

### 字族

- **显示字体**：`system-ui, -apple-system, BlinkMacSystemFont, sans-serif`——系统字体族，用于 ≥ 19px 的显示场景。定义每个标题的声音。
- **正文 / UI 字体**：`system-ui, -apple-system, BlinkMacSystemFont, sans-serif`——文本优化变体，用于正文、说明文字、按钮和 20px 以下的链接。
- **OpenType 特性**：数字链接（价格表、规格表）启用 `font-variant-numeric: numerator`。显示字号依赖紧凑字距而非上下文连字。

### 层级

| Token | 字号 | 字重 | 行高 | 字距 | 用途 |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 56px | 600 | 1.07 | -0.28px | 英雄标题；标志性紧凑字距标题 |
| `{typography.display-lg}` | 40px | 600 | 1.10 | 0 | 每个内容区块顶部标题 |
| `{typography.display-md}` | 34px | 600 | 1.47 | -0.374px | 分区标题（文本字体族在显示尺寸下） |
| `{typography.lead}` | 28px | 400 | 1.14 | 0.196px | 内容区块次级文案 |
| `{typography.lead-airy}` | 24px | 300 | 1.5 | 0 | 大段段落引言（系统仅存的两个 weight 300 之一） |
| `{typography.tagline}` | 21px | 600 | 1.19 | 0.231px | 次区块标签行；子导航类别名 |
| `{typography.body-strong}` | 17px | 600 | 1.24 | -0.374px | 行内强调 |
| `{typography.body}` | 17px | 400 | 1.47 | -0.374px | 默认段落 |
| `{typography.dense-link}` | 17px | 400 | 2.41 | 0 | 页脚/工具区链接列表（宽松行距） |
| `{typography.caption}` | 14px | 400 | 1.43 | -0.224px | 次级说明文字、按钮文本 |
| `{typography.caption-strong}` | 14px | 600 | 1.29 | -0.224px | 强调说明文字 |
| `{typography.button-large}` | 18px | 300 | 1.0 | 0 | 英雄区主按钮（系统仅存的两个 weight 300 之一） |
| `{typography.button-utility}` | 14px | 400 | 1.29 | -0.224px | 工具/导航按钮标签 |
| `{typography.fine-print}` | 12px | 400 | 1.0 | -0.12px | 细小文字、页脚正文 |
| `{typography.micro-legal}` | 10px | 400 | 1.3 | -0.08px | 微小法律声明 |
| `{typography.nav-link}` | 12px | 400 | 1.0 | -0.12px | 全局导航菜单项 |

### 原则

- **显示字号使用负字距。** 所有 ≥ 17px 的标题均带轻微字距收紧（`-0.12 → -0.374px`），形成标志性紧凑标题节奏。12px 及以下不使用。
- **正文用 17px，非 16px。** 打破 SaaS 惯例，使用 17px 正文。多出的 1 像素赋予页面独特的"阅读而非扫描"节奏。
- **Weight 300 真实存在但罕见。** 有意识用于少量大尺寸文本（`{typography.button-large}` 18px/300 和 `{typography.lead-airy}` 24px/300）。它不是偶然——是用于内容应显轻盈时刻的轻空气感提示。
- **标题用 600，非 700。** 系统标题统一使用 600 字重。700 字重仅在 `{typography.tagline}`（21px）需要稍多断言力时少量使用。
- **行高语境化。** 显示字号使用 1.07–1.19（紧凑）。正文使用 1.47。页脚/工具区链接栈使用异常宽松的 2.41（`{typography.dense-link}`）。2.41 不是缺陷——它使页脚密集链接列得以呼吸。
- **Weight 500 刻意缺失。** 字重阶梯为 300 / 400 / 600 / 700。中等字重一律使用 600。

### 字体替代说明

系统字体族为系统内建字体。跨平台使用时：

- 使用 `system-ui, -apple-system, BlinkMacSystemFont` 作为字体栈首位——在 macOS/iOS/Safari 上解析为系统字体。
- 非原生平台，**Inter**（Google Fonts，变量字体）是最接近的开源替代。Inter 在 weight 600 配合 `font-feature-settings: "ss03"` 可近似系统字体的圆体"a"字。
- 显示字号上将 `letter-spacing` 下调 `-0.01em` 以复刻紧凑标题质感——Inter 默认字距偏宽。
- 正文文本使用 Inter 替代时，行高收紧 `0.03`（从 1.47 → 1.44）——Inter 更高的 x 高度需要更少的行距。

## 布局

### 间距系统

- **基础单元：** 8px。子基础值（2, 4, 5, 6, 7）用于紧凑排版微调；结构性布局对齐至 8/12/16/20/24。
- **Token：** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 17px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px。
- **区块垂直内边距：** `{spacing.section}`（80px）用于内容区块内部；区块全幅堆叠，0 间距（颜色变化提供分隔）。
- **卡片内边距：** `{spacing.lg}`（24px）用于工具网格卡片内部。
- **按钮内边距：** 垂直 8–11px，水平 15–22px。
- **全局节奏常量：** 17px 正文行高倍数（约 25px 行）和 21px 标签字号出现在每个页面中。

### 网格与容器

- **最大内容宽度：** 文本密集区约 980px（大段文字页面），内容网格约 1440px（工具/配件页面），全幅用于内容区块（主页）。
- **列模式：** 工具卡片网格 3–5 列（工具/配件页面）；主页偶发分区使用 2 列并排区块；内容英雄区使用单列居中堆叠。
- **间距：** 工具网格中卡片间距 20–24px。

### 留白哲学

留白即内容的展台。每个区块标题上方至少 64px 留白，下方 48–64px。内容图像永不拥挤——距内容图像最近的内容至少 40px 之外。页脚是唯一打破此规则的区域——那里刻意密集，使完整信息架构一目了然。

## 层级与深度

| 层级 | 处理 | 用途 |
|---|---|---|
| 平 | 无阴影、无描边 | 全幅区块、全局导航、页脚、正文区 |
| 柔发丝 | 1px `rgba(0, 0, 0, 0.08)` 描边 | 工具卡片、子导航毛玻璃分隔线 |
| 背景模糊 | `backdrop-filter: blur(N)` 配合暖白 80% | 子导航和浮动粘性栏 |
| 内容投影 | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0` | 内容图像置于表面（系统中唯一的真正"阴影"） |

**阴影哲学。** 系统使用**仅一处**投影，且仅应用于摄影内容图像——不用于卡片、按钮或文本。UI 层级来自（a）底色变化（浅色区块 ↔ 深色区块）和（b）粘性栏上的背景模糊。唯一投影旨在赋予内容重量，而非 UI 层级。

### 装饰性深度

- **摄影大气**（自然风景摄影）提供情绪感；无 CSS 渐变参与。
- **全幅区块交替**创造节奏而无需描边或阴影——颜色变化本身即分隔。
- **背景模糊**（`{component.sub-nav-frosted}` 和 `{component.floating-sticky-bar}`）创造"悬浮于内容之上"的效果——功能性而非装饰性。

## 形状

### 圆角阶梯

| Token | 值 | 用途 |
|---|---|---|
| `{rounded.none}` | 0px | 全幅内容区块（无圆角） |
| `{rounded.xs}` | 5px | 行内链接作为微妙芯片样式（罕见） |
| `{rounded.sm}` | 8px | 深色工具按钮、行内卡片图像 |
| `{rounded.md}` | 11px | 白色珍珠胶囊按钮 |
| `{rounded.lg}` | 18px | 工具卡片、网格卡片 |
| `{rounded.pill}` | 9999px | 主蓝色胶囊按钮、子导航主按钮、选项芯片、搜索输入——标志性胶囊形 |
| `{rounded.full}` | 9999px / 50% | 摄影上悬浮的圆形控制芯片 |

### 摄影几何

- **英雄图像：** 全幅，主页使用 21:9 或更高比例；环境和工具页面使用 16:9。内容渲染为摄影写实，常拍摄于带色调的表面，该表面成为区块底色。
- **内容渲染：** PNG/WebP 透明通道；置于底色区块上，拾取系统投影。
- **网格卡片：** 1:1 正方形裁切，`{rounded.lg}`（18px）圆角，浅中性底色，内容居中，内部边距 20–40px。
- **英雄区块不圆角图像**——图像全幅矩形。圆角（`{rounded.sm}`、`{rounded.lg}`）仅出现在行内卡片图像上。
- 全断点使用响应式 `srcset` 和 `sizes` 懒加载；CDN 优化的 WebP。

## 组件

### 顶部导航

**`global-nav`**——常驻超纤细黑色导航栏，固定于每页顶部。背景 `{colors.surface-black}`，高度 44px，文本 `{colors.on-dark}` 使用 `{typography.nav-link}`（12px / 400 / -0.12px 字距）。链接克制，间距约 20px，全幅横跨顶部。右侧集群：搜索、购物车图标——始终可见。移动端在约 834px 处折叠为汉堡菜单，标志居中。

**`sub-nav-frosted`**——表面专属导航，固定于全局导航下方。背景 `{colors.canvas-parchment}` 80% 透明度配合背景模糊，创造毛玻璃效果。高度 52px。左侧：类别名（使用 `{typography.tagline}` 21px / 600）。右侧：行内导航链接（`{typography.button-utility}` 14px），以常驻 `{component.button-primary}` 结尾。

### 按钮

**`button-primary`**——标志性行动按钮。背景 `{colors.primary}`（行动蓝 #0066cc），文本 `{colors.on-primary}` 使用 `{typography.body}`（系统字体 17px / 400），圆角 `{rounded.pill}`（全胶囊形），内边距 11px × 22px。全胶囊形半径即品牌行动信号。
- 激活状态：`{component.button-primary-active}`——`transform: scale(0.95)`（系统级微交互）。
- 焦点状态：`{component.button-primary-focus}`——2px 实线 `{colors.primary-focus}` 轮廓。

**`button-secondary-pill`**——当两个蓝色胶囊按钮并列出现时的次按钮。背景透明，文本 `{colors.primary}`，1px 实线 `{colors.primary}` 描边，圆角 `{rounded.pill}`，内边距 11px × 22px。读作"幽灵胶囊"。

**`button-dark-utility`**——全局导航操作（登录、购物车、语言选择器）。背景 `{colors.ink}`（#1d1d1f），文本 `{colors.on-dark}` 使用 `{typography.button-utility}`（14px / 400 / -0.224px 字距），圆角 `{rounded.sm}`（8px），内边距 8px × 15px。激活状态通过 `transform: scale(0.95)` 收缩。

**`button-pearl-capsule`**——内容卡片次按钮。背景 `{colors.surface-pearl}`（#fafafc），文本 `{colors.ink-muted-80}` 使用 `{typography.caption}`（14px），3px 实线 `{colors.divider-soft}` 描边（功能上为柔环而非可见线），圆角 `{rounded.md}`（11px），内边距 8px × 14px。

**`button-hero`**——工具英雄区使用的更大主按钮。与 `{component.button-primary}` 相同的行动蓝 + 纸白，但使用 `{typography.button-large}`（18px / 300——注意罕见 weight 300）和更多内边距（14px × 28px）。在工具首页少量使用。

**`button-icon-circular`**——悬浮于摄影之上。44 × 44px，背景 `{colors.surface-chip-translucent}` 约 64% 透明度，图标 `{colors.ink}`，圆角 `{rounded.full}`。用于轮播控制、关闭按钮和图像内控制（内容图像缩略图）。

**`text-link`**——行内正文链接，使用 `{colors.primary}`（行动蓝）。根据上下文决定是否带下划线。

**`text-link-on-dark`**——深色区块上行内正文链接，使用 `{colors.primary-on-dark}`（浅底亮蓝 #2997ff）——行动蓝在近黑底色上会消失。

### 卡片与容器

**`content-tile-light`**——全幅浅色区块。背景 `{colors.canvas}`（白），文本 `{colors.ink}`，圆角 `{rounded.none}`（0——区块触边），垂直内边距 `{spacing.section}`（80px）。居中堆叠：内容名 `{typography.display-lg}`（40px / 600）→ 一行标签 `{typography.lead}`（28px / 400）→ 两个 `{component.button-primary}` 按钮 → 内容图像置于表面带系统投影。

**`content-tile-parchment`**——与 `{component.content-tile-light}` 相同，但在 `{colors.canvas-parchment}`（#f5f5f7）上。用于打破两个连续白色区块。

**`content-tile-dark`**——全幅深色区块。背景 `{colors.surface-tile-1}`（#272729），文本 `{colors.on-dark}`，圆角 `{rounded.none}`，垂直内边距 `{spacing.section}`（80px）。与浅色区块相同内容堆叠，但行内文案使用 `{component.text-link-on-dark}`，按钮使用 `{component.button-primary}`（行动蓝在深色表面依然可用）。在主页内容网格中用作交替深色带。

**`content-tile-dark-2`**——`{colors.surface-tile-2}`（#2a2a2c）变体。用于深色区块直接位于或紧邻 `{component.content-tile-dark}` 时，通过微步亮度变化创造最微妙的分离。

**`content-tile-dark-3`**——`{colors.surface-tile-3}`（#252527）变体。用于堆栈底部和内嵌视频/播放器框架。

**`utility-card`**——用于工具网格和配件网格。背景 `{colors.canvas}`（白），1px 实线 `{colors.hairline}` 描边，圆角 `{rounded.lg}`（18px），内边距 `{spacing.lg}`（24px）。顶部：产品图像（1:1 裁切，内部图像圆角 `{rounded.sm}` 8px）。下方：名称 `{typography.body-strong}`（17px / 600），价格 `{typography.body}`（17px / 400），`{component.text-link}`。默认无阴影；产品渲染自身携带系统投影。

**`option-chip`**——配置器页面使用的胶囊形可点击单元格。背景 `{colors.canvas}`，文本 `{colors.ink}` 使用 `{typography.caption}`，圆角 `{rounded.pill}`，内边距 12px × 16px。包含小缩略图 + 标签 + 价格差。每行排布 4–5 个选项。

**`option-chip-selected`**——选中状态。描边升级为 2px 实线 `{colors.primary-focus}`。相同形状、相同内容。

**`hero-quote-card`**——特定页面的摄影画布英雄区。深色摄影背景（自然风景或产品静物），`{colors.surface-tile-1}` 作为后备色，居中白色标题 `{typography.display-lg}`（40px），标题上方小图标，下方单个 `{component.button-primary}`。内边距 `{spacing.section}`（80px）。

**`floating-sticky-bar`**——滚动时固定于视口底部的浮动栏。背景 `{colors.canvas-parchment}` 80% 透明度配合 `backdrop-filter: blur(N)`，高度 64px，内边距 12px × 32px。左侧：运行总计 `{typography.body}`。右侧：`{component.button-primary}`。

### 输入与表单

**`search-input`**——搜索输入框。背景 `{colors.canvas}`，文本 `{colors.ink}` 使用 `{typography.body}`（17px），1px 实线 `rgba(0, 0, 0, 0.08)` 描边，圆角 `{rounded.pill}`（全胶囊形——搜索同样采用胶囊形，匹配 CTA 语法），内边距 12px × 20px，高度 44px。前导图标：搜索 glyph 14px，弱化色调。

错误和验证状态在分析页面中未出现。

### 页脚

**`footer`**——背景 `{colors.canvas-parchment}`（#f5f5f7），文本 `{colors.ink-muted-80}`。链接列使用 `{typography.dense-link}`（17px / 400 / 2.41 行高——宽松行距使密集列可扫描）。列标题使用 `{typography.caption-strong}`（14px / 600）。最底部法律行使用 `{typography.fine-print}`（12px / 400），`{colors.ink-muted-48}` 文本。垂直内边距 64px。

## 设计准则

### 应做

- 使用 `{colors.primary}`（行动蓝 #0066cc）处理所有交互元素——链接、胶囊按钮、焦点信号——仅此一种。单一强调色不可妥协。
- 使用 `{typography.hero-display}` 或 `{typography.display-lg}` 排版标题，配合负字距（`-0.28 → -0.374px`）形成标志性紧凑标题节奏。
- 正文使用 `{typography.body}`（17px / 400 / 1.47 / -0.374px）——非 16px。多出的 1 像素定义了阅读节奏。
- 交替 `{component.content-tile-light}`（或暖白）和 `{component.content-tile-dark}` 形成全幅分区节奏。颜色变化即分隔线。
- 将 `{rounded.pill}` 保留给主蓝色 CTA 及任何应读作"行动"的元素（选项芯片、搜索输入、粘性栏 CTA）。
- 将唯一内容投影（`rgba(0, 0, 0, 0.22) 3px 5px 30px`）仅用于置于表面的内容渲染——不用于卡片、按钮或文本。
- 在每个按钮的激活/按下状态使用 `transform: scale(0.95)`——这是系统级微交互。
- 保持全局导航为 `{colors.surface-black}`（纯黑）——这是纯黑在大多数页面上出现的唯一位置。

### 不应做

- 不要引入第二强调色——所有"点击我"信号均为 `{colors.primary}`（行动蓝）。
- 不要给卡片、按钮或文本添加阴影——阴影保留给内容图像。
- 不要将渐变用作装饰性背景——氛围感来自摄影。
- 不要用 500 字重排版正文——系统阶梯为 300 / 400 / 600 / 700，500 刻意缺失。正文始终 400；行内强调 600；显示字号 600。
- 不要给全幅区块添加圆角——区块矩形全幅触边；颜色变化即分隔。
- 不要将正文行高收紧至 1.47 以下——编辑级行距是品牌的一部分。
- 不要混用圆角范式——工具紧凑用 `{rounded.sm}`，工具卡片用 `{rounded.lg}`，胶囊用 `{rounded.pill}`，中间无过渡（除稀有的 `{rounded.md}` 珍珠按钮）。
- 不要在浅色表面上使用 `{colors.primary-on-dark}`（浅底亮蓝）——它是深色区块专属变体。行动蓝用于浅色表面。

## 响应式行为（适用于品牌展示页）

### 断点

| 名称 | 宽度 | 关键变化 |
|---|---|---|
| 小手机 | ≤ 419px | 单列区块；子导航折叠为类别名 + 主 CTA；英雄字号降至 28px |
| 手机 | 420–640px | 单列堆叠；内容渲染缩放至区块宽度 80%；英雄 h1 降至 34px |
| 大屏手机 | 641–735px | 区块过渡为更紧凑内边距（48px 垂直 vs 80px）；细小文字换行 |
| 平板竖屏 | 736–833px | 全局导航折叠为汉堡菜单；子导航隐藏类别芯片，保留主 CTA |
| 平板横屏 | 834–1023px | 全局导航完全展开；3 列工具网格变为 2 列 |
| 小桌面 | 1024–1068px | 内容区块使用 2/3 宽度带边距；英雄 h1 保持 40px |
| 桌面 | 1069–1440px | 完整布局；4–5 列工具网格；1440px 内容最大宽度 |
| 宽屏桌面 | ≥ 1441px | 内容锁定 1440px，边距吸收额外宽度 |

对开发关键的结构断点：1440px（内容锁定）、1068px（小桌面）、833px（平板横屏切换）、734px（平板竖屏）、640px（手机）、480px（小手机）。

### 触摸目标

- 最小 44 × 44px。`{component.button-primary}` 约 44 × 100px（全胶囊形使可见点击区域比标签暗示的更宽裕）。
- `{component.button-icon-circular}` 精确 44 × 44px。
- 全局导航工具链接较小（约 32 × 80px）——它们刻意处于更紧目标，因为是桌面精确操作，移动端在 ≤ 833px 处被汉堡菜单取代。

### 折叠策略

- **全局导航：** 桌面完整水平链接行 → 834px 及以下折叠为标志 + 汉堡菜单 + 购物车图标。
- **子导航：** 类别名 + 行内链接 + 主 CTA → 移动端仅类别名 + 主 CTA；行内链接移入汉堡托盘。
- **内容区块：** 834px 处从 2 列变为 1 列；小手机处垂直内边距从 80px 收紧至 48px。
- **工具网格：** 5 列 → 4 列（1440px）→ 3 列（1068px）→ 2 列（834px）→ 1 列（640px）。
- **英雄字号：** `{typography.hero-display}`（56px）→ `{typography.display-lg}`（40px）在 1068px → 34px 在 640px → 28px 在 419px。

### 图像行为

- 所有内容图像使用响应式 `srcset`，断点匹配裁切。
- 英雄摄影在移动端可能切换构图方向（如环境页面的风景在移动端裁切为更高比例，主体构图不同）。
- 内容渲染在各断点间保持 1:1 或 4:3 宽高比；仅缩放变化。
- 默认懒加载；首屏英雄区优先加载。

## 迭代指南

1. 一次聚焦一个组件。直接引用其 YAML key（`{component.content-tile-dark}`、`{component.search-input}`）。
2. 现有组件的变体（`-active`、`-focus`、`-2`、`-3`）作为 `components:` 下的独立条目。
3. 始终使用 `{token.refs}`——永不内联色值。
4. 不记录 hover。仅默认和激活/按下状态。
5. 显示标题保持系统字体 600 + 负字距。正文保持系统字体 400 17px。边界不可打破。
6. 唯一投影（`rgba(0, 0, 0, 0.22) 3px 5px 30px`）仅保留给内容摄影。
7. 犹豫是否强调时：先交替底色（浅色 → 深色区块），再添加框架。

## 已知缺口

- 表单验证和错误状态在分析页面中未出现；仅记录了中性搜索输入框。
- 主页内嵌视频/播放器框架使用 `{colors.surface-black}`；内部播放器控件未记录（它们是平台组件，非 Web 设计 token）。
- 部分组件图像动态（旋转内容英雄），具体文案随表面变化——组件规格命名结构，非轮换内容。
- 工具和配件工具卡片的深色模式对应体未在分析页面中出现；记录的版本为系统默认浅色调。
- 摄影大气（环境页面自然风景）为内容资产，非设计 token；记录的 `{component.hero-quote-card}` 仅描述结构性表面。
- `{component.sub-nav-frosted}` 和 `{component.floating-sticky-bar}` 的确切背景模糊半径平台依赖；生产 CSS 通常使用 `saturate(180%) blur(20px)` 作为基线，但未正式化为 token。
- 功能型页面（管理后台、配置器、内容管理）的 Sider + Header + Content 布局架构为独立模式，未在原始分析页面中展开；新增的布局章节和侧边栏/表头组件系基于该模式的系统推断。
- 动画与过渡系统仅定义了速度等级和缓动函数，具体到每个组件的 transition-property 与 transform-origin 尚未细化；实际实现需按组件上下文补充。
- 状态样式（hover / focus / disabled / active）除按钮激活状态有 `transform: scale(0.95)` 外，其余组件的状态变体尚未系统化定义；后续需按组件逐一补充。

## 状态色

> **分析来源页面：** 管理后台、配置器、表单页、反馈弹窗。状态色体系在功能型页面中承担语义提示角色——将操作结果、警告与错误信号以直观方式传达。

状态色遵循"轻量底色 + 饱和文字 + 左侧粗边"的统一范式。每种状态定义一组语义角色：成功（绿色）表示操作完成或验证通过；警告（橙色）表示需人工确认的中间状态；错误（红色）表示操作失败或数据异常；信息（蓝色）表示中性提示或操作引导。

- **成功绿**（`{colors.color-success}` — #52c41a）：操作成功、表单验证通过、正向结果提示。浅色背景 `{colors.color-success-bg}`（#f6ffed），深色模式背景 `{colors.color-success-bg-dark}`（#162312），深色模式文字 `{colors.color-success-dark}`（#73d13d）。
- **警告橙**（`{colors.color-warning}` — #faad14）：需确认的操作、即将过期、中间状态提示。浅色背景 `{colors.color-warning-bg}`（#fffbe6），深色模式背景 `{colors.color-warning-bg-dark}`（#2b2111），深色模式文字 `{colors.color-warning-dark}`（#d89614）。
- **错误红**（`{colors.color-error}` — #ff4d4f）：操作失败、表单错误、数据异常。浅色背景 `{colors.color-error-bg}`（#fff2f0），深色模式背景 `{colors.color-error-bg-dark}`（#2a1215），深色模式文字 `{colors.color-error-dark}`（#ff7875）。
- **信息蓝**（`{colors.color-info}` — #1677ff）：中性提示、操作引导、未分类信息。浅色背景 `{colors.color-info-bg}`（#e6f4ff），深色模式背景 `{colors.color-info-bg-dark}`（#111d2c），深色模式文字 `{colors.color-info-dark}`（#1668dc）。

## 阴影系统

> **分析来源页面：** 功能型管理后台页面。阴影系统仅在功能型页面（非品牌展示页）使用——卡片、模态框、下拉面板等悬浮元素通过阴影表达层级。

阴影系统提供三个等级（`sm` / `md` / `lg`），各有浅色与深色模式变体。这些阴影专用于 UI 组件，与品牌展示页的单一内容投影（`rgba(0, 0, 0, 0.22) 3px 5px 30px`）截然不同——品牌展示页不定义阴影 token，仅在内容图像需要呼吸时使用那唯一一处投影。

- **小阴影**（`{shadows.sm}`）：`0 1px 2px rgba(0, 0, 0, 0.06)`，用于工具卡片、行内面板等轻量悬浮元素。深色模式 `{shadows.sm-dark}` 使用 `0 1px 2px rgba(0, 0, 0, 0.2)` 以保持对比度。
- **中阴影**（`{shadows.md}`）：`0 4px 12px rgba(0, 0, 0, 0.08)`，用于模态框、弹出面板等次级悬浮层。深色模式 `{shadows.md-dark}` 使用 `0 4px 12px rgba(0, 0, 0, 0.3)`。
- **大阴影**（`{shadows.lg}`）：`0 8px 24px rgba(0, 0, 0, 0.12)`，用于大型悬浮表面（如大型模态框、抽屉）。深色模式 `{shadows.lg-dark}` 使用 `0 8px 24px rgba(0, 0, 0, 0.4)`。

## 布局架构

> **分析来源页面：** 管理后台、配置器、内容管理页面。功能型页面采用 Sider + Header + Content 的三栏布局架构——区别于品牌展示页的全幅区块堆叠，此架构强调导航常驻与内容区域的明确边界。

- **侧边栏**（`{component.sider}`）：宽度 240px，折叠宽度 80px，高度 100vh（全视口高度），背景 `{colors.canvas}`，右侧 1px `{colors.border-secondary}` 描边。折叠状态下仅显示图标，展开状态显示图标 + 文字标签。
- **表头**（`{component.header}`）：高度 64px，背景 `{colors.canvas}`，底部 1px `{colors.border-secondary}` 描边，内边距 0 × 24px，`position: sticky` 固定于顶部，`zIndex: 100`。承载页面标题、面包屑导航和操作按钮。
- **内容区**：位于侧边栏右侧、表头下方，水平外边距与侧边栏宽度匹配，内部填充使用 `{spacing.content-pad}`（24px）。页面采用 flex column 布局，子元素间使用 `{spacing.section-gap}`（16px）垂直间距。内容卡片使用 `{component.card}`，背景 `{colors.canvas}`，`{rounded.sm}` 圆角，1px `{colors.border-secondary}` 描边，内边距 16px。
- **页面容器模式**：功能页面采用固定框架——左侧 Sider、顶部 Header、右侧下方 Content 区域。Content 区域为 flex column，元素间以 `{spacing.section-gap}` 间隙分隔。卡片网格使用 `{component.card-grid}`，`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`，列间隙 `{spacing.sm}`（12px）。

## 图标规范

> **分析来源页面：** 全项目扫描。所有图标使用 `@ant-design/icons` 图标库，不引入第三方图标或内联 SVG 变体。

- **图标库：** `@ant-design/icons`，统一设计语言。图标均为线性（outlined）风格，2px 描边，24×24px 标准尺寸。
- **图标尺寸：** 导航栏与操作按钮中使用 16px 图标；侧边栏菜单项中使用 20px 图标；表头区使用 16–20px；卡片内嵌图标使用 14–16px。图标尺寸随容器调整，但不突破 24px 上限。
- **图标色彩：** 默认使用 `{colors.text-secondary}`（#8c8c8c），hover 状态提升至 `{colors.ink}`（#1d1d1f），激活状态使用 `{colors.color-info}`（#1677ff）。深色模式下对应切换为 `{colors.text-secondary-dark}` 和 `{colors.on-dark}`。
- **禁用 Emoji。** 严禁在 UI 中使用任何 Emoji 表情符号作为图标——所有图标必须来自 `@ant-design/icons` 库或项目内置 SVG，以确保跨平台、跨浏览器的一致性和专业外观。

## 状态样式

> **分析来源页面：** 管理后台、配置器、表单页。状态样式为组件交互行为的统一约定——hover、focus、disabled、active 四种状态在各类组件间保持一致的行为逻辑。

- **Hover 状态：** 默认状态下按钮背景不变色，hover 时轻微提亮——卡片 hover 使用 `{component.card-hover}`（背景 `{colors.bg-tertiary}`，边框 `{colors.border-primary}`）；按钮 hover 提升亮度但不改变填充色；行内链接 hover 添加下划线或使用 `{colors.color-info}` 替换。
- **Focus 状态：** 键盘焦点统一使用 2px 实线轮廓，主按钮焦点色为 `{colors.primary-focus}`（#0071e3），输入框焦点色为 `{colors.color-info}`（#1677ff），并附加 2px 淡色光晕 `boxShadow: "0 0 0 2px rgba(22, 119, 255, 0.1)"`。
- **Disabled 状态：** 文本颜色切换为 `{colors.text-tertiary}`（#bfbfbf）或 `{colors.ink-muted-48}`（#7a7a7a），背景变为 `{colors.bg-secondary}`，移除所有交互反馈（hover、focus 无效）。按钮和可点击元素在 disabled 状态下保持形状但失去交互能力。
- **Active 状态：** 按钮按下时使用 `transform: scale(0.95)`（系统级微交互）。表单控件 active 状态（如 switch 切换、checkbox 勾选）填充色为 `{colors.color-info}`（#1677ff），表示选中或启用。

## 组件（功能型）

> **分析来源页面：** 管理后台、配置器、内容管理页面。功能型页面组件与品牌展示页组件共享同一套色彩、排版、间距系统，但布局范式不同——采用 Sider + Header + Content 三栏架构。

### 卡片组件

**`card`**——标准内容卡片。背景 `{colors.canvas}`（白），文本 `{colors.ink}`，`{rounded.sm}`（8px）圆角，1px `{colors.border-secondary}` 描边，内边距 16px。卡片内嵌标题使用 `{typography.caption-strong}`（14px / 600），内容文本使用 `{typography.body-sm}`（14px / 400），卡片间距使用 `{spacing.card-gap}`（16px）。

- **悬停态：** `{component.card-hover}`——背景切换为 `{colors.bg-tertiary}`，边框提升为 `{colors.border-primary}`，表示可交互。
- **卡片网格：** `{component.card-grid}`——`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`，列间隙 `{spacing.sm}`（12px），自动适配可用宽度。

### 模态框组件

**`modal`**——标准操作模态框。背景 `{colors.canvas}`，内边距 24px，`{rounded.sm}`（8px）圆角，投影 `{shadows.md}`，默认宽度 560px。模态框头部包含标题（`{typography.caption-strong}`）和关闭按钮，底部包含操作按钮（右侧排列，主按钮 `{component.button-primary}`，次按钮 `{component.button-secondary-pill}`）。高内容模态框设置 `maxHeight: calc(100vh - 200px)`，超出部分自动滚动。

- **大模态框：** `{component.modal-large}`——宽度 800px，用于富文本编辑、复杂表单等需要更大空间的内容。
- **小模态框：** `{component.modal-small}`——宽度 480px，用于确认弹窗、轻量表单等简单操作。

### 表格组件

**`table`**——数据展示表格。背景 `{colors.canvas}`，文本 `{colors.ink}`，行高 54px，单元格内边距 12px × 16px。表格底部使用 1px `{colors.border-secondary}` 描边。分页控件位于表格底部右侧，支持切换每页条数（10 / 20 / 50 / 100）和快捷跳转。

- **表头：** `{component.table-header}`——背景 `{colors.bg-tertiary}`，文本 `{colors.text-secondary}`，使用 `{typography.caption-strong}`（14px / 600）。列标题支持排序，激活排序列显示排序图标（升序 / 降序）。
- **行悬停：** `{component.table-row-hover}`——背景切换为 `{colors.bg-secondary}`，表示行可操作（如点击查看详情）。

### 表单组件

**`input`**——标准输入框。背景 `{colors.canvas}`，文本 `{colors.ink}` 使用 `{typography.body-sm}`（14px），1px `{colors.border-primary}` 描边，`{rounded.sm}`（8px）圆角，高度 32px，内边距 4px × 11px。输入框前可附加图标（如搜索、日历等），图标尺寸 16px，颜色 `{colors.text-secondary}`。

- **聚焦态：** `{component.input-focus}`——描边切换为 `{colors.color-info}`，附加 2px 淡色光晕 `boxShadow: "0 0 0 2px rgba(22, 119, 255, 0.1)"`。
- **错误态：** `{component.input-error}`——描边切换为 `{colors.color-error}`，文本使用 `{colors.color-error}`，下方显示错误提示信息。

**`textarea`**——多行输入框。背景 `{colors.canvas}`，文本 `{colors.ink}` 使用 `{typography.body-sm}`（14px），1px `{colors.border-primary}` 描边，`{rounded.sm}` 圆角，内边距 6px × 11px。高度自适应或设置 `minHeight`，超出部分自动展开。

**`select`**——下拉选择框。与 `{component.input}` 相同的基础样式，右侧附加下拉箭头图标。点击后展开选项列表，选中项在框内显示，未选中项悬停时使用 `{colors.bg-tertiary}` 背景。

**`switch`**——切换开关。宽度 44px，高度 22px，背景 `{colors.divider-soft}`，圆角 `{rounded.pill}`（胶囊形）。关闭状态下圆点位于左侧，开启状态下切换为 `{colors.color-info}` 背景且圆点移至右侧。圆点大小 18px，白色。

**`checkbox`**——复选框。大小 16px，1px `{colors.border-primary}` 描边，选中状态填充 `{colors.color-info}`，圆角 2px。选中后显示白色对勾图标。复选框后跟随标签文本，使用 `{typography.body-sm}`（14px）。

**`radio`**——单选按钮。大小 16px，1px `{colors.border-primary}` 描边，选中状态填充 `{colors.color-info}` 内圆点（直径 6px），圆角 `{rounded.full}`（圆形）。单选按钮组共享同一 `name` 属性，同一组内仅允许选中一项。

**`slider`**——滑块。轨道颜色 `{colors.color-info}`，轨道高度 4px，圆角 `{rounded.full}`。滑块圆点大小 14px，白色背景，悬停时放大至 18px。滑块可单值或双值（范围选择）。

**`rate`**——评分组件。大小 16px，颜色 `{colors.color-warning}`（#faad14）。未选中星为空框，已选中星为实心。支持半星评分（如 3.5 分）。

### 反馈组件

**`alert-success`**——成功提示条。背景 `{colors.color-success-bg}`，文本 `{colors.color-success}`，左侧 4px `{colors.color-success}` 粗边。内边距 8px × 12px，`{rounded.sm}` 圆角，使用 `{typography.body-sm}`（14px）。

**`alert-warning`**——警告提示条。背景 `{colors.color-warning-bg}`，文本 `{colors.color-warning}`，左侧 4px `{colors.color-warning}` 粗边。

**`alert-error`**——错误提示条。背景 `{colors.color-error-bg}`，文本 `{colors.color-error}`，左侧 4px `{colors.color-error}` 粗边。

**`alert-info`**——信息提示条。背景 `{colors.color-info-bg}`，文本 `{colors.color-info}`，左侧 4px `{colors.color-info}` 粗边。

**`empty-state`**——空状态提示。居中对齐，文本 `{colors.text-tertiary}`（#bfbfbf），使用 `{typography.body-sm}`（14px）。常见于表格无数据、搜索结果为空等场景。部分页面自定义空状态图标（如 `<FileOutlined>` 40px），但语义一致。

**`spin`**——加载指示器。大小 20px，颜色 `{colors.color-info}`。页面级 loading 时居中显示，组件级 loading 时叠加于目标内容之上，背景添加半透明遮罩（`rgba(255, 255, 255, 0.5)` 浅色 / `rgba(0, 0, 0, 0.4)` 深色）。

**`skeleton`**——骨架屏。背景使用从 `{colors.bg-secondary}` 到 `{colors.bg-tertiary}` 的线性渐变（90deg），`{rounded.sm}` 圆角。骨架屏在内容加载完成前占位，提供"即将加载"的视觉提示。

### 导航组件

**`sider`**——侧边栏导航。宽度 240px（展开），折叠宽度 80px，高度 100vh（全视口），背景 `{colors.canvas}`，右侧 1px `{colors.border-secondary}` 描边。顶部 Logo 区域高度 64px，下方为菜单列表。

- **菜单项：** `{component.sider-menu-item}`——高度 40px，内边距 0 × 16px，`{rounded.sm}` 圆角，使用 `{typography.body-sm}`（14px）。包含图标（20px）和文字标签。
- **激活态：** `{component.sider-menu-item-active}`——背景 `{colors.color-info-bg}`，文本 `{colors.color-info}`。
- **悬停态：** `{component.sider-menu-item-hover}`——背景 `{colors.bg-tertiary}`。
- 折叠状态下菜单项仅显示图标，激活态通过左侧 3px `{colors.color-info}` 竖条标识。

**`header`**——页面顶栏。高度 64px，背景 `{colors.canvas}`，底部 1px `{colors.border-secondary}` 描边，内边距 0 × 24px，`position: sticky` 固定于顶部，`zIndex: 100`。左侧为折叠按钮（移动端显示汉堡菜单），中间为页面标题（`{typography.heading-4}`），右侧为操作区（通知、用户头像等）。

**`breadcrumb`**——面包屑导航。文本 `{colors.text-secondary}`，当前页面文字 `{colors.color-info}`，分隔符 `{colors.text-tertiary}`，使用 `{typography.body-sm}`（14px）。位于页面标题上方，用于标识当前页面在信息架构中的层级。

**`tabs`**——标签页导航。底部 1px `{colors.border-secondary}` 描边，激活标签文字 `{colors.color-info}`，底部 2px `{colors.color-info}` 下划线。标签间距 32px，使用 `{typography.body}`（17px）。标签内容区域位于标签下方，与标签间无额外间距。

**`steps`**——步骤条。文字 `{colors.text-secondary}`，当前步骤文字 `{colors.color-info}`，已完成步骤图标为白色对勾（`{colors.color-info}` 圆形背景），未开始步骤图标为空圆框。步骤标题使用 `{typography.body-sm}`（14px），步骤描述使用 `{typography.caption}`（14px）。

**`timeline`**——时间轴。圆点颜色 `{colors.color-info}`，文本 `{colors.text-secondary}`，使用 `{typography.body-sm}`（14px）。时间轴用于展示事件序列，每个事件节点包含时间戳和描述文字。

### 数据展示组件

**`badge`**——徽标。背景 `{colors.color-error}`（#ff4d4f），文本 `{colors.on-dark}`，使用 `{typography.body-xs}`（12px），`{rounded.pill}`（胶囊形）。徽标通常叠加于图标右上角，显示未读数或数量。

- **徽标点：** `{component.badge-dot}`——大小 6px，`{rounded.full}`（圆形），背景 `{colors.color-error}`。用于状态指示（在线 / 离线、处理中 / 已完成等）。

**`tag`**——标签。背景 `{colors.bg-tertiary}`，文本 `{colors.ink}`，使用 `{typography.body-xs}`（12px），`{rounded.chip}`（4px）圆角，内边距 2px × 8px。标签常以颜色区分语义：

- **主色标签：** `{component.tag-primary}`——背景 `{colors.color-info-bg}`，文本 `{colors.color-info}`。
- **成功标签：** `{component.tag-success}`——背景 `{colors.color-success-bg}`，文本 `{colors.color-success}`。
- **警告标签：** `{component.tag-warning}`——背景 `{colors.color-warning-bg}`，文本 `{colors.color-warning}`。
- **错误标签：** `{component.tag-error}`——背景 `{colors.color-error-bg}`，文本 `{colors.color-error}`。

**`avatar`**——用户头像。默认大小 32px，`{rounded.full}`（圆形），背景 `{colors.bg-tertiary}`，文本 `{colors.text-secondary}`。头像可为图片（`src` 属性）或首字母图标（`icon` 属性）。头像下方可叠加状态徽标。

- **大头像：** `{component.avatar-lg}`——大小 48px。用于个人资料页面或详情弹窗。

**`divider`**——分隔线。高度 1px，背景 `{colors.border-secondary}`。用于内容区块之间的视觉分隔，或作为列表项之间的边界线。

**`tooltip`**——提示框。背景 `{colors.ink}`（#1d1d1f），文本 `{colors.on-dark}`，使用 `{typography.body-xs}`（12px），内边距 6px × 8px，`{rounded.sm}`（8px）圆角，投影 `{shadows.md}`。提示框在 hover 或点击时显示于目标元素上方，内容简洁（通常不超过一行）。

**`popover`**——弹出层。背景 `{colors.canvas}`，1px `{colors.border-primary}` 描边，`{rounded.sm}`（8px）圆角，内边距 12px，投影 `{shadows.md}`。弹出层用于展示富内容（如操作菜单、快速预览），通过锚点定位，自动避开视口边缘。

**`progress`**——进度条。轨道背景 `{colors.bg-tertiary}`，填充颜色 `{colors.color-info}`，高度 6px，`{rounded.full}`（胶囊形）。进度条用于表示任务完成度或文件上传进度。百分比文字显示于进度条右侧，使用 `{typography.body-xs}`（12px）。

**`description`**——描述列表。标签颜色 `{colors.text-secondary}`，文本颜色 `{colors.ink}`，每行底部 1px `{colors.border-secondary}` 描边，使用 `{typography.body-sm}`（14px）。描述列表用于展示结构化信息（如用户详情、配置项等）。

**`statistic`**——统计数字。数值颜色 `{colors.ink}`，数值使用 `{typography.heading-3}`（20px / 600），标签颜色 `{colors.text-secondary}`，标签使用 `{typography.body-sm}`（14px）。统计数字用于展示关键指标（如活跃用户数、总金额等），数字下方可附加趋势指示（上升 / 下降百分比）。

## 深色模式

> **分析来源页面：** 管理后台页面。深色模式通过 CSS 自定义属性映射浅/深色调，而非定义独立组件——每个状态色、文本色、底色 token 都有对应的 `*-dark` 变体。

- **切换机制：** 通过 CSS 自定义属性（CSS custom properties）映射浅/深色调。每个色彩 token 定义 `*-dark` 变体，深色模式下通过选择器替换为深色变体。切换状态存储于 `localStorage`，并同步到 `html` 元素的 class 属性（如 `dark-mode`）与 `prefers-color-scheme: dark` 媒体查询联动。
- **深色模式色彩映射：** 底色 `{colors.canvas}` → `{colors.bg-secondary-dark}`（#141414），次级 `{colors.bg-secondary}` → `{colors.bg-secondary-dark}`，三级 `{colors.bg-tertiary}` → `{colors.bg-tertiary-dark}`（#262626）。文本 `{colors.ink}` → `{colors.on-dark}`（#ffffff），次级 `{colors.text-secondary}` → `{colors.text-secondary-dark}`（#a6a6a6）。描边 `{colors.border-secondary}` → `{colors.border-secondary-dark}`（#303030），`{colors.border-primary}` → `{colors.border-primary-dark}`（#434343）。
- **选择器模式说明：** 使用 `[data-theme="dark"]` 选择器切换 CSS 自定义属性。每个 token 定义 `var(--xxx)` 和 `--xxx-dark`，深色模式下 `[data-theme="dark"]` 将 `--xxx` 的值替换为 `--xxx-dark` 的值。阴影也映射为深色变体：`{shadows.sm}` → `{shadows.sm-dark}`，`{shadows.md}` → `{shadows.md-dark}`。

## 动画与过渡

> **分析来源页面：** 管理后台、模态框、下拉面板。动画系统提供三个速度等级，配合两种缓动函数，覆盖组件过渡场景。

- **速度等级：** 快（`{animation.fast}` 0.15s）用于 hover 反馈、行内切换等瞬时响应；普通（`{animation.normal}` 0.2s）用于按钮状态切换、输入框焦点过渡；慢（`{animation.slow}` 0.3s）用于模态框打开/关闭、抽屉展开、页面切换等较大幅度的过渡动画。
- **缓动函数：** 使用 `{animation.ease}`（ease）处理简单状态切换；使用 `{animation.ease-in-out}`（ease-in-out）处理双向过渡（如抽屉的展开与收缩）。所有动画使用 CSS `transition` 属性，不依赖 JS 动画库。
- **滚动过渡：** 页面内锚点滚动使用 `scroll-behavior: smooth`，过渡时长自然跟随浏览器默认值（约 500ms），无需自定义 timing function。

## 响应式布局（适用于功能型页面）

> **分析来源页面：** 管理后台、功能型页面。功能型页面的响应式采用三个关键断点——`isMobile`（≤ 768px）、`isTablet`（769–1199px）、`isDesktop`（≥ 1200px）——配合侧边栏折叠与内容区域自适应。

- **断点体系：** 移动端（`isMobile`，≤ 768px）：侧边栏完全隐藏，仅保留顶部表头 + 汉堡菜单；内容区全宽展开。平板端（`isTablet`，769–1199px）：侧边栏为折叠状态（80px 宽度，仅图标），点击后展开为完整侧边栏。桌面端（`isDesktop`，≥ 1200px）：侧边栏完整展开（240px 宽度，图标 + 文字），表头固定，内容区右侧自适应。
- **移动端模式：** 移动端隐藏侧边栏，表头左侧为汉堡菜单图标，点击后侧边栏以抽屉（drawer）形式从左侧滑出，覆盖全屏内容。内容区域宽度全幅，左右内边距 `{spacing.content-pad-sm}`（8px）收紧为紧凑布局。卡片网格在移动端变为单列堆叠。
- **侧边栏折叠行为：** 侧边栏的折叠/展开由 `collapsed` 属性控制，过渡使用 `{animation.slow}`（0.3s）缓动函数。折叠状态下菜单项仅显示图标（20px），展开状态下显示图标 + 文字标签。当前激活项在折叠状态下通过左侧 3px 蓝色竖条（`{colors.color-info}`）标识，展开状态下填充 `{colors.color-info-bg}` 背景。

## 已知缺口（续）

## Message / Notification API

> **分析来源页面：** 全项目扫描。`message` API 是全项目统一的用户反馈机制——不通过 UI 组件直接渲染，而是通过 `message.success()`、`message.error()` 等 API 方法调用，在全屏顶部居中展示临时 Toast 提示。

**API 调用统计：** 全项目共 363 次调用，覆盖 56 个文件。

- **`message.success('操作成功')`**——最多，用于操作成功反馈（"文件已删除"、"提醒创建成功"、"文档已保存"等）。
- **`message.error('操作失败')`**——次多，用于错误处理（后端 `res.msg` 回显或固定提示"操作失败"）。
- **`message.warning('警告信息')`**——较少，用于表单验证（"请输入 XXX"）或状态提醒。
- **`message.info('提示信息')`**——极少，仅 3 处（"已进入编辑模式"、"已切换到场景"、"导出功能开发中"）。

**显示行为：** Toast 出现在视口顶部居中，默认 3 秒后自动消失（可配置）。无自定义 CSS 样式，统一使用 Ant Design 默认的 Toast 外观。

**使用模式：**
- `message.success('操作成功')`
- `message.error(res.msg || '操作失败')`
- `try { ... } catch { message.error('操作失败'); }`
- `if (!xxx.trim()) { message.warning('请输入 XXX'); return; }`

## 组件（功能型 — 其他）

### Result 组件

**`result`**——结果页展示。图标大小 72px，文字 `{colors.ink}`，使用 `{typography.body}`（17px）。Result 页不依赖额外 token——使用 Ant Design 默认布局。

- **`result-403`**——权限不足页。共 5 处使用（NotificationConfig, BackupManagement, TagManagement, DeviceManagement, UserManagement），统一模式：`status="403"` + `title="权限不足"` + 副标题"只有管理员可以XXX" + `<LockOutlined />` 图标。
- **`result-404`**——页面不存在页。2 处使用（NotFound, TestModePage），`status="404"` + `title="页面不存在"` + `<FileTextOutlined />` 或自定义图标。

### Drawer 组件

**`drawer`**——抽屉面板，从屏幕右侧或左侧滑出，不替换当前页面。背景 `{colors.canvas}`，内边距 24px，宽度 520px，投影 `{shadows.lg}`。抽屉头部包含标题和关闭按钮，内容区域自动滚动。

- **`drawer-notification`**——通知中心抽屉。宽度 420px，内边距 0（由内容自行管理），头部右侧包含"全部已读"操作按钮（`<CheckOutlined />` 图标），展示 WebSocket 实时通知列表，支持未读高亮、时间戳、单项标记已读。
- **`drawer-mobile-menu`**——移动端菜单抽屉。宽度 250px，内边距 0，仅移动端（`isMobile`）展示，包含自定义 header（logo + 应用名）和完整菜单列表。

### Upload 组件

**`upload-drag`**——文件上传拖拽区。背景 `{colors.bg-tertiary}`，2px dashed `{colors.border-primary}` 描边，`{rounded.sm}`（8px）圆角，高度 150px。内含上传图标（`<InboxOutlined />`）和提示文字。

**FileUploadModal 上传配置：**
- 单文件限制（`maxCount: 1`, `multiple: false`）
- 文件类型校验（`beforeUpload`）：图片（jpeg/png/gif/webp）、文档（pdf/doc/docx/xls/xlsx/ppt/pptx）、文本（txt/csv）、压缩包（zip/rar），单文件最大 50MB
- 带进度条上传（Progress 组件显示百分比）
- 附件元数据：visibility（可见性）、folder_id、restricted_users、restricted_tags、expires_at

### Collapse 组件

**`collapse`**——折叠面板，用于可折叠内容区块。背景 `{colors.canvas}`，`{rounded.sm}` 圆角，1px `{colors.border-secondary}` 描边，内边距 16px。

**实际使用场景：** CategoryDetail 页面（密钥分类折叠展示），密钥分组以折叠面板形式展示，每组展开后显示该分类下的所有密钥条目。

### Descriptions 组件

**`descriptions`**——描述列表，用于展示结构化键值对信息。标签颜色 `{colors.text-secondary}`，文本颜色 `{colors.ink}`，使用 `{typography.body-sm}`（14px），每行底部 1px `{colors.border-secondary}` 描边。

**实际使用场景：**
- ProjectInfoTab：`bordered column={{ xs: 1, sm: 2 }}`——项目信息详情，响应式列布局（移动端单列，桌面端双列），有边框。
- Profile：`column={{ xs: 1, sm: 2 }} bordered size="small"`——个人资料详情，小尺寸。

### InputNumber 组件

**`input-number`**——数字输入框。基础样式与 `{component.input}` 一致，右侧附加上下箭头按钮用于微调。

**实际使用场景：** FinanceManagement（金额输入）、InventoryManagement（数量输入）、BackupManagement（备份周期）、StreamStudio（码率/帧率配置），默认 32px 高度，`{rounded.sm}` 圆角。

### DatePicker 组件

**`date-picker`**——日期选择器。基础样式与 `{component.input}` 一致，右侧附加日历图标。点击后展开日历面板，支持单选日期或日期范围。

**实际使用场景：** ReminderFormModal（提醒日期）、FolderSettingsModal（过期时间）、FileUploadModal（过期时间）、UserManagement（账户过期），默认 32px 高度。

### Tree / TreeSelect 组件

**`tree`**——树形控件，用于展示层级结构数据。背景 `{colors.canvas}`，节点高度 28px，节点内边距 0 × 8px，使用 `{typography.body-sm}`（14px）。

**`tree-select`**——树形下拉选择器，结合 Select 和 Tree 功能。点击后展开树形结构，支持搜索和层级展开/折叠。

**实际使用场景：** FolderTree（文件夹树形导航）、NoteManagement（笔记分类树）、FileUploadModal（目标文件夹选择），支持拖拽排序和右键菜单。

### Segmented 组件

**`segmented`**——分段控制器，用于在同一行展示多个互斥选项。背景 `{colors.bg-tertiary}`，选项文字 `{colors.text-secondary}`，使用 `{typography.body-sm}`（14px），`{rounded.sm}` 圆角，选中项文字 `{colors.color-info}`，背景 `{colors.canvas}`。

**实际使用场景：** UserPersonalization（个性化设置选项切换）、NoteManagement（笔记视图切换：列表/树形/图）。

### List 组件

**`list`**——列表展示组件。背景 `{colors.canvas}`，文本 `{colors.ink}`，使用 `{typography.body-sm}`（14px），列表项内边距 12px × 16px，项间使用 1px `{colors.border-secondary}` 分隔线。

**实际使用场景：** 通知中心、日历小部件、公告小部件、侧边栏管理、模板选择器、投票详情、密钥详情等，支持头像 + 标题 + 描述的标准项布局。

### Dropdown 组件

**`dropdown`**——下拉菜单，点击或悬停时显示操作列表。背景 `{colors.canvas}`，1px `{colors.border-primary}` 描边，`{rounded.sm}` 圆角，投影 `{shadows.md}`，内边距 12px，菜单项内边距 8px × 12px。

**实际使用场景：** MainLayout（用户头像下拉菜单）、FormManagement（表单操作菜单）、ExportButtons（导出格式选择菜单），支持图标 + 文字的组合菜单项。

### 动画 Keyframes（项目实际定义）

> **分析来源页面：** 全项目 CSS 扫描。以下为项目中实际定义的 `@keyframes` 动画，供组件动画参考。

| 动画名称 | 时长 | 缓动 | 效果 |
|---------|------|------|------|
| `widgetFadeUp` | 350ms | ease-out | 首页小部件淡入，6 个元素各延迟 100ms 交错入场 |
| `loginCardOut` | 400ms | ease-in | 登录卡片淡出 + scale(1.05) 放大 |
| `menuItemFlyIn` | 300ms | ease-out | 菜单项从左侧模糊飞入（translateX(-16px) → 0，blur(6px) → 0） |
| `routeFadeIn` | 300ms | ease-out | 路由切换淡入（translateY(8px) → 0） |
| `appFloatIn` | 500ms | ease-out | 登录后整个应用从下方浮入（translateY(24px) → 0） |

### 滚动条样式（项目实际定义）

> **分析来源页面：** `global.css` 全局定义。

- **主滚动条：** 宽度 8px，高度 8px，轨道透明，滑块 `rgba(0, 0, 0, 0.15)` 圆角 4px，悬停 `rgba(0, 0, 0, 0.25)`。深色模式：滑块 `rgba(255, 255, 255, 0.15)`，悬停 `rgba(255, 255, 255, 0.25)`。
- **侧边栏滚动条：** 宽度 6px，滑块 `rgba(0, 0, 0, 0.1)`，圆角 3px，悬停 `rgba(0, 0, 0, 0.2)`。深色模式：悬停 `rgba(255, 255, 255, 0.2)`。
- **Firefox 兼容：** `scrollbar-width: thin`, `scrollbar-color: rgba(0, 0, 0, 0.15) transparent`。