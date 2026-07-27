---
name: Titles automatic engine
description: How automatic title unlocking works; where the hook lives in the session save flow.
---

The title evaluation engine reuses `evaluateMissionProgress` + `parseConditions` from `missionRulesEngine.ts` — no second engine.

**Key function:** `evaluateAutomaticTitles(userId, history)` in `src/lib/titleService.ts`
- Fetches active titles with non-null conditions
- Fetches already-unlocked title IDs for the user
- Evaluates each unevaluated title's conditions against history
- Calls `unlockTitle()` (ON CONFLICT DO NOTHING) for each satisfied title

**Integration point:** `TrainingContext.tsx > salvarEstacao()` — after `saveSession` resolves, fire-and-forget:
```ts
evaluateAutomaticTitles(userId, [entry, ...history].slice(0, 200)).catch(() => {})
```
`[entry, ...history]` is correct because `setHistory` (async state) has not yet resolved.

**Why:** All conditions logic is already battle-tested in missions; title evaluation is structurally identical.

**How to apply:** Any new title type with conditions follows the same `{ rules: MissionRule[] }` shape. Admin panel's ConditionsEditor component is shared between MissoesTab and TitulosTab.
