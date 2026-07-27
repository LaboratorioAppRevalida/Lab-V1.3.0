---
name: FASE 4 mission progress engine
description: Architecture of missionProgressEngine.ts — server-authoritative mission progress persistence.
---

## Key design decisions

**Two trigger groups** — missions are filtered before evaluation (avoids O(n*m)):
- `SESSION_TRIGGER_TYPES`: completar_estacao, completar_estacao_paciente, finalizar_multiplayer, media_nota, completar_checklist
- `SESSION_CONDITION_RULE_TYPES`: station_completed, session_count, average_score, min_score, multiplayer_count, time_spent_minutes
- `LOGIN_TRIGGER_TYPES`: login, streak
- `LOGIN_CONDITION_RULE_TYPES`: login_streak

**Mission cache** — 5-min in-memory TTL (`_missionCache`, `_missionCacheExpiry`) avoids repeated `fetchActiveDbMissions()` calls.

**UUID-direct upsert** — engine has the full `DbMission` (with `id` UUID), so `upsertMissionProgressById` skips the slug→UUID lookup round-trip entirely.

**Graceful `last_evaluated_at` fallback** — upsert first tries with `last_evaluated_at`; if column missing (migration not yet run), retries without it. This allows the engine to work before `005_ump_columns.sql` is applied.

**Wire-up points:**
- `processMissionProgressAfterSession(userId, history)` — called fire-and-forget in `salvarEstacao()` after `saveSession()` resolves, alongside `evaluateAutomaticTitles`
- `processLoginMissionProgress(userId, sessions)` — called fire-and-forget in `loadHistory()` after `fetchSessions()` resolves (once per user load)

**Conquistas.tsx cleanup** — removed the evaluation+upsert `useEffect` that previously ran O(n*m) on every `history.length` change. Display calculation in `MissionCard` is kept for rendering (display-only, never upserts).

**Why:** Previous architecture only persisted mission progress when user visited Conquistas page. Sessions could complete missions that were never recorded server-side, breaking cross-device persistence.

**SQL to run:** `005_ump_columns.sql` — adds `last_evaluated_at` and `metadata` columns, plus partial index.
