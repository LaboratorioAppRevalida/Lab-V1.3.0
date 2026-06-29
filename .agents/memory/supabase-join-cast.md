---
name: Supabase join type cast
description: Supabase client types foreign key joins (title:titles(*)) as arrays; must cast through unknown.
---

When doing a Supabase select with a foreign key join like `title:titles(*)`, the TypeScript return type incorrectly types `title` as an array rather than a single object.

**Pattern that fails:**
```ts
for (const row of data as Array<{ user_id: string; title: DbTitle }>) { ... }
```
Error: `Conversion of type '{user_id: any; title: any[]}[]' ... title: any[] is not assignable to DbTitle`

**Correct pattern:**
```ts
for (const row of (data ?? []) as unknown as Array<{ user_id: string; title: DbTitle }>) { ... }
```
Cast through `unknown` first to bypass the incorrect generated type.

**Why:** The Supabase PostgREST client can return either an array or object for joins depending on cardinality; the TS type generator conservatively uses array. The actual runtime value is a single object when using a to-one relationship.

**How to apply:** Any `select("..., relatedTable:table_name(*)")` join where you know it's a single object — cast via `as unknown as YourType`.
