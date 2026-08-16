---
title: "React Router 7 Framework Mode 遷移實錄：從 SPA + API 到全端框架"
date: 2026-08-16 10:58:26
tags:
  - React
readingTime: 8
description: "將一個內部儀表板從傳統 SPA + Express API 架構遷移到 React Router 7 framework mode 的完整過程：routes.ts 設定、loader/action 資料流設計、single-fetch 與 typegen、hydration 陷阱、Error Boundary UX，以及何時應該繼續用 declarative mode。"
wordCount: 3300
---

我們團隊維護的一個內部營運儀表板在三年間從一個簡單的 React SPA 膨脹成了前後端分離的兩套程式碼庫：前端用 Vite + React Router v6，後端用 Express + Prisma。每次加一個新頁面，需要改路由設定、寫 API endpoint、加前端 fetch 呼叫、處理 loading/error 狀態——四步改動分散在兩個儲存庫中。React Router 7 的 framework mode 承諾把這些統一到一個專案裡。我花了兩週時間完成了遷移，這篇文章記錄真實過程中的收穫和踩坑。

## 什麼是 Framework Mode

React Router 7 提供兩種模式：

- **Declarative Mode**：傳統的 `<BrowserRouter>` + `<Routes>` 純客戶端路由，和你熟悉的 React Router v6 用法一致
- **Framework Mode**：基於 `routes.ts` 設定檔的伺服器端渲染框架，內建 loader/action 資料模型、SSR/SSG、typegen、single-fetch

Framework mode 不是一個新框架，而是 React Router 吸收了 Remix 的設計後提供的官方全端方案。如果你的專案已經在用 Remix，升級到 React Router 7 framework mode 基本是無縫的；如果你是從純 SPA 遷過來，需要理解幾個核心概念的轉變。

## 第一步：routes.ts 設定

Framework mode 用 `routes.ts` 替代了原來的 JSX 路由設定：

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

這個檔案同時定義了伺服器端路由和客戶端路由。每個路徑指向一個模組檔案，該檔案的 loader/action/component 匯出構成了完整的路由單元。

遷移時的第一個決策：**哪些路由保留為純客戶端**。我們的儀表板有幾個頁面只在特定權限下展示，且不需要 SEO，我將它們標記為 `clientLoader` only：

```typescript
// app/routes/admin-audit.tsx
// 僅客戶端載入，不走伺服器端
export async function clientLoader() {
  const data = await fetch('/api/audit-log').then((r) => r.json());
  return data;
}

export default function AuditPage({ loaderData }: Route.ComponentProps) {
  // ...
}
```

這樣既享受了 framework mode 的統一設定，又避免了不必要的 SSR 開銷。

## Loader vs Client Fetch：資料流重新設計

這是遷移中最核心的設計決策。不是所有資料獲取都應該放進 loader。

### 適合放進 loader 的資料

- 頁面渲染必需的資料（沒有它頁面無法有意義地展示）
- 與伺服器端共享工作階段/驗證上下文的資料
- 需要伺服器端預處理或聚合的資料

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

### 應該留在客戶端 fetch 的資料

- 使用者互動觸發的資料（搜尋建議、表單驗證、下拉選單選項懶載入）
- 高頻輪詢的資料
- 非關鍵資料（可以延遲展示或用 skeleton 佔位）

```typescript
// 搜尋建議：用客戶端 fetch，不放 loader
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

判斷標準很簡單：**如果去掉這個資料，頁面還能不能給使用者一個有意義的初始檢視**。能，就放客戶端；不能，就放 loader。

## Single-Fetch 與 Typegen

React Router 7 的 single-fetch 將同一路由樹中多個 loader 的請求合併為一次 HTTP 請求。這對巢狀佈局尤其有價值——dashboard layout 的 loader 和子頁面的 loader 不再各自發請求。

Typegen 則在建構時自動產生每個路由的 loader/action 返回類型：

```typescript
// 自動產生的類型（.react-router/types/app/routes/+types/users.index.ts）
// 你不需要手寫這些
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

這意味著 loader 的返回值變更會自動反映到元件 props 的類型上，無需手動維護介面定義。在我們的專案中，這消除了約 40 個手寫的 `interface XxxResponse` 檔案。

啟用方式：

```typescript
// react-router.config.ts
export default {
  ssr: true,
  future: {
    unstable_singleFetch: true, // 2026 年的版本可能已穩定
  },
} satisfies Config;
```

## Hydration 陷阱

從 SPA 遷移到 SSR 框架，hydration mismatch 是最常見的問題。以下是我在遷移中遇到的三個典型場景：

### 1. 時間戳記不一致

伺服器端渲染的時間和客戶端 hydration 的時間不同，導致格式化的日期字串不匹配：

```typescript
// ❌ hydration mismatch
function Timestamp({ date }: { date: string }) {
  return <time>{new Date(date).toLocaleString()}</time>;
}

// ✅ 使用 suppressHydrationWarning 或客戶端渲染
function Timestamp({ date }: { date: string }) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    setFormatted(new Date(date).toLocaleString());
  }, [date]);

  if (!formatted) return <time>{date}</time>; // SSR fallback：顯示原始值
  return <time>{formatted}</time>;
}
```

### 2. localStorage / 使用者偏好

伺服器端無法存取 localStorage，如果元件依賴客戶端儲存的狀態做初始渲染，必然 mismatch：

```typescript
// ✅ 預設值與伺服器端一致，客戶端掛載後再切換
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // 預設值必須和伺服器端一致

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') setTheme('dark');
  }, []);

  return <button onClick={() => toggleTheme(theme)}>{theme}</button>;
}
```

### 3. 第三方元件不支援 SSR

某些 UI 函式庫的元件在伺服器端渲染時會輸出不同的 HTML。解決方案是用 `ClientOnly` 包裹：

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

## Error Boundary 與邊界 UX

Framework mode 支援路由層級的 Error Boundary，當 loader 拋出錯誤或元件渲染失敗時，只有該路由段被替換，父級佈局保持不變。這對儀表板的體驗很重要——使用者不會因為某個圖表介面逾時而遺失整個導覽列。

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
        <h3>使用者不存在</h3>
        <p>請檢查 ID 是否正確，或返回列表頁重新選擇。</p>
        <Link to="/users">返回使用者列表</Link>
      </div>
    );
  }

  return (
    <div className="error-card error-generic">
      <h3>載入失敗</h3>
      <p>{error instanceof Error ? error.message : '未知錯誤'}</p>
      <button onClick={() => window.location.reload()}>重試</button>
    </div>
  );
}
```

一個容易忽略的點：loader 中的錯誤需要在 ErrorBoundary 中區分處理。網路錯誤、業務邏輯錯誤、權限錯誤的展示和後續操作完全不同。不要用一個通用的「出錯了」覆蓋所有情況。

## 部署形態的變化

從 SPA + Express 遷移到 framework mode 後，部署從兩個服務變成一個：

```
遷移前：
├── frontend/ (Vite build → Nginx 靜態託管)
└── backend/  (Express → Node.js 處理程序)

遷移後：
└── app/ (react-router build → 單個 Node.js 處理程序)
    ├── server/  (SSR + API routes)
    └── client/  (靜態資源)
```

對於我們的內部儀表板，部署目標是 Docker + Kubernetes。React Router 7 framework mode 的輸出是一個標準的 Node.js 伺服器，可以直接容器化：

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

需要注意的是，framework mode 要求伺服器端執行時存在。如果你的部署環境只支援靜態託管（如 S3 + CDN），需要使用 `ssr: false` 預渲染模式或退回 declarative mode。

## 什麼時候繼續用 Declarative Mode

不是所有專案都適合 framework mode。以下場景我建議繼續用 declarative mode：

- **純客戶端應用**：沒有伺服器端、不需要 SSR，比如 Chrome 擴充套件、Electron 應用的渲染層
- **已有成熟的 API 層且不打算整合**：如果後端是 Go/Java/Python 微服務，強行把資料層搬進 React Router 沒有意義
- **團隊對 SSR 不熟悉**：hydration、伺服器端資料獲取、串流式渲染都需要學習成本，在沒有充分準備的情況下引入會增加故障面
- **效能敏感且頁面簡單**：framework mode 的執行時比純客戶端路由重，對於幾個頁面的小工具來說是不必要的開銷

Framework mode 最適合的場景是：**前後端都是 TypeScript、資料獲取邏輯頻繁變動、團隊希望減少膠水程式碼的全端 Web 應用**。我們的儀表板恰好符合這三個條件。

## 展望

React Router 7 framework mode 的價值不在於它做了什麼新東西，而在於它把之前散落在多個工具和約定中的資料流、型別安全、錯誤處理統一到了一個框架內。遷移過程中最痛苦的不是技術難點，而是思維模型的轉換——從「元件發請求」到「路由獲取資料」，從「全域 error toast」到「區域性 error boundary」，從「兩套程式碼庫」到「一個專案」。

這些轉換完成後，開發效率的提升是實在的。新增一個頁面的流程從四步變成了兩步：定義路由、寫 loader + component。類型自動推導，錯誤自動隔離，部署統一部署。對於一個持續迭代的內部工具來說，這就是值得遷移的理由。
