# AGENTS.md

This document provides an overview of the project structure for developers and AI agents working on this codebase.

## Project Overview

A family chore tracking app for parents and kids. Parents manage the chore library and weekly schedule; kids mark chores complete. Built with TanStack Start and deployed on Netlify.

## Data Model

- **chores** — library of chore definitions (title, emoji, description, createdBy)
- **weekly_schedule** — assigns a chore to a day of week (0=Sun..6=Sat), with optional role assignment ('all', 'parent', 'kid')
- **chore_completions** — records when a schedule entry was completed for a given week, keyed by `week_start_date` (Monday of that week, ISO date string)

Schema defined in `db/schema.ts`, Drizzle client in `db/index.ts`. Migrations auto-applied at deploy time from `netlify/database/migrations/`.

## Auth Architecture

- **Netlify Identity** via `@netlify/identity` package — handles JWT cookies on both client and server
- Roles live in `user.roles[]`: `'parent'` or `'kid'`
- `netlify/functions/identity-signup.ts` webhook assigns role at signup based on `user_metadata.role`
- Server functions use `requireAuthMiddleware` or `requireRoleMiddleware('parent')` from `src/middleware/identity.ts`
- Route guards call `getServerUser()` in `beforeLoad` for SSR redirects
- `IdentityProvider` + `CallbackHandler` wrap the app in `src/routes/__root.tsx`

## Key Directories

```
src/
  lib/
    auth.ts                  # getServerUser() server function wrapper
    identity-context.tsx     # React context for client-side auth state
  middleware/
    identity.ts              # requireAuthMiddleware, requireRoleMiddleware
  components/
    CallbackHandler.tsx      # Handles auth URL hash tokens
  server/
    chores.functions.ts      # All server functions: chore CRUD, scheduling, completions
  routes/
    __root.tsx               # App shell with IdentityProvider + CallbackHandler
    index.tsx                # Redirects to /dashboard or /login
    login.tsx                # Login/signup page
    dashboard.tsx            # Main app — week view + parent manage view

db/
  schema.ts                  # Drizzle table definitions
  index.ts                   # Drizzle client (netlify-db adapter)
netlify/
  database/migrations/       # Auto-applied SQL migrations
  functions/
    identity-signup.ts       # Identity webhook for role assignment
```

## Key Decisions

- **Role at signup**: The identity-signup webhook reads `user_metadata.role` to assign `parent` or `kid`. Roles can also be changed manually in the Netlify dashboard.
- **Completion toggle**: Clicking a completed chore deletes the row (undo) — no separate undo endpoint needed.
- **Week scope**: Completions filter by current week's Monday date string. Historical data stays in DB but isn't surfaced in the UI.
- **Never run `drizzle-kit migrate`**: Netlify applies migrations automatically; only use `drizzle-kit generate` to create migration files.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Auth | Netlify Identity via @netlify/identity |
| Database | Netlify Database (Postgres) with Drizzle ORM |
| Language | TypeScript 5.9 |
| Deployment | Netlify |

## Conventions

- Server functions in `src/server/*.functions.ts` — safe to import anywhere
- All DB access goes through Drizzle via `db/index.ts`
- `.js` extension on internal imports (ES module requirement)
- Tailwind v4 uses CSS `@import "tailwindcss"` — no config file
