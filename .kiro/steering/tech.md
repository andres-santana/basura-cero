# Tech Stack

## Framework & language
- **Next.js 15** (App Router) with **React 18** and **TypeScript** (strict mode).
- `experimental.typedRoutes` is enabled — keep route strings valid/typed.
- Path alias: `@/*` → `./src/*`. Prefer `@/...` imports over relative paths.

## UI
- **Tailwind CSS 3** for styling. A custom `eco` color palette is defined in
  `tailwind.config.ts` — use `eco-*` classes for brand greens.
- **lucide-react** for icons, **recharts** for charts, **qrcode.react** for QR codes,
  **clsx** for conditional class names.

## Forms & validation
- **react-hook-form** with **@hookform/resolvers** and **Zod** schemas.
- Validate inputs with Zod at API boundaries and in forms.

## Backend / data
- **Supabase** (Postgres, Auth, Storage) via `@supabase/supabase-js`.
- Two clients:
  - `src/lib/supabase/client.ts` — browser client using the **anon key**
    (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
  - `src/lib/supabase/server.ts` — `createServerSupabase()` using the
    **service role key** (`SUPABASE_SERVICE_ROLE_KEY`); server-only, never import in
    client components.
- SQL schema, RLS, views, triggers, and seeds live in `supabase/migrations/` as
  numbered files (`001_...`, `002_...`). Add new changes as the next numbered migration.

## Auth model
- Session state is stored in **cookies** (`role`, `userId`, `schoolId`,
  `mustChangePassword`), read via `next/headers` `cookies()`.
- Use the role helpers rather than reading cookies ad hoc:
  `src/lib/auth.ts` (`getSession`), `src/lib/auth-admin.ts`
  (`requireAdmin`, `requireAdminWithSchool`), `src/lib/auth-teacher.ts`.

## Environment variables
Set in `.env.local` (never commit secrets):
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Common commands
```bash
npm run dev     # local dev server
npm run build   # production build
npm run start   # run production build
npm run lint    # next lint (ESLint 9 + eslint-config-next)
```
There is no test suite configured. Verify changes with `npm run lint` and `npm run build`.

## Git / branch workflow
La rama principal es **`main`**. Antes de empezar a trabajar un cambio, sigue este flujo:

1. **Actualiza la rama principal primero.** Trae lo último de `main` antes de ramificar:
   ```bash
   git checkout main && git pull origin main
   ```
2. **Decide la rama de trabajo:**
   - **Crea una rama nueva** cuando el cambio lo amerite (nueva feature, fix o tema
     distinto al que ya estás trabajando). Pártela desde `main` actualizado y usa nombres
     descriptivos con prefijo por tipo: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
     ```bash
     git checkout -b feat/mi-cambio
     ```
   - **Sigue en la rama actual** si el cambio es parte del mismo tema/feature en el que ya
     estás trabajando. No abras una rama nueva para continuar trabajo relacionado.
3. **Nunca trabajes ni hagas commits directos sobre `main`.** `main` solo se actualiza vía
   merge/PR de ramas de trabajo.

### Preflight de git (antes de escribir código)
**Siempre, antes de empezar a escribir o modificar código, verifica y deja limpio el
estado de git.** No arranques cambios sobre un árbol en mal estado. El flujo es:

1. **Revisa el estado actual:**
   ```bash
   git status && git branch --show-current && git fetch origin
   ```
2. **Resuelve conflictos pendientes.** Si hay un merge/rebase a medias o archivos en
   conflicto, resuélvelos antes de continuar. Nunca escribas código nuevo encima de
   conflictos sin resolver.
3. **Sincroniza con el remoto.** Si la rama está detrás de `origin`, integra lo último
   (`git pull`/merge/rebase según corresponda) y resuelve cualquier conflicto que surja.
4. **Maneja los cambios sin commitear.** Si hay trabajo pendiente en el árbol, decide con
   el usuario si corresponde commitear, hacer stash o descartar antes de iniciar algo
   nuevo. No mezcles trabajo no relacionado en un mismo commit.
5. **Cierra el ciclo cuando termines:** commit descriptivo, push a la rama de trabajo y,
   cuando el cambio esté completo, abre/actualiza el PR hacia `main` (o haz merge según el
   flujo acordado). Las operaciones destructivas (force push, reset --hard, etc.) requieren
   confirmación explícita del usuario.

## Deployment
Deploys to **Vercel**: connect the repo, set Supabase env vars, run the SQL migrations
against the Supabase project, then publish.
