# PDF Viewer

## Tech Stack

- **Framework:** Next.js (App Router, React Server Components)
- **Runtime/Package Manager:** Bun
- **Styling:** Tailwind CSS v4 (CSS-first config via `@import "tailwindcss"`)
- **Database:** PostgreSQL 17 (Docker) + Drizzle ORM
- **Auth:** Better Auth (email/password + Google SSO)
- **Language:** TypeScript

## Common Commands

```bash
bun dev                      # Start dev server
bun run build                # Production build
bun run lint                 # ESLint
docker compose up -d         # Start PostgreSQL
docker compose down          # Stop PostgreSQL
bunx drizzle-kit generate    # Generate migration files from schema changes
bunx drizzle-kit migrate     # Apply migrations to database
```

## Project Structure

```
src/
├── app/                     # Next.js App Router pages
│   ├── (auth)/              # Auth route group (login, signup)
│   ├── dashboard/           # Protected dashboard
│   └── api/auth/[...all]/   # Better Auth API handler
├── components/auth/         # Client-side auth components
├── db/                      # Database (Drizzle schema + connection)
├── lib/                     # Auth config (server + client)
└── middleware.ts             # Route protection via session cookie
```

## Key Patterns

- **RSC-first:** Pages are Server Components. Only interactive elements (forms, buttons) use `"use client"`.
- **Server-side auth:** Use `auth.api.getSession({ headers: await headers() })` in server components.
- **Client-side auth:** Import `signIn`, `signUp`, `signOut`, `useSession` from `@/lib/auth-client`.
- **Tailwind v4:** CSS-first configuration — no `tailwind.config.ts`. Use `@theme` in `globals.css` for customization.
- **File naming:** kebab-case for all files (e.g., `login-form.tsx`, `auth-client.ts`).
- **Database changes:** Edit `src/db/schema.ts`, then `bunx drizzle-kit generate && bunx drizzle-kit migrate`.
