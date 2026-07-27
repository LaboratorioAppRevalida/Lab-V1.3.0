---
name: Session restore must call hydrateStation
description: TrainingContext session-recovery flow must await hydrateStation(checklistId) or the station renders blank.
---

## Rule
After setting `config` inside the session restore `.then()` callback in `TrainingContext.tsx`, always `await hydrateStation(session.checklist_id)` before returning.

**Why:** `getActiveChecklist()` reads from `checklistDetailMapRef` which is only populated by `hydrateStation()`. If session restore sets `config.checklistId` but never populates the map, `Estacao.tsx` line `if (!checklist || !role) return null` fires → blank dark screen. This manifests only on page-refresh recovery of a multiplayer session, not on fresh session start (which calls `hydrateStation` through the normal config flow).

**How to apply:** The restore path is the `.then(async (session) => {...})` block on `getActiveSessionForUser` inside the `useEffect([userId, manager])`. Add `await hydrateStation(session.checklist_id)` immediately after `setConfig(...)`, followed by `if (cancelled) return` to guard the cancellation token.

## Related
- `fetchProfile(partnerId)` in the same block must use `fetchPublicProfile(partnerId)` (SECURITY DEFINER view) because migration 012 locks `profiles` to own-row RLS — cross-user reads return null from the raw table.
