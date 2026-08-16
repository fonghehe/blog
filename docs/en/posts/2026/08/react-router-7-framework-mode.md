---
title: "React Router 7 Framework Mode Migration: From SPA + API to Full-Stack Framework"
date: 2026-08-16 10:58:26
tags:
  - React
readingTime: 8
description: "A complete account of migrating an internal dashboard from a traditional SPA + Express API architecture to React Router 7 framework mode: routes.ts configuration, loader/action data flow design, single-fetch and typegen, hydration pitfalls, Error Boundary UX, and when to stick with declarative mode."
wordCount: 3300
---

An internal operations dashboard our team maintains grew over three years from a simple React SPA into two separate codebases: frontend with Vite + React Router v6, backend with Express + Prisma. Every time we added a new page, it required changing route config, writing an API endpoint, adding a frontend fetch call, and handling loading/error states — four steps spread across two repositories. React Router 7's framework mode promises to unify all of this into a single project. I spent two weeks completing the migration, and this article documents the real-world gains and pitfalls.

## What Is Framework Mode

React Router 7 offers two modes:

- **Declarative Mode**: traditional `<BrowserRouter>` + `<Routes>` client-side routing, identical to the React Router v6 usage you're familiar with
- **Framework Mode**: a server-rendered framework based on a `routes.ts` config file, with built-in loader/action data model, SSR/SSG, typegen, and single-fetch

Framework mode isn't a new framework — it's React Router incorporating Remix's design patterns into an official full-stack solution. If your project already uses Remix, upgrading to React Router 7 framework mode is essentially seamless; if you're migrating from a pure SPA, you need to understand several core conceptual shifts.

## Step One: routes.ts Configuration

Framework mode replaces the original JSX route configuration with `routes.ts`:

```typescript
// app/routes.ts
import { type RouteConfig, route, index, layout } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),

  layout('layouts/dashboard.tsx', [
    route('overview', 'routes/overview.tsx'),
    route('users', 'routes/users/index.tsx'),
    route('users/:userId', 'routes/users/detail.tsx'),
    route('settings', 'routes/settings.tsx'),
  ]),

  // API-only routes (no UI rendering)
  route('api/export', 'routes/api/export.ts'),
] satisfies RouteConfig;
```

This file defines both server-side and client-side routes. Each path points to a module file whose loader/action/component exports form the complete route unit.

The first decision during migration: **which routes should remain client-only**. Our dashboard has several pages that only display under specific permissions and don't need SEO, so I marked them as `clientLoader` only:

```typescript
// app/routes/admin-audit.tsx
// Client-only loading, no server-side involvement
export async function clientLoader() {
  const data = await fetch('/api/audit-log').then((r) => r.json());
  return data;
}

export default function AuditPage({ loaderData }: Route.ComponentProps) {
  // ...
}
```

This gives us the unified configuration benefits of framework mode while avoiding unnecessary SSR overhead.

## Loader vs Client Fetch: Redesigning Data Flow

This is the most critical design decision in migration. Not all data fetching belongs in a loader.

### Data That Belongs in a Loader

- Data essential for page rendering (without it, the page can't display meaningfully)
- Data that shares server-side session/authentication context
- Data requiring server-side preprocessing or aggregation

```typescript
// app/routes/users/index.tsx
import type { Route } from './+types/users.index';
import { db } from '~/lib/db.server';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = 20;

  const [users, total] = await Promise.all([
    db.user.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, role: true },
    }),
    db.user.count(),
  ]);

  return { users, total, page, pageSize };
}

export default function UsersPage({ loaderData }: Route.ComponentProps) {
  const { users, total, page, pageSize } = loaderData;
  return (
    <div>
      <UserTable users={users} />
      <Pagination current={page} total={total} pageSize={pageSize} />
    </div>
  );
}
```

### Data That Should Stay as Client-Side Fetch

- User-interaction-triggered data (search suggestions, form validation, lazy-loaded dropdown options)
- High-frequency polling data
- Non-critical data (can be deferred or shown with skeleton placeholders)

```typescript
// Search suggestions: use client fetch, not loader
function UserSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();

    fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then(setSuggestions)
      .catch((e) => {
        if (e.name !== 'AbortError') console.error(e);
      });

    return () => controller.abort();
  }, [query]);

  return <ComboBox value={query} onChange={setQuery} options={suggestions} />;
}
```

The rule of thumb is simple: **if you remove this data, can the page still give users a meaningful initial view?** If yes, keep it on the client; if no, put it in a loader.

## Single-Fetch and Typegen

React Router 7's single-fetch consolidates requests from multiple loaders in the same route tree into a single HTTP request. This is especially valuable for nested layouts — the dashboard layout's loader and the child page's loader no longer fire separate requests.

Typegen automatically generates loader/action return types for each route at build time:

```typescript
// Auto-generated types (.react-router/types/app/routes/+types/users.index.ts)
// You don't need to write these by hand
export namespace Route {
  export interface LoaderArgs {
    request: Request;
    params: {};
    context: AppLoadContext;
  }
  export interface LoaderData {
    users: { id: string; name: string; email: string; role: string }[];
    total: number;
    page: number;
    pageSize: number;
  }
  export interface ComponentProps {
    loaderData: LoaderData;
    actionData?: ActionData;
  }
}
```

This means changes to a loader's return value automatically propagate to component prop types, eliminating manual interface maintenance. In our project, this removed roughly 40 hand-written `interface XxxResponse` files.

Enable it like this:

```typescript
// react-router.config.ts
export default {
  ssr: true,
  future: {
    unstable_singleFetch: true, // May be stable by 2026 releases
  },
} satisfies Config;
```

## Hydration Pitfalls

When migrating from a SPA to an SSR framework, hydration mismatches are the most common issue. Here are three typical scenarios I encountered during migration:

### 1. Timestamp Mismatch

The server render time differs from client hydration time, causing formatted date strings to mismatch:

```typescript
// ❌ Hydration mismatch
function Timestamp({ date }: { date: string }) {
  return <time>{new Date(date).toLocaleString()}</time>;
}

// ✅ Use suppressHydrationWarning or client-side rendering
function Timestamp({ date }: { date: string }) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    setFormatted(new Date(date).toLocaleString());
  }, [date]);

  if (!formatted) return <time>{date}</time>; // SSR fallback: show raw value
  return <time>{formatted}</time>;
}
```

### 2. localStorage / User Preferences

The server can't access localStorage. If a component relies on client-stored state for initial rendering, a mismatch is inevitable:

```typescript
// ✅ Default matches server; switch after client mount
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default must match server

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') setTheme('dark');
  }, []);

  return <button onClick={() => toggleTheme(theme)}>{theme}</button>;
}
```

### 3. Third-Party Components That Don't Support SSR

Some UI library components output different HTML during server rendering. The solution is wrapping them with `ClientOnly`:

```typescript
// app/components/client-only.tsx
import { useState, useEffect, type ReactNode } from 'react';

export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}

// Usage
<ClientOnly fallback={<ChartSkeleton />}>
  <InteractiveChart data={chartData} />
</ClientOnly>
```

## Error Boundary and Edge Case UX

Framework mode supports route-level Error Boundaries. When a loader throws or a component fails to render, only that route segment is replaced — the parent layout remains intact. This matters greatly for dashboard UX: users won't lose the entire navigation bar just because one chart API timed out.

```typescript
// app/routes/users/detail.tsx
import type { Route } from './+types/users.detail';

export async function loader({ params }: Route.LoaderArgs) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Response('User not found', { status: 404 });
  return { user };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (error instanceof Response && error.status === 404) {
    return (
      <div className="error-card">
        <h3>User not found</h3>
        <p>Please check the ID or go back to the list to select again.</p>
        <Link to="/users">Back to user list</Link>
      </div>
    );
  }

  return (
    <div className="error-card error-generic">
      <h3>Failed to load</h3>
      <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
}
```

An easily overlooked point: errors from loaders need differentiated handling in the ErrorBoundary. Network errors, business logic errors, and permission errors all require different presentation and follow-up actions. Don't cover everything with a generic "something went wrong" message.

## Deployment Model Changes

After migrating from SPA + Express to framework mode, deployment goes from two services to one:

```
Before migration:
├── frontend/ (Vite build → Nginx static hosting)
└── backend/  (Express → Node.js process)

After migration:
└── app/ (react-router build → single Node.js process)
    ├── server/  (SSR + API routes)
    └── client/  (static assets)
```

For our internal dashboard, the deployment target is Docker + Kubernetes. React Router 7 framework mode outputs a standard Node.js server that can be containerized directly:

```dockerfile
FROM node:26-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM base AS build
COPY . .
RUN pnpm build

FROM base AS production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["node", "build/server/index.js"]
```

Note that framework mode requires a server runtime. If your deployment environment only supports static hosting (e.g., S3 + CDN), you'll need to use `ssr: false` pre-rendering mode or fall back to declarative mode.

## When to Stick with Declarative Mode

Not every project suits framework mode. I recommend staying with declarative mode in these scenarios:

- **Pure client-side applications**: no server, no SSR needed — e.g., Chrome extensions, Electron app rendering layers
- **Existing mature API layer with no plans to integrate**: if the backend is Go/Java/Python microservices, forcing the data layer into React Router makes no sense
- **Team unfamiliar with SSR**: hydration, server-side data fetching, and streaming rendering all have learning curves; introducing them without adequate preparation increases the failure surface
- **Performance-sensitive with simple pages**: framework mode's runtime is heavier than pure client-side routing; for small tools with a few pages, it's unnecessary overhead

Framework mode is best suited for: **full-stack web applications where both frontend and backend are TypeScript, data fetching logic changes frequently, and the team wants to reduce glue code**. Our dashboard happened to meet all three conditions.

## Looking Ahead

The value of React Router 7 framework mode isn't about inventing something new — it's about unifying data flow, type safety, and error handling that were previously scattered across multiple tools and conventions into a single framework. The most painful part of migration wasn't technical difficulty but mental model switching: from "components make requests" to "routes fetch data," from "global error toasts" to "local error boundaries," from "two codebases" to "one project."

Once those transitions are complete, the development efficiency gains are tangible. Adding a new page goes from four steps to two: define the route, write the loader + component. Types are auto-inferred, errors auto-isolated, deployment unified. For a continuously iterating internal tool, that's reason enough to migrate.
