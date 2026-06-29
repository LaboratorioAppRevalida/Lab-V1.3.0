---
name: TrainingContext HMR quirk
description: Adding imports to TrainingContext.tsx triggers Vite Fast Refresh failure and transient runtime errors.
---

**Symptom:** After editing TrainingContext.tsx, Vite logs:
`hmr invalidate /src/contexts/TrainingContext.tsx Could not Fast Refresh ("useTraining" export is incompatible)`

InviteModal then crashes with "useTraining must be used within TrainingProvider" — this is a transient HMR state, NOT a real bug.

**Why:** TrainingContext.tsx exports both a React context provider (component) AND hooks/types. Vite's Fast Refresh requires files to export ONLY components or ONLY non-components. Mixed exports fall back to full module invalidation, which briefly unmounts the provider before remounting.

**Fix:** Restart the `artifacts/revalida: web` workflow after editing TrainingContext.tsx. The error disappears on clean start.

**How to apply:** Never diagnose "useTraining must be used within TrainingProvider" as a real error unless it persists after a workflow restart.
