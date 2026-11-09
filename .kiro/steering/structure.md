# Project Structure

```
src/
  app/                     # Next.js App Router: pages, layouts, and API routes
    api/                   # Route handlers (route.ts), grouped by role
      admin/               #   admin endpoints (evidencias, experimentos, semanas,
                           #   usuarios/{grupos,jurado,maestros}, export)
      auth/                #   session, change-password
      maestro/             #   teacher endpoints (evidencias, grupos, reto-actual, storage)
    dashboard/             # authenticated dashboards (admin/*, maestro/*)
    experimentos/          # public experiment browsing (+ [weekNumber] detail)
    ranking/ insignias/    # public ranking & badges pages
    login/ cuenta/         # auth-related pages and forms
    layout.tsx page.tsx globals.css
  components/              # Reusable React components, grouped by domain
    admin/ auth/ evidence/ experiments/ gamification/ layout/
    landing/ metrics/ qr/
  lib/                     # Business logic, data access, and helpers
    supabase/              #   client (browser), server (service role), url helpers
    services/              #   data-fetching/aggregation (kpis, reports, ranking,
                           #   experiments, teacher dashboard, scoring-service, ...)
    scoring/               #   scoring rules, calculate, badges
    admin/                 #   admin types, export, mock
    analytics/             #   event tracking
    auth.ts auth-admin.ts auth-teacher.ts   # session/role guards
    types.ts               # shared domain types (Role, Experiment, GroupScore, Badge)
    error-message.ts site-url.ts video.ts
supabase/migrations/       # Numbered SQL migrations (schema, RLS, views, triggers, seeds)
docs/                      # Product docs, MVP scope, pilot plan, prompts, UI spec
```

## Conventions
- **API routes**: one `route.ts` per folder; export named HTTP handlers
  (`GET`, `POST`, `PATCH`, `DELETE`). Dynamic segments use `[id]` / `[weekNumber]`.
- **Auth-first handlers**: start admin/teacher handlers by calling the appropriate
  `require*` guard, wrap the body in `try/catch`, and return errors via `jsonError(error)`.
  Throw `HttpError(status, message)` for expected failures.
- **Server vs client**: use `createServerSupabase()` (service role) only in server code
  (route handlers, server components, `lib/services`). Use `supabaseClient` (anon) in the
  browser. Never expose the service role key to the client.
- **Data scoping**: filter queries by the session `schoolId` for multi-tenant safety.
- **Naming**: files are `kebab-case`; React components are `PascalCase`; TS types/enums
  in `types.ts`. API responses map snake_case DB columns to camelCase JSON.
- **Database changes**: add a new numbered file in `supabase/migrations/`; do not edit
  existing migrations.
- **Imports**: use the `@/` alias for anything under `src/`.
