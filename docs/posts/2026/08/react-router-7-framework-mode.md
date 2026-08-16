---
title: "React Router 7 Framework Mode 迁移实录：从 SPA + API 到全栈框架"
date: 2026-08-16 10:58:26
tags:
  - React
readingTime: 8
description: "将一个内部仪表盘从传统 SPA + Express API 架构迁移到 React Router 7 framework mode 的完整过程：routes.ts 配置、loader/action 数据流设计、single-fetch 与 typegen、hydration 陷阱、Error Boundary UX，以及何时应该继续用 declarative mode。"
wordCount: 3300
---

我们团队维护的一个内部运营仪表盘在三年间从一个简单的 React SPA 膨胀成了前后端分离的两套代码库：前端用 Vite + React Router v6，后端用 Express + Prisma。每次加一个新页面，需要改路由配置、写 API endpoint、加前端 fetch 调用、处理 loading/error 状态——四步改动分散在两个仓库中。React Router 7 的 framework mode 承诺把这些统一到一个项目里。我花了两周时间完成了迁移，这篇文章记录真实过程中的收获和踩坑。

## 什么是 Framework Mode

React Router 7 提供两种模式：

- **Declarative Mode**：传统的 `<BrowserRouter>` + `<Routes>` 纯客户端路由，和你熟悉的 React Router v6 用法一致
- **Framework Mode**：基于 `routes.ts` 配置文件的服务端渲染框架，内置 loader/action 数据模型、SSR/SSG、typegen、single-fetch

Framework mode 不是一个新框架，而是 React Router 吸收了 Remix 的设计后提供的官方全栈方案。如果你的项目已经在用 Remix，升级到 React Router 7 framework mode 基本是无缝的；如果你是从纯 SPA 迁过来，需要理解几个核心概念的转变。

## 第一步：routes.ts 配置

Framework mode 用 `routes.ts` 替代了原来的 JSX 路由配置：

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

  // API-only routes（不渲染 UI）
  route('api/export', 'routes/api/export.ts'),
] satisfies RouteConfig;
```

这个文件同时定义了服务端路由和客户端路由。每个路径指向一个模块文件，该文件的 loader/action/component 导出构成了完整的路由单元。

迁移时的第一个决策：**哪些路由保留为纯客户端**。我们的仪表盘有几个页面只在特定权限下展示，且不需要 SEO，我将它们标记为 `clientLoader` only：

```typescript
// app/routes/admin-audit.tsx
// 仅客户端加载，不走服务端
export async function clientLoader() {
  const data = await fetch('/api/audit-log').then((r) => r.json());
  return data;
}

export default function AuditPage({ loaderData }: Route.ComponentProps) {
  // ...
}
```

这样既享受了 framework mode 的统一配置，又避免了不必要的 SSR 开销。

## Loader vs Client Fetch：数据流重新设计

这是迁移中最核心的设计决策。不是所有数据获取都应该放进 loader。

### 适合放进 loader 的数据

- 页面渲染必需的数据（没有它页面无法有意义地展示）
- 与服务端共享会话/认证上下文的数据
- 需要服务端预处理或聚合的数据

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

### 应该留在客户端 fetch 的数据

- 用户交互触发的数据（搜索建议、表单验证、下拉选项懒加载）
- 高频轮询的数据
- 非关键数据（可以延迟展示或用 skeleton 占位）

```typescript
// 搜索建议：用客户端 fetch，不放 loader
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

判断标准很简单：**如果去掉这个数据，页面还能不能给用户一个有意义的初始视图**。能，就放客户端；不能，就放 loader。

## Single-Fetch 与 Typegen

React Router 7 的 single-fetch 将同一路由树中多个 loader 的请求合并为一次 HTTP 请求。这对嵌套布局尤其有价值——dashboard layout 的 loader 和子页面的 loader 不再各自发请求。

Typegen 则在构建时自动生成每个路由的 loader/action 返回类型：

```typescript
// 自动生成的类型（.react-router/types/app/routes/+types/users.index.ts）
// 你不需要手写这些
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

这意味着 loader 的返回值变更会自动反映到组件 props 的类型上，无需手动维护接口定义。在我们的项目中，这消除了约 40 个手写的 `interface XxxResponse` 文件。

启用方式：

```typescript
// react-router.config.ts
export default {
  ssr: true,
  future: {
    unstable_singleFetch: true, // 2026 年的版本可能已稳定
  },
} satisfies Config;
```

## Hydration 陷阱

从 SPA 迁移到 SSR 框架，hydration mismatch 是最常见的问题。以下是我在迁移中遇到的三个典型场景：

### 1. 时间戳不一致

服务端渲染的时间和客户端 hydration 的时间不同，导致格式化的日期字符串不匹配：

```typescript
// ❌ hydration mismatch
function Timestamp({ date }: { date: string }) {
  return <time>{new Date(date).toLocaleString()}</time>;
}

// ✅ 使用 suppressHydrationWarning 或客户端渲染
function Timestamp({ date }: { date: string }) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    setFormatted(new Date(date).toLocaleString());
  }, [date]);

  if (!formatted) return <time>{date}</time>; // SSR fallback：显示原始值
  return <time>{formatted}</time>;
}
```

### 2. localStorage / 用户偏好

服务端无法访问 localStorage，如果组件依赖客户端存储的状态做初始渲染，必然 mismatch：

```typescript
// ✅ 默认值与服务端一致，客户端挂载后再切换
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // 默认值必须和服务端一致

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') setTheme('dark');
  }, []);

  return <button onClick={() => toggleTheme(theme)}>{theme}</button>;
}
```

### 3. 第三方组件不支持 SSR

某些 UI 库的组件在服务端渲染时会输出不同的 HTML。解决方案是用 `ClientOnly` 包裹：

```typescript
// app/components/client-only.tsx
import { useState, useEffect, type ReactNode } from 'react';

export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}

// 使用
<ClientOnly fallback={<ChartSkeleton />}>
  <InteractiveChart data={chartData} />
</ClientOnly>
```

## Error Boundary 与边界 UX

Framework mode 支持路由级别的 Error Boundary，当 loader 抛出错误或组件渲染失败时，只有该路由段被替换，父级布局保持不变。这对仪表盘的体验很重要——用户不会因为某个图表接口超时而丢失整个导航栏。

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
        <h3>用户不存在</h3>
        <p>请检查 ID 是否正确，或返回列表页重新选择。</p>
        <Link to="/users">返回用户列表</Link>
      </div>
    );
  }

  return (
    <div className="error-card error-generic">
      <h3>加载失败</h3>
      <p>{error instanceof Error ? error.message : '未知错误'}</p>
      <button onClick={() => window.location.reload()}>重试</button>
    </div>
  );
}
```

一个容易忽略的点：loader 中的错误需要在 ErrorBoundary 中区分处理。网络错误、业务逻辑错误、权限错误的展示和后续操作完全不同。不要用一个通用的"出错了"覆盖所有情况。

## 部署形态的变化

从 SPA + Express 迁移到 framework mode 后，部署从两个服务变成一个：

```
迁移前：
├── frontend/ (Vite build → Nginx 静态托管)
└── backend/  (Express → Node.js 进程)

迁移后：
└── app/ (react-router build → 单个 Node.js 进程)
    ├── server/  (SSR + API routes)
    └── client/  (静态资源)
```

对于我们的内部仪表盘，部署目标是 Docker + Kubernetes。React Router 7 framework mode 的输出是一个标准的 Node.js 服务器，可以直接容器化：

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

需要注意的是，framework mode 要求服务端运行时存在。如果你的部署环境只支持静态托管（如 S3 + CDN），需要使用 `ssr: false` 预渲染模式或退回 declarative mode。

## 什么时候继续用 Declarative Mode

不是所有项目都适合 framework mode。以下场景我建议继续用 declarative mode：

- **纯客户端应用**：没有服务端、不需要 SSR，比如 Chrome 扩展、Electron 应用的渲染层
- **已有成熟的 API 层且不打算整合**：如果后端是 Go/Java/Python 微服务，强行把数据层搬进 React Router 没有意义
- **团队对 SSR 不熟悉**：hydration、服务端数据获取、流式渲染都需要学习成本，在没有充分准备的情况下引入会增加故障面
- **性能敏感且页面简单**：framework mode 的运行时比纯客户端路由重，对于几个页面的小工具来说是不必要的开销

Framework mode 最适合的场景是：**前后端都是 TypeScript、数据获取逻辑频繁变动、团队希望减少胶水代码的全栈 Web 应用**。我们的仪表盘恰好符合这三个条件。

## 展望

React Router 7 framework mode 的价值不在于它做了什么新东西，而在于它把之前散落在多个工具和约定中的数据流、类型安全、错误处理统一到了一个框架内。迁移过程中最痛苦的不是技术难点，而是思维模型的转换——从"组件发请求"到"路由获取数据"，从"全局 error toast"到"局部 error boundary"，从"两套代码库"到"一个项目"。

这些转换完成后，开发效率的提升是实在的。新增一个页面的流程从四步变成了两步：定义路由、写 loader + component。类型自动推导，错误自动隔离，部署统一部署。对于一个持续迭代的内部工具来说，这就是值得迁移的理由。
