# Chore Chart

A family chore tracking app for parents and kids. Parents can set up weekly chore schedules and kids can mark chores complete — all in a clean, colorful interface.

## Features

- **Login with roles** — sign up as a Parent or Kid; each role has different permissions
- **Weekly chore view** — see all scheduled chores for the current week, organized by day
- **Mark chores done** — tap the circle to complete a chore; tap again to undo
- **Weekly progress bar** — see how many chores have been completed this week
- **Manage chores (Parents only)** — create, emoji-label, and delete chores
- **Weekly schedule builder (Parents only)** — assign chores to specific days and optionally to specific roles

## Technologies

- **[TanStack Start](https://tanstack.com/start)** — full-stack React framework with SSR and file-based routing
- **[Netlify Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/)** — authentication with role-based access
- **[Netlify Database](https://docs.netlify.com/platform/primitives/database/)** — managed Postgres for chore data
- **[Drizzle ORM](https://orm.drizzle.team/)** — type-safe database queries and schema migrations
- **[Tailwind CSS v4](https://tailwindcss.com/)** — utility-first styling

## Running Locally

To work on the app without authentication:

```bash
npm install
npm run dev  # starts Vite on port 3000
```

To log in locally with existing Netlify Identity accounts, point the dev app at a deployed Netlify site that has Identity enabled:

```bash
cp .env.example .env.local
# edit .env.local and set VITE_NETLIFY_SITE_URL=https://your-site-name.netlify.app
npm run dev
```

The dev server proxies `/.netlify/identity/*` to that deployed site, so restart `npm run dev` after changing `.env.local`.

New signups still need the deployed Netlify site/preview URL because Identity signup, confirmation emails, and role assignment are managed by Netlify.

## Database Migrations

The database schema is in `db/schema.ts`. After editing the schema, regenerate migrations:

```bash
npx drizzle-kit generate
```

Migrations in `netlify/database/migrations/` are applied automatically at deploy time.
