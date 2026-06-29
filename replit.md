# Revalida — 2ª Fase

Plataforma de preparação para a 2ª fase do Revalida, com treino de estações clínicas em modo solo ou multiplayer.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/revalida run dev` — run the frontend (port 21831)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project credentials

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + shadcn/ui
- API: Express 5
- DB: Supabase (PostgreSQL + Auth + Realtime)
- Routing: Wouter
- Forms: React Hook Form + Zod
- Charts: Recharts
- Animations: Framer Motion
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/revalida/src/` — frontend source
  - `pages/` — all page components (Inicio, Progresso, Treino, etc.)
  - `pages/admin/` — admin panel pages
  - `pages/training/` — multiplayer training session pages
  - `components/` — shared components (AppShell, AppHeader, BottomNav, etc.)
  - `contexts/` — AuthContext, RealtimeContext, TrainingContext, ThemeContext
  - `lib/` — services (Supabase, checklist, gamification, analytics, etc.)
  - `hooks/` — custom hooks
- `artifacts/api-server/src/` — Express API server
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — Drizzle ORM schema

## Architecture decisions

- Supabase is used for auth, database, and realtime multiplayer (presence + channels)
- `RealtimeStateManager` is the single source of truth for all multiplayer state — never call Supabase channels directly
- Training sessions support both solo mode and real multiplayer with session recovery after disconnects
- Themes (light/dark/system) are managed via ThemeContext + next-themes
- Admin role is determined by `is_admin` flag on the `profiles` table

## Product

- **Login/Cadastro** — Supabase email auth with friendly error messages
- **Início** — dashboard with streak, progress summary, news
- **Treino** — multiplayer training with matchmaking, invites, role selection (médico/paciente), timed stations, and PEP scoring
- **Resumos/Notas/Plano** — study tools
- **Progresso/Rankings/Conquistas** — gamification
- **Admin panel** — checklist builder, resumos editor, notícias, observabilidade, user management

## User preferences

- App is in Brazilian Portuguese
- Keep all UI text in Portuguese

## Gotchas

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set as Replit secrets before the app works
- Supabase client uses a placeholder URL if env vars are missing (avoids crash, shows friendly errors)
- Realtime multiplayer requires Supabase Realtime to be enabled on the project
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
