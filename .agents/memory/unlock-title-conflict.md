---
name: unlockTitle ON CONFLICT pattern
description: How to implement idempotent insert (ON CONFLICT DO NOTHING) in Supabase without TS errors.
---

**Problem:** Using `.throwOnError()` before checking `error.code` makes TypeScript type `error` as `never`, breaking the subsequent check.

**Pattern that breaks:**
```ts
const { error } = await supabase.from("...").insert({...}).throwOnError();
if (error && !error.code?.startsWith("23505")) throw error; // TS error: 'code' does not exist on 'never'
```

**Correct pattern:**
```ts
const { error } = await supabase.from("user_titles").insert({ user_id, title_id });
if (error && !String(error.code ?? "").startsWith("23505")) throw error;
```

**Why:** `.throwOnError()` narrows the return type so `error` is typed as `never`. Using `String(error.code ?? "")` also safely handles null/undefined codes.

**How to apply:** Any idempotent Supabase insert that should silently ignore unique constraint violations (PostgreSQL error code 23505).
