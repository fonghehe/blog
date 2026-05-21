---
title: "React エコシステム 2026 完全総覧"
date: 2026-02-02 10:00:00
tags:
  - React
readingTime: 4
description: "2026 年の React エコシステムは大きな地殻変動を経験しました。かつての「必須ライブラリ」の多くが淘汰され、新しいツールがその空白を埋めています。本記事では全面的な棚卸しを行います：どのライブラリを使うべきか、どれを捨てるべきか、そしてどの新鋭が注目に値するか。"
wordCount: 597
---

2026 年の React エコシステムは大きな地殻変動を経験しました。かつての「必須ライブラリ」の多くが淘汰され、新しいツールがその空白を埋めています。本記事では全面的な棚卸しを行います：どのライブラリを使うべきか、どれを捨てるべきか、そしてどの新鋭が注目に値するか。

## 状態管理：Zustand が一強に

Redux Toolkit はまだメンテナンスされていますが、新規プロジェクトでの採用はほぼゼロになりました。Zustand 5.x は、その極限までシンプルな API と React Compiler への完璧な対応により、事実上の標準となっています。

```typescript
// Zustand 5.x の完全な使用例 — 永続化・devtools・immer を含む
import { create } from "zustand";
import { persist, devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface AppState {
  user: User | null;
  theme: "light" | "dark" | "system";
  sidebar: { collapsed: boolean; width: number };
  notifications: Notification[];

  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  toggleSidebar: () => void;
  addNotification: (n: Notification) => void;
  dismissNotification: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
          user: null,
          theme: "system",
          sidebar: { collapsed: false, width: 280 },
          notifications: [],

          login: async (credentials) => {
            const user = await api.login(credentials);
            set({ user });
          },

          logout: () => set({ user: null }),

          toggleSidebar: () =>
            set((state) => {
              state.sidebar.collapsed = !state.sidebar.collapsed;
            }),

          addNotification: (n) =>
            set((state) => {
              state.notifications.push(n);
            }),

          dismissNotification: (id) =>
            set((state) => {
              state.notifications = state.notifications.filter(
                (n) => n.id !== id,
              );
            }),
        })),
        { name: "app-store", version: 2 },
      ),
      { name: "AppStore" },
    ),
  ),
);
```

## データ取得：TanStack Query が不動の首位

TanStack Query v5 はデータ取得の絶対標準となっています。SWR はメンテナンスが続いていますが更新は緩やか。Apollo Client は GraphQL 特化シナリオに退いています。

```typescript
// TanStack Query v5 の 2026 年ベストプラクティス
import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query';

// クエリオプションを集中管理し、再利用やプリフェッチを容易にする
export const productQueries = {
  all: () => ['products'] as const,

  lists: () => [...productQueries.all(), 'list'] as const,
  list: (filters: ProductFilters) =>
    queryOptions({
      queryKey: [...productQueries.lists(), filters],
      queryFn: () => api.getProducts(filters),
      staleTime: 5 * 60 * 1000,
    }),

  details: () => [...productQueries.all(), 'detail'] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...productQueries.details(), id],
      queryFn: () => api.getProduct(id),
      staleTime: 10 * 60 * 1000,
    }),
};

// コンポーネントでの使用
function ProductList({ filters }: { filters: ProductFilters }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(productQueries.list(filters));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      // 精確な無効化 — リスト全体を再取得しない
      queryClient.invalidateQueries({ queryKey: productQueries.lists() });
    },
  });

  // 詳細ページをプリフェッチ — ユーザーがホバーした瞬間に読み込み開始
  const prefetchDetail = (id: string) => {
    queryClient.prefetchQuery(productQueries.detail(id));
  };

  if (isLoading) return <ProductListSkeleton />;

  return (
    <div>
      {data?.products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          onMouseEnter={() => prefetchDetail(p.id)}
          onDelete={() => deleteMutation.mutate(p.id)}
        />
      ))}
    </div>
  );
}
```

## スタイリング：Tailwind v4 + CSS Modules

CSS-in-JS は 2026 年にはほぼ主流から外れました。Tailwind CSS v4 の大幅に向上した JIT エンジン性能と、ゼロランタイムの優位性が組み合わさり、デフォルトの選択肢となっています。

```tsx
// 2026 年のスタイリング組み合わせ戦略
// Tailwind はレイアウトと汎用スタイルに使用
// CSS Modules はコンポーネント固有の複雑なスタイルに使用

// Button.tsx
import styles from "./button.module.css";

interface ButtonProps {
  variant: "primary" | "secondary" | "ghost";
  size: "sm" | "md" | "lg";
  children: React.ReactNode;
  loading?: boolean;
}

export function Button({ variant, size, children, loading }: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-200
        ${variant === "primary" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
        ${variant === "secondary" ? "bg-gray-100 text-gray-900 hover:bg-gray-200" : ""}
        ${variant === "ghost" ? "text-gray-600 hover:bg-gray-50" : ""}
        ${size === "sm" ? "px-3 py-1.5 text-sm" : ""}
        ${size === "md" ? "px-4 py-2 text-sm" : ""}
        ${size === "lg" ? "px-6 py-3 text-base" : ""}
        ${loading ? "opacity-50 cursor-not-allowed" : ""}
      `}
      disabled={loading}
    >
      {loading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
}
```

## UI コンポーネントライブラリ：shadcn/ui がエコシステムを支配

shadcn/ui は従来の意味でのコンポーネントライブラリではありません — コピー可能なコンポーネントコードのセットです。2026 年、このモデルが正しかったことが証明されました：必要なのは npm パッケージではなく、自分が所有し自由に変更できるコンポーネントコードです。

```typescript
// shadcn/ui の 2026 年の使い方
// インストールコマンドはインタラクティブな CLI になっている
// $ bunx shadcn@latest add dialog combobox data-table

// インストール後、コンポーネントは src/components/ui/ に直接置かれ、自由に編集できる
// これが shadcn/ui の最大の利点：コードを自分が所有する

// カスタム拡張例：shadcn の Dialog をベースにビジネスコンポーネントをラップ
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '確認',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## テスト・ビルド・その他のツール

```typescript
// 2026 年のツールチェーン推奨設定
const toolchain2026 = {
  // テスト
  unitTest: "Vitest 3.x",
  componentTest: "@testing-library/react + vitest",
  e2e: "Playwright 1.50+",
  visualRegression: "Chromatic または Playwright スクリーンショット",

  // ビルド
  bundler: "Turbopack (Next.js) / Vite 7 (SPA)",
  packageManager: "Bun 3.x",

  // コード品質
  linting: "Biome 2.x (ESLint + Prettier の代替)",
  typeCheck: "TypeScript 7.0",

  // モニタリング
  errorTracking: "Sentry (依然として主流)",
  performance: "Web Vitals + カスタム APM",

  // 非推奨または廃止
  deprecated: [
    "Webpack — Turbopack/Vite に置き換えられた",
    "ESLint + Prettier — Biome に置き換えられた",
    "Styled-components / Emotion — ランタイム CSS-in-JS は主流から外れた",
    "Redux (RTK でも) — Zustand に置き換えられた",
    "Jest — Vitest に置き換えられた",
    "Yarn / npm — Bun に置き換えられた",
  ],
};
```

## まとめ

- 状態管理は Zustand、データ取得は TanStack Query — これが 2026 年における議論の余地のないデフォルトの組み合わせ。
- CSS-in-JS は死んだ。Tailwind v4 + CSS Modules が現在最も現実的なスタイリング手法。
