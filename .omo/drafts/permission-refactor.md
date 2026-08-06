---
slug: permission-refactor
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/permission-refactor.md
approach: 三态 visibility + admin 全权。10 私有模块加 visibility 字段（public/private/restricted），admin 可管理所有人数据。StreamRoom 加 admin 接管 + system.py 补 require_admin。Project 用 JSONB member_ids。
---

# Draft: permission-refactor

## Components (topology ledger)
| id | outcome | status | evidence path |
|----|---------|--------|--------------|
| C1 | DB migration 024: 10张表加 visibility 三字段 | active | — |
| C2 | 10 Models 加 visibility 字段 | active | — |
| C3 | 10 Service 层 list/get 改为 visibility 过滤 + admin 旁路 | active | — |
| C4 | 10 API 层 admin 可改他人数据 | active | — |
| C5 | StreamRoom + system.py 权限补全 | active | — |
| C6 | Frontend: 10 模块加 visibility 选择器 | active | — |
| C7 | StreamRoom 前端管理面板 | active | — |
| C8 | 验证: py_compile + tsc + build + deploy + curl | active | — |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|------------|----------------|-----------|-------------|
| 管理员改他人数据是"改"还是"删"？ | 全部（与 content 模块一致） | 用户已确认"全权管理" | 可 |
| restricted_tags 需要吗？ | 不需要（简化） | restricted_users 足够 | 可 |
| 10模块 visibility 默认值？ | private（现有值） | 不改变现有行为 | 可 |

## Findings (cited)
- Content 模型 visibility 字段模式: `mapped_column(String(20), server_default="private")` — models/content.py:29-35
- visibility.py DB 查询层: `model_cls.visibility == Visibility.PUBLIC` OR 条件 — services/visibility.py:21-41
- Project 无 member 表/字段 — 需新增 `member_ids: JSONB`
- StreamRoom takeover/get 无归属检查 — services/stream_room.py
- system.py 全部端点无认证 — api/system.py

## Decisions
1. **visibility 字段**: 使用 `app.core.visibility.Visibility` 枚举（public/private/restricted）
2. **admin 权限**: service 层 USER_ROLE_ADMIN 判断 → 跳过 owner 过滤
3. **Project member_ids**: JSONB 字段，list UUID
4. **不影响已有模块**: Content/Records/Forms/Votes/Topology 保持不变
5. **Migration 024**: ALTER TABLE ADD COLUMN visibility VARCHAR(20) DEFAULT 'private' NOT NULL + restricted_users JSONB DEFAULT '[]'::jsonb + 10 张表

## Scope IN
- Inventory/Contact/Budget/Subscription/Task/Note/CalendarEvent/Secret/SecretCategory/Template/Reminder: 加 visibility 三字段 + admin 全权
- Project: 加 member_ids JSONB 字段，admin 全权（查看/编辑/删除所有人项目文档），非 admin 仅看自己的 + member_ids 内含自己的
- StreamRoom: admin 可管理任意房间（删除/踢人/接管）
- system.py: 全部端点 require_admin
- StreamRoom REST: 端点仅须认证

## Scope OUT
- Content/Records/Forms/Votes/Topology: 已含 visibility，保持不变
- Announcements: 已含 admin 逻辑，保持原样
- FileShares: 已含 admin 端点 + 公开链接，保持不变
- 不禁用现有功能、不删已有端点、不改 API 路径

## Open questions
- 无

## Approval gate
status: awaiting-approval
