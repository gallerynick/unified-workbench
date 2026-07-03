---
slug: stream-room-refactor
status: awaiting-approval
intent: clear
pending-action: user approves → start execution
approach: per-room streaming model with builtin/external modes, room ID as stream key, per-room config, takeover conflict resolution, temporary room auto-cleanup
decisions:
  - conflict: new user takeover (confirmed)
  - permissions: is_open boolean (no invite list)
  - mediamtx: API polling (no webhook)
  - scenes: in-memory only (no persistence)
  - migration: clean break (delete old stream_keys, no auto-migration)
components:
  - StreamRoom model + migration
  - Room CRUD API + schemas
  - MediaMTX integration service
  - Frontend room list + create modal + detail
  - StreamStudio room adaptation + mode toggle + conflict UI
  - StreamWatch room adaptation
  - Celery temp room cleanup
  - Nginx live route
  - WebSocket room_kicked event
  - Deprecation of old stream API

approach: <fill: the approach you intend to plan>
---

# Draft: stream-room-refactor

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

## Findings (cited - path:lines)

## Decisions (with rationale)

## Scope IN

## Scope OUT (Must NOT have)

## Open questions

## Approval gate
status: drafting
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
