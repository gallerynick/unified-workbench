# stream-room-refactor - Work Plan

## TL;DR (For humans)

**What you'll get:** 直播间系统 — 创建房间后获得固定推流地址（内置 WHIP + 外部 RTMP），可切换推流模式，支持临时/常驻房间，推流冲突时新用户可接管，临时房间 30 分钟不活跃自动清理。

**Why this approach:** 房间 ID 即推流密钥，不需要随机生成；per-room config 替代全局配置，每个房间独立可控；使用 MediaMTX 内置 API 查询状态（轮询）而非 webhook 回调，降低复杂度。

**What it will NOT do:** 不持久化场景配置（保持 in-memory），不做录像回放聊天，不做邀请列表管理（只用开放/关闭开关）。

**Effort:** Large (22 todos, 8 waves)
**Risk:** Medium — 破坏性变更（旧 stream key API 废弃），但数据量小，影响可控
**Decisions to sanity-check:** 推流冲突为新用户接管（确认过），权限用 is_open 开关（不做精细邀请），MediaMTX 状态检测用 API 轮询（不做 webhook）

Your next move: 批准后即可执行。 Full execution detail follows below.

---

> TL;DR (machine): <1 line - effort, risk, deliverables>

## Scope
### Must have
- StreamRoom 模型：id(UUID), name, creator_id, mode(builtin/external), room_type(temporary/permanent), config(JSONB), is_open, last_active_at, created_at
- 房间 ID = 推流密钥。URL：`/{room_id}/whip`(内置推流)、`rtmp://host:1935/{room_id}`(外部推流)、`/{room_id}`(观看)
- 房间 CRUD API + 权限控制（is_open 控制谁可推流/观看）
- 推流冲突：新用户接管，被踢用户收到 WebSocket 通知
- 临时房间 30min 不活跃自动删除（Celery Beat 每 5min 扫描）
- Per-room 配置（JSONB config 字段，含 bitrate/resolution/fps/audio 子集）
- 推流模式切换：builtin 显示 Studio + 配置面板，external 仅显示 RTMP URL
- 房间列表页：创建者/活跃状态/打开/临时或常驻/推流/观看地址
- 旧 stream_keys 体系删除，/stream/key 返回 deprecated

### Must NOT have
- 场景配置 per-room 持久化 — 保持当前 in-memory 模式
- 录像/回放/聊天 — scope out
- MediaMTX 外置认证钩子 — 权限通过后端 API 层控制
- 邀请列表管理 — is_open 布尔值即可
- 全局 stream_config 的向后兼容 — 彻底替换为 per-room config

## Verification strategy
- Test decision: none (no test infra in project)
- Agent-executed QA: API curl + Browser Playwright verification
- Evidence: .omo/evidence/task-<N>-stream-room-refactor.md

## Execution strategy
### Waves (8 waves, 22 todos)
- **Wave 1**: Model + Migration (todo 1-2)
- **Wave 2**: Backend Room API (todo 3-6) — parallelizable after Wave 1
- **Wave 3**: Frontend API Client + Types (todo 7) — after Wave 2
- **Wave 4**: Frontend Room List Page (todo 8-10) — after Wave 3
- **Wave 5**: StreamStudio Room Integration (todo 11-14) — after Wave 4
- **Wave 6**: StreamWatch + Nginx Update (todo 15-16)
- **Wave 7**: Celery Cleanup + Deprecation (todo 17-19) — after Wave 2 (todos 17-18), Wave 5 (todo 19)
- **Wave 8**: Cleanup + Final QA (todo 20-22)

### Dependency matrix
| Todo | Depends on | Blocks |
|------|-----------|--------|
| 1 | - | 2,3,4 |
| 2 | 1 | 3,4 |
| 3 | 1,2 | 5,7 |
| 4 | 1,2 | 5,6,7 |
| 5 | 3,4 | 8,11 |
| 6 | 4 | 11,15 |
| 7 | 5 | 8,11 |
| 8 | 5,7 | 9,10,11 |
| 9 | 8 | - |
| 10 | 8 | - |
| 11 | 5,6,7,8 | 12,13,14 |
| 12 | 11 | - |
| 13 | 11 | - |
| 14 | 11 | - |
| 15 | 6,11 | - |
| 16 | 15 | - |
| 17 | 2 | - |
| 18 | 8 | - |
| 19 | 11 | - |
| 20-22 | 1-19 | - |

## Todos
<!-- APPEND TASK BATCHES BELOW THIS LINE -->
- [ ] 1. 创建 StreamRoom 模型
  What to do: 在 backend/app/models/stream_room.py 创建 StreamRoom 模型：
  - id: UUID PK default gen_random_uuid
  - name: String(100) NOT NULL
  - creator_id: UUID FK->user.id NOT NULL
  - mode: Enum('builtin','external') NOT NULL default 'builtin'
  - room_type: Enum('temporary','permanent') NOT NULL default 'permanent'
  - config: JSONB nullable（per-room 配置：bitrate/resolution/fps/audio_*）
  - is_open: Boolean default true
  - is_active: Boolean default false（当前是否有人推流）
  - pusher_id: UUID nullable（当前推流者 user_id）
  - last_active_at: DateTime nullable
  - created_at: DateTime server_default=func.now()
  Must NOT do: 不要创建 invite list 表，不要创建 scene 持久化表
  References: backend/app/models/user.py (UUID/FK pattern), backend/app/models/topology.py
  QA: python -c "from app.models.stream_room import StreamRoom; print('OK')"
  Commit: Y | feat(backend): add StreamRoom model

- [ ] 2. Alembic migration: stream_room table + cleanup old config
  What to do: 创建 migration 018_stream_room.py：
  - CREATE TABLE stream_room (include indexes on creator_id, room_type)
  - DELETE from system_config where key in ('stream_keys','stream_config') — 清除旧随机密钥和全局配置
  Must NOT do: 不要做数据迁移（不把旧 key 转成新 room）
  References: backend/alembic/versions/017_rename_topology_type_to_category.py (template format)
  QA: docker compose exec backend alembic current (verify 018 applied)
  Commit: Y | feat(backend): add stream_room migration, deprecate old stream config

- [ ] 3. 创建 Pydantic schemas（含 StreamRoomConfig）
  What to do: 创建 backend/app/schemas/stream_room.py：
  - StreamRoomConfig(BaseModel): default_bitrate(int), default_resolution(str), default_fps(int), audio_sample_rate(int), audio_channels(int), audio_processing_mode(str), audio_noise_suppression(bool), audio_echo_cancellation(bool), audio_auto_gain_control(bool), audio_highpass_freq(int), audio_compressor_threshold(int), audio_compressor_ratio(int), audio_limiter_threshold(int), audio_output_gain(float) — 与现有的 StreamConfigUpdate 字段对齐
  - StreamRoomCreate(name, mode, room_type, is_open, config: StreamRoomConfig|None)
  - StreamRoomUpdate(name, mode, room_type, is_open, config: StreamRoomConfig|None)
  - StreamRoomResponse: 同前 + pusher_nickname(str) — 从 user 表 JOIN 获取
  - StreamRoomListResponse(items, total)
  Must NOT do: 不要包含 stream_key/push_url 作为请求字段（由后端构造 URL）
  References: backend/app/schemas/topology.py, backend/app/schemas/auth.py, backend/app/api/stream.py:StreamConfigUpdate (字段参考)
  QA: from app.schemas.stream_room import StreamRoomConfig; print(StreamRoomConfig(default_bitrate=8000, default_resolution="1920x1080", default_fps=30))
  Commit: Y | feat(backend): add StreamRoom schemas

- [ ] 4. 创建 Room Service 业务层
  What to do: 创建 backend/app/services/stream_room.py：
  - create_room(db, user_id, data) → StreamRoom
  - get_room(db, room_id) → StreamRoom
  - list_rooms(db, user_id, filters) → list[StreamRoom]（支持按 room_type/mode/is_open 筛选）
  - update_room(db, room_id, user_id, data) → StreamRoom（仅 owner 可改）
  - delete_room(db, room_id, user_id) → None（仅 owner 可删）
  - get_room_urls(room_id, host) → {push_url, watch_url, rtmp_url}:
    - builtin push: http://{host}:8889/{room_id}/whip
    - external push: rtmp://{host}:1935/{room_id}
    - watch: http://{host}:8889/{room_id}
  - check_room_active(db, room_id) → bool（查询 MediaMTX API /v3/paths/list 判断活跃）
  - takeover_room(db, room_id, new_user_id) → void:
    使用 SELECT ... FOR UPDATE 行锁防止竞态，更新 pusher_id，调用 mediamtx.kick_path(room_id) 踢旧流，
    发送 WS 通知给旧推流者（type=room_kicked）
  Must NOT do: 不要在 service 层直接操作 Redis 或 WebSocket（通过独立模块调用）
  References: backend/app/services/auth.py (DB pattern), backend/app/services/topology.py
  QA: from app.services.stream_room import create_room; print('OK')  # service 层导入验证
  Commit: Y | feat(backend): add stream room service layer

- [ ] 5. 创建 Room API 路由
  What to do: 创建 backend/app/api/stream_room.py：
  - POST /stream/rooms — 创建房间
  - GET /stream/rooms — 列出房间（可选 ?room_type=temporary&mode=builtin）
  - GET /stream/rooms/{id} — 房间详情（含 push_url/watch_url/rtmp_url）
  - PUT /stream/rooms/{id} — 更新房间
  - DELETE /stream/rooms/{id} — 删除房间
  - POST /stream/rooms/{id}/takeover — 接管推流（当前用户替换 pusher_id）
  - GET /stream/rooms/{id}/status — 返回 is_active + pusher nickname
  注册到 backend/app/api/router.py
  Must NOT do: 不要暴露 room_id 作为路径参数以外的 URL 段（/stream/rooms 足够）
  URL 构造的 host: 从 Request 对象获取（`request.base_url.hostname`），优先用 `x-forwarded-host` header（Nginx 代理场景）
  References: backend/app/api/auth.py (router pattern), backend/app/api/stream.py (_get_host pattern)
  QA: curl -X POST localhost:8000/api/v1/stream/rooms -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"test","mode":"builtin","room_type":"permanent","is_open":true}'
  Commit: Y | feat(backend): add stream room API routes

- [ ] 6. 创建 MediaMTX 集成服务
  What to do: 创建 backend/app/services/mediaintx.py：
  - get_active_paths() → list[str]（GET http://mediamtx:9997/v3/paths/list → 解析活跃 path 列表）
  - is_path_active(room_id) → bool（检查 {room_id} 是否在活跃 path 中）
  - kick_path(room_id) → void（DELETE http://mediamtx:9997/v3/paths/{room_id}）
  用于：room_active 检测 + takeover 踢旧流
  Must NOT do: 不要实现 webhook receiver（Mediamtx 回调），用轮询替代
  References: backend/app/services/updater.py (httpx pattern)
  QA: docker compose exec backend python -c "import httpx; r=httpx.get('http://mediamtx:9997/v3/paths/list'); print(r.status_code)"
  Commit: Y | feat(backend): add mediamtx integration service

- [ ] 7. 更新前端 API Client + Types
  What to do: 更新 frontend/src/api/stream.ts 和 frontend/src/types/stream.ts：
  - 新增类型：StreamRoom, StreamRoomCreate, StreamRoomUpdate, StreamRoomListResponse
  - 新增函数：createRoom, listRooms, getRoom, updateRoom, deleteRoom, takeoverRoom, getRoomStatus
  - StreamConfig 类型保留但标记 @deprecated
  MUST NOT: 不要删除旧函数 getStreamKey/resetStreamKey（标记 deprecated，后续清理）
  References: frontend/src/api/auth.ts (API pattern), frontend/src/types/user.ts, frontend/src/api/stream.ts
  QA: import { createRoom } from '@/api/stream'; console.log(typeof createRoom) → 'function'
  Commit: Y | feat(frontend): add room API client + types

- [ ] 8. 创建房间列表页 RoomListPage
  What to do: 创建 frontend/src/pages/streaming/RoomListPage.tsx：
  - 列表展示：房间名/创建者/模式(内置|外部)/类型(临时|常驻)/活跃状态(绿色圆点)/开关
  - 操作：创建房间按钮（弹出 Modal）、进入房间、删除房间
  - 搜索/筛选：按名称搜索、按模式/类型/状态筛选
  - 使用 Ant Design Table + Tag + Badge
  - 路由：/streaming/rooms（在侧边栏"直播工作室"下）
  Must NOT do: 不要在这个页面嵌入推流功能（推流在房间详情页）
  References: frontend/src/pages/topology/TopologyManagement.tsx (list pattern)
  QA: Playwright screenshot of room list with at least 1 room
  Commit: Y | feat(frontend): add room list page

- [ ] 9. 创建房间创建 Modal
  What to do: 在 frontend/src/components/streaming/ 创建 CreateRoomModal.tsx：
  - 表单：房间名称(Input)、推流模式(Radio: 内置/外部)、房间类型(Radio: 临时/常驻)、开放访问(Switch)
  - 外部模式提示："使用外部推流工具（如 OBS）填入 RTMP 地址即可推流"
  - 临时房间提示："非活跃状态 30 分钟后自动删除"
  Must NOT do: 不要包含场景配置（scope out）
  References: frontend/src/components/VotePopup.tsx (Modal pattern)
  QA: Playwright: open modal → fill form → submit → verify room appears in list
  Commit: Y | feat(frontend): add create room modal

- [ ] 10. 创建房间详情/设置组件
  What to do: 创建 frontend/src/components/streaming/RoomDetail.tsx：
  - 显示：推流地址（可复制按钮）、RTMP 地址（外部模式）、观看地址
  - 内置模式：显示"进入推流工作室"按钮 → 跳转 StreamStudio
  - 外部模式：显示 OBS 设置指南文本
  - 设置面板（owner 可见）：修改名称/类型/开关/config（bitrate/resolution/fps）
  - 活跃状态指示器 + 当前推流者名称
  Must NOT do: 不要在此组件做推流（只是一个枢纽页面）
  References: frontend/src/pages/settings/SiteSettings.tsx (settings form pattern)
  QA: Playwright: view room detail → copy push URL → verify clipboard
  Commit: Y | feat(frontend): add room detail component

- [ ] 11. 重构 StreamStudio 适配房间
  What to do: 修改 frontend/src/pages/streaming/StreamStudio.tsx：
  - 从路由参数获取 roomId（/streaming/studio/:roomId）
  - onMount 加载房间 config → 设置 streamResolution/Fps/Bitrate/audioConfig
  - pushUrl 使用 `http://{host}:8889/{roomId}/whip`
  - 移除 loadSettings 中 getStreamKey/getStreamConfig 调用 → 替换为 getRoom(id)
  - 移除 streamKey/重置密钥相关 state 和 UI（setStreamKey/setPushUrl）
  - 移除 settingsModal 中的旧全局配置 → 替换为 per-room config 保存
  - 保存设置时调用 updateRoom 而非 updateStreamConfig
  - 推流时设置 room.is_active=true，停止时设置 false
  MUST NOT: 不要改动 WHIP client、Canvas 合成、音频混合逻辑
  References: StreamStudio.tsx:64-191 (state init), StreamStudio.tsx:155-191 (loadSettings), StreamStudio.tsx:424-443 (startStream)
  QA: Playwright: create room → enter studio → verify URL has roomId → start streaming → verify active indicator
  Commit: Y | refactor(frontend): adapt StreamStudio for room-based streaming

- [ ] 12. 添加推流模式切换 UI
  What to do: 在 StreamStudio 页面顶部添加模式指示器：
  - 内置模式：显示完整 Studio（场景编辑 + 配置面板 + 推流按钮）
  - 外部模式：隐藏场景编辑器 + 配置面板，显示 RTMP 地址（不可编辑 + 复制按钮）+"请在 OBS 中填入此地址推流"+ 观看链接
  - 模式由 room.mode 决定（不可在 Studio 内切换，需回房间设置）
  Must NOT do: 不要在推流进行中允许切换模式
  References: StreamStudio.tsx:122-148 (settingsModal), StreamStudio.tsx:580- (设置面板 JSX)
  QA: Playwright: external mode room → verify no scene editor, only RTMP URL
  Commit: Y | feat(frontend): add stream mode toggle UI

- [ ] 13. 添加推流冲突接管 UI
  What to do: 在 StreamStudio 中添加冲突处理：
  - startStream 前 checkRoomStatus → 如果 is_active=true 且 pusher_id≠当前用户 → 弹出 Modal："房间正在由 {pusher_nickname} 推流中。是否接管推流？接管后原推流者将被停止。"
  - 用户确认 → 调用 takeoverRoom → 后端 kick 旧流 + 更新 pusher_id + 发 WS 通知
  - 被踢用户收到 WS 通知 → 页面弹出 "推流已被 {new_user} 接管" → 停止当前推流
  - 非冲突情况（房间空闲）：直接开始推流
  Must NOT do: 不要在 room 页面做冲突处理（只在推流按钮处）
  References: StreamStudio.tsx:424 (startStream), backend/app/api/ws.py (WebSocket)
  QA: 两个 Playwright browser context 同时测试：ctx1 登录 user A → 推流 → ctx2 登录 user B → 点击推流 → 弹窗出现 → 确认接管 → ctx1 收到 room_kicked notification
  Commit: Y | feat: add push conflict takeover with WebSocket notification

- [ ] 14. 注册 WebSocket 房间事件通知
  What to do: 扩展 WebSocket 系统支持流媒体事件：
  - 新增消息类型 type="room_kicked"（含 room_id, kicked_by 字段）
  - backend/app/services/stream_room.py takeover_room() 中发送 WS 通知给旧 pusher
  - frontend hooks/useWebSocket.ts 中处理 room_kicked 事件 → 暴露给 StreamStudio 使用
  Must NOT do: 不要改变现有 notification 消息格式
  References: backend/app/api/ws.py (消息格式), frontend/src/hooks/useWebSocket.ts:40-60 (消息处理)
  QA: curl POST takeover → verify WebSocket message received on kicked user's browser
  Commit: Y | feat: add room_kicked WebSocket event

- [ ] 15. 更新 StreamWatch 适配房间
  What to do: 修改 frontend/src/pages/streaming/StreamWatch.tsx：
  - 从路由参数获取 roomId（/stream/watch/:roomId，原 /:key → 改为 /:roomId）
  - whepUrl 改为 `http://${hostname}:8889/${roomId}/whep`
  - 移除对旧 key 系统的依赖
  Must NOT do: 不要改变 WHEP client 或 video 播放逻辑
  References: frontend/src/pages/streaming/StreamWatch.tsx:40-46 (whepUrl construction)
  QA: Playwright: create room → start push → open watch URL → verify video playing
  Commit: Y | refactor(frontend): adapt StreamWatch for room-based streaming

- [ ] 16. 更新 Nginx 路由支持房间观看
  What to do: 修改 nginx/includes/shared.conf：
  - 新增 location /live/ → proxy_pass http://mediamtx:8889/ (HLS/WebRTC 观看直通)
  - 或：保持前端路由 /stream/watch/:roomId（已有 location / → proxy_pass frontend，无需改动）
  - 确认前端路由已经是 /stream/watch/:roomId
  Must NOT do: 不要改动现有 /api 或 /ws 代理
  References: nginx/includes/shared.conf:11-23 (api proxy), nginx/includes/shared.conf:54-72 (frontend proxy)
  QA: curl localhost/live/test → verify MediaMTX responds (or 404 for non-existent stream)
  Commit: Y | chore(nginx): add live stream direct proxy route

- [ ] 17. 创建临时房间自动清理 + is_active 同步 Celery 任务
  What to do: 创建 backend/app/tasks/stream_room.py：两个任务：
  1. @celery_app.task: sync_room_active_status() — 每 60 秒执行，调用 mediamtx.get_active_paths() 获取活跃 path 列表，将 DB 中所有 stream_room 的 is_active 与 MediaMTX 实际状态对齐（id 在活跃列表 → is_active=true，不在 → is_active=false + 更新 last_active_at）
  2. @celery_app.task: cleanup_temporary_rooms() — 每 5 分钟执行：SELECT * FROM stream_room WHERE room_type='temporary' AND is_active=false AND (last_active_at < now() - TEMP_ROOM_TTL 或 last_active_at IS NULL)，删除匹配房间
  - TEMP_ROOM_TTL: 环境变量 TEMP_ROOM_TTL_MINUTES（默认 30），测试时设为 1
  - 在 celery_app.conf.beat_schedule 注册两个 task
  Must NOT do: 不要删除正在活跃的临时房间；不要覆盖手动设置的 is_active
  References: backend/app/tasks/__init__.py (beat schedule), backend/app/models/stream_room.py, backend/app/services/mediaintx.py
  QA: 设置 TEMP_ROOM_TTL_MINUTES=1 → 创建临时房间 → 推流 5s 后停止 → 等待 60s → 验证 sync 已将 is_active=false → 等待 60s → 验证 cleanup 已删除房间

- [ ] 18. 标记旧 API 为 Deprecated
  What to do: 更新 backend/app/api/stream.py：
  - GET /stream/key → 返回 {"code": 1, "msg": "已废弃，请使用 /api/v1/stream/rooms", "data": null}
  - POST /stream/key/reset → 同上
  - GET /stream/config → 返回全局默认 config 值（过渡期保留）
  - PUT /stream/config → 返回 {"code": 1, "msg": "已废弃，请在每个房间内配置"}
  Must NOT do: 不要直接删除这些端点（可能前端还有引用）
  References: backend/app/api/stream.py:55-119
  QA: curl GET /api/v1/stream/key → verify deprecated message
  Commit: Y | refactor(backend): mark old stream API as deprecated

- [ ] 19. 前端路由注册 + 侧边栏入口
  What to do:
  - 在 frontend/src/router/index.tsx 添加 /streaming/rooms 路由 → RoomListPage
  - 更新 /streaming 路由：重定向到 /streaming/rooms
  - 更新 /streaming/studio/:roomId → StreamStudio（已有）
  - 更新 /stream/watch/:roomId → StreamWatch（已有）
  - 侧边栏"直播工作室"菜单展开为"房间列表"+"我的推流"
  Must NOT do: 不要改变现有 MenuLayout 结构
  References: frontend/src/router/index.tsx, frontend/src/layouts/MainLayout.tsx
  QA: Playwright: navigate to /streaming → verify redirected to /streaming/rooms
  Commit: Y | feat(frontend): register room routes + sidebar entries

- [ ] 20. 注册模型 + docker-compose MediaMTX healthcheck 更新
  What to do:
  - backend/app/models/__init__.py: import StreamRoom, add to __all__
  - backend/alembic/env.py: 添加 StreamRoom import
  - docker-compose.yml: 更新 mediamtx healthcheck test → CMD curl -f http://localhost:8889/test/whip 或改为通用 OPTIONS
  Must NOT do: 不要改 MediaMTX 配置的 paths 部分（all_others 已够用）
  References: backend/app/models/__init__.py, backend/alembic/env.py:15-17, docker-compose.yml:128
  QA: docker compose up -d → verify all containers healthy
  Commit: Y | chore: register StreamRoom model, fix mediamtx healthcheck

- [ ] 21. 全局类型统一 + 清理废弃引用
  What to do: 全局搜索并清理：
  - 搜索 StreamKey/stream_key 引用 → 标记 deprecated 或删除
  - 搜索 streamConfig/stream_config 引用 → 替换为 roomConfig
  - 搜索 getStreamKey/resetStreamKey 引用 → 确保不影响新功能
  - 清理 frontend 中未使用的旧 state（setStreamKey/setWatchUrl 等）
  Must NOT do: 不要在还有引用的地方删除函数（先 deprecate）
  QA: grep -r "stream_key\|StreamKey\|streamConfig" frontend/src → 确认只有 deprecated 标记
  Commit: Y | cleanup: remove/deprecate old stream key references

- [ ] 22. 端到端集成验证
  What to do:
  - 1. 创建独立房间 RoomA（内置临时）+ RoomB（外部常驻）
  - 2. 进入 RoomA → 添加摄像头源 → 推流 → 验证 push_url/watch_url 正确 → 停止
  - 3. 进入 RoomB → 验证显示 RTMP URL（无 Studio）→ 用 OBS 推 RTMP → 浏览器观看
  - 4. 用户 A 在 RoomA 推流中 → 用户 B 尝试推流 → 接管弹窗 → 接管成功 → A 被踢
  - 5. 创建临时房间 → 停止推流 → 等 30min → 验证 Celery 已删除
  - 6. 验证旧 API /stream/key 返回 deprecated
  Must NOT do: 不做性能测试（scope out）
  QA: Playwright full flow + curl assertions. Evidence: .omo/evidence/task-22-stream-room-refactor.md
  Commit: Y | test: end-to-end stream room verification

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy

## Success criteria
