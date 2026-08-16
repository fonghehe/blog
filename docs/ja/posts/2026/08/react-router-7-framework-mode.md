---
title: "React Router 7 Framework Mode 移行記録：SPA + API からフルスタックフレームワークへ"
date: 2026-08-16 10:58:26
tags:
  - React
readingTime: 8
description: "内部ダッシュボードを従来の SPA + Express API アーキテクチャから React Router 7 framework mode に移行した全過程を記録。routes.ts 設定、loader/action のデータフロー設計、single-fetch と typegen、hydration の罠、Error Boundary UX、そして declarative mode を使い続けるべきタイミングについても論じる。"
wordCount: 3300
---

我々のチームが保守する内部運用ダッシュボードは、3 年間でシンプルな React SPA からフロントエンド・バックエンド分離の 2 つのコードベースに膨れ上がった：フロントエンドは Vite + React Router v6、バックエンドは Express + Prisma。新しいページを追加するたびに、ルート設定の変更、API エンドポイントの記述、フロントエンドの fetch 呼び出し追加、loading/error 状態の処理――4 つの変更が 2 つのリポジトリに分散する。React Router 7 の framework mode はこれらを一つのプロジェクトに統合することを約束する。筆者は 2 週間かけて移行を完了した。本記事では実際の移行過程での収穫と落とし穴を記録する。

## Framework Mode とは何か

React Router 7 は 2 つのモードを提供する：

- **Declarative Mode**：従来の `<BrowserRouter>` + `<Routes>` による純クライアントサイドルーティング。React Router v6 の使い方と同じ
- **Framework Mode**：`routes.ts` 設定ファイルに基づくサーバーサイドレンダリングフレームワーク。loader/action データモデル、SSR/SSG、typegen、single-fetch を内蔵

Framework mode は新しいフレームワークではなく、React Router が Remix の設計を取り込んだ後に提供する公式フルスタックソリューションである。すでに Remix を使っているプロジェクトなら React Router 7 framework mode へのアップグレードはほぼシームレスだ。純 SPA から移行する場合は、いくつかのコア概念の転換を理解する必要がある。

## 第一歩：routes.ts 設定

Framework mode は JSX ルート設定の代わりに `routes.ts` を使用する：

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

  // API-only ルート（UI をレンダリングしない）
  route('api/export', 'routes/api/export.ts'),
] satisfies RouteConfig;
```

このファイルはサーバー側ルートとクライアント側ルートの両方を定義する。各パスはモジュールファイルを指し、そのファイルの loader/action/component エクスポートが完全なルートユニットを構成する。

移行時の最初の判断：**どのルートを純クライアントのままにするか**。我々のダッシュボードには特定の権限下でのみ表示され、SEO も不要なページがいくつかある。それらは `clientLoader` only としてマークした：

```typescript
// app/routes/admin-audit.tsx
// クライアントのみで読み込み、サーバー側は通らない
export async function clientLoader() {
  const data = await fetch('/api/audit-log').then((r) => r.json());
  return data;
}

export default function AuditPage({ loaderData }: Route.ComponentProps) {
  // ...
}
```

これにより framework mode の統一設定の恩恵を受けつつ、不要な SSR オーバーヘッドを回避できる。

## Loader vs Client Fetch：データフローの再設計

これは移行における最もコアな設計判断だ。すべてのデータ取得を loader に突っ込むべきではない。

### loader に含めるべきデータ

- ページレンダリングに必須のデータ（それがなければページが意味のある表示をできない）
- サーバー側とセッション・認証コンテキストを共有するデータ
- サーバー側での前処理や集約が必要なデータ

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

### クライアント側 fetch に残すべきデータ

- ユーザーインタラクションによってトリガーされるデータ（検索候補、フォームバリデーション、ドロップダウンオプションの遅延読み込み）
- 高頻度ポーリングするデータ
- 非クリティカルなデータ（遅延表示や skeleton プレースホルダーでもよい）

```typescript
// 検索候補：クライアント側 fetch を使用し、loader には入れない
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

判断基準はシンプルだ：**このデータを外しても、ページはユーザーに意味のある初期ビューを提供できるか**。できるならクライアント側に、できないなら loader に入れる。

## Single-Fetch と Typegen

React Router 7 の single-fetch は、同一ルートツリー内の複数 loader リクエストを 1 回の HTTP リクエストに統合する。これはネストされたレイアウトに特に価値がある――ダッシュボードレイアウトの loader と子ページの loader がそれぞれ個別にリクエストを発行する必要がなくなる。

Typegen はビルド時に各ルートの loader/action の戻り値の型を自動生成する：

```typescript
// 自動生成された型（.react-router/types/app/routes/+types/users.index.ts）
// これらを手書きする必要はない
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

つまり loader の戻り値の変更が自動的にコンポーネント props の型に反映され、インターフェース定義を手動で管理する必要がない。我々のプロジェクトでは、これにより約 40 個の手書き `interface XxxResponse` ファイルが不要になった。

有効化方法：

```typescript
// react-router.config.ts
export default {
  ssr: true,
  future: {
    unstable_singleFetch: true, // 2026 年のバージョンではすでに安定している可能性あり
  },
} satisfies Config;
```

## Hydration の罠

SPA から SSR フレームワークに移行する際、hydration mismatch は最も一般的な問題である。以下は移行中に遭遇した 3 つの典型的なシナリオだ：

### 1. タイムスタンプの不一致

サーバー側でレンダリングした時刻とクライアント側の hydration の時刻が異なり、フォーマット済み日付文字列が一致しない：

```typescript
// ❌ hydration mismatch
function Timestamp({ date }: { date: string }) {
  return <time>{new Date(date).toLocaleString()}</time>;
}

// ✅ suppressHydrationWarning を使用するかクライアント側でレンダリング
function Timestamp({ date }: { date: string }) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    setFormatted(new Date(date).toLocaleString());
  }, [date]);

  if (!formatted) return <time>{date}</time>; // SSR フォールバック：元の値を表示
  return <time>{formatted}</time>;
}
```

### 2. localStorage / ユーザー設定

サーバー側は localStorage にアクセスできない。コンポーネントがクライアント側ストレージの状態に依存して初期レンダリングを行う場合、必ず mismatch が発生する：

```typescript
// ✅ デフォルト値をサーバー側と一致させ、クライアントマウント後に切り替える
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // デフォルト値はサーバー側と一致させる必要がある

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') setTheme('dark');
  }, []);

  return <button onClick={() => toggleTheme(theme)}>{theme}</button>;
}
```

### 3. サードパーティコンポーネントが SSR 非対応

一部の UI ライブラリのコンポーネントはサーバー側レンダリング時に異なる HTML を出力する。解決策は `ClientOnly` でラップすることだ：

```typescript
// app/components/client-only.tsx
import { useState, useEffect, type ReactNode } from 'react';

export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}

// 使用例
<ClientOnly fallback={<ChartSkeleton />}>
  <InteractiveChart data={chartData} />
</ClientOnly>
```

## Error Boundary と境界 UX

Framework mode はルートレベルの Error Boundary をサポートする。loader がエラーをスローしたりコンポーネントのレンダリングが失敗した場合、そのルートセグメントのみが置換され、親レイアウトは維持される。これはダッシュボードの体験にとって重要だ――ユーザーはあるグラフの API タイムアウトのせいでナビゲーションバー全体を失うことがない。

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
        <h3>ユーザーが見つかりません</h3>
        <p>ID が正しいか確認するか、一覧ページに戻って再選択してください。</p>
        <Link to="/users">ユーザー一覧に戻る</Link>
      </div>
    );
  }

  return (
    <div className="error-card error-generic">
      <h3>読み込みに失敗しました</h3>
      <p>{error instanceof Error ? error.message : '不明なエラー'}</p>
      <button onClick={() => window.location.reload()}>再試行</button>
    </div>
  );
}
```

見落とされがちなポイント：loader 内のエラーは ErrorBoundary で区別して処理する必要がある。ネットワークエラー、ビジネスロジックエラー、権限エラーでは表示内容も後続アクションも全く異なる。「エラーが発生しました」という汎用メッセージで全てを覆ってはいけない。

## デプロイ形態の変化

SPA + Express から framework mode に移行すると、デプロイは 2 つのサービスから 1 つになる：

```
移行前：
├── frontend/ (Vite build → Nginx 静的ホスティング)
└── backend/  (Express → Node.js プロセス)

移行後：
└── app/ (react-router build → 単一 Node.js プロセス)
    ├── server/  (SSR + API routes)
    └── client/  (静的アセット)
```

我々の内部ダッシュボードのデプロイ先は Docker + Kubernetes である。React Router 7 framework mode の出力は標準的な Node.js サーバーであり、そのままコンテナ化できる：

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

注意点として、framework mode はサーバー側ランタイムの存在を必要とする。デプロイ環境が静的ホスティングのみをサポートする場合（S3 + CDN など）、`ssr: false` によるプリレンダリングモードを使用するか、declarative mode に戻す必要がある。

## Declarative Mode を使い続けるべきタイミング

すべてのプロジェクトが framework mode に適しているわけではない。以下のシナリオでは declarative mode の継続を推奨する：

- **純クライアントアプリケーション**：サーバーがなく SSR も不要。Chrome 拡張機能や Electron アプリのレンダリング層など
- **成熟した API 層があり統合するつもりがない**：バックエンドが Go/Java/Python マイクロサービスの場合、データ層を無理に React Router に移す意味はない
- **チームが SSR に不慣れ**：hydration、サーバー側データ取得、ストリーミングレンダリングには学習コストがある。十分な準備なしに導入すると障害面が増える
- **パフォーマンス重視かつページがシンプル**：framework mode のランタイムは純クライアントルーティングより重い。数ページの小さなツールには不要なオーバーヘッドである

Framework mode が最も適するシナリオは：**フロントエンド・バックエンドともに TypeScript、データ取得ロジックが頻繁に変更される、チームがグルーコードを減らしたいフルスタック Web アプリケーション**だ。我々のダッシュボードはまさにこの 3 条件を満たしていた。

## 展望

React Router 7 framework mode の価値は何か新しいことをする点ではなく、これまで複数のツールや慣習に散らばっていたデータフロー、型安全性、エラー処理を一つのフレームワーク内に統一した点にある。移行中で最も辛かったのは技術的な難所ではなく、思考モデルの転換だった――「コンポーネントがリクエストを送る」から「ルートがデータを取得する」へ、「グローバルエラートースト」から「ローカルエラーバウンダリ」へ、「2 つのコードベース」から「1 つのプロジェクト」へ。

これらの転換が完了すれば、開発効率の向上は実感できるものだ。新しいページを追加するフローが 4 ステップから 2 ステップになった：ルートを定義し、loader + component を書く。型は自動推論され、エラーは自動隔離され、デプロイは統一される。継続的にイテレーションする内部ツールにとって、これこそが移行に値する理由である。
