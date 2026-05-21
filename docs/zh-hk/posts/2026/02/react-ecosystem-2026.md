---
title: "React 生態 2026 完整盤點"
date: 2026-02-02 10:00:00
tags:
  - React
readingTime: 4
description: "2026 年的 React 生態經歷了大洗牌。很多曾經的\"必選庫\"被淘汰，新工具填補了空白。本文做一個全面的盤點：哪些庫該用、哪些該棄、哪些新秀值得關注。"
wordCount: 404
---

2026 年的 React 生態經歷了大洗牌。很多曾經的"必選庫"被淘汰，新工具填補了空白。本文做一個全面的盤點：哪些庫該用、哪些該棄、哪些新秀值得關注。

## 狀態管理：Zustand 一統江湖

Redux Toolkit 仍然維護，但新項目幾乎沒有選它的了。Zustand 5.x 以其極致簡潔的 API 和對 React Compiler 的完美支持，成為事實標準。

```typescript
// Zustand 5.x 的完整用法 —— 包含持久化、devtools、immer
import { create } from 'zustand';
import { persist, devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark' | 'system';
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
          theme: 'system',
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
              state.notifications = state.notifications.filter((n) => n.id !== id);
            }),
        })),
        { name: 'app-store', version: 2 }
      ),
      { name: 'AppStore' }
    )
  )
);
```

## 數據獲取：TanStack Query 穩坐第一

TanStack Query v5 已經是數據獲取的絕對標準。SWR 仍在維護但更新緩慢，Apollo Client 退守 GraphQL 特定場景。

```typescript
// TanStack Query v5 的 2026 最佳實踐
import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query';

// 集中定義 query options，便於複用和預取
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

// 組件中使用
function ProductList({ filters }: { filters: ProductFilters }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(productQueries.list(filters));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      // 精確失效，不刷新整個列表
      queryClient.invalidateQueries({ queryKey: productQueries.lists() });
    },
  });

  // 預取詳情頁 —— 用户 hover 時就開始加載
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

## 樣式方案：Tailwind v4 + CSS Modules

CSS-in-JS 在 2026 年基本退出了主流。Tailwind CSS v4 的 JIT 引擎性能大幅提升，加上零運行時的優勢，成為了默認選擇。

```tsx
// 2026 年的樣式組合策略
// Tailwind 用於佈局和通用樣式
// CSS Modules 用於組件特有的複雜樣式

// Button.tsx
import styles from './button.module.css';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  loading?: boolean;
}

export function Button({ variant, size, children, loading }: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-200
        ${variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
        ${variant === 'secondary' ? 'bg-gray-100 text-gray-900 hover:bg-gray-200' : ''}
        ${variant === 'ghost' ? 'text-gray-600 hover:bg-gray-50' : ''}
        ${size === 'sm' ? 'px-3 py-1.5 text-sm' : ''}
        ${size === 'md' ? 'px-4 py-2 text-sm' : ''}
        ${size === 'lg' ? 'px-6 py-3 text-base' : ''}
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      disabled={loading}
    >
      {loading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
}
```

## UI 組件庫：shadcn/ui 的生態統治

shadcn/ui 不是一個傳統意義上的組件庫——它是一套可複製的組件代碼。2026 年，這個模式被證明是正確的：你需要的不是 npm 包，而是你擁有的、可自由修改的組件代碼。

```typescript
// shadcn/ui 的 2026 使用方式
// 安裝命令已經變成交互式 CLI
// $ bunx shadcn@latest add dialog combobox data-table

// 組件安裝後直接在 src/components/ui/ 中，可以自由修改
// 這是 shadcn/ui 最大的優勢：你擁有代碼

// 自定義擴展示例：在 shadcn 的 Dialog 基礎上封裝業務組件
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
            取消
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

## 測試、構建和其他工具

```typescript
// 2026 年的工具鏈推薦配置
const toolchain2026 = {
  // 測試
  unitTest: 'Vitest 3.x',
  componentTest: '@testing-library/react + vitest',
  e2e: 'Playwright 1.50+',
  visualRegression: 'Chromatic 或 Playwright screenshot',

  // 構建
  bundler: 'Turbopack (Next.js) / Vite 7 (SPA)',
  packageManager: 'Bun 3.x',

  // 代碼質量
  linting: 'Biome 2.x (取代 ESLint + Prettier)',
  typeCheck: 'TypeScript 7.0',

  // 監控
  errorTracking: 'Sentry (仍然主流)',
  performance: 'Web Vitals + 自建 APM',

  // 已淘汰或不推薦
  deprecated: [
    'Webpack —— 被 Turbopack/Vite 取代',
    'ESLint + Prettier —— 被 Biome 取代',
    'Styled-components / Emotion —— 運行時 CSS-in-JS 退出主流',
    'Redux (即使 RTK) —— 被 Zustand 取代',
    'Jest —— 被 Vitest 取代',
    'Yarn / npm —— 被 Bun 取代',
  ],
};
```

## 小結

- 狀態管理選 Zustand，數據獲取選 TanStack Query，這是 2026 年無爭議的默認組合
- CSS-in-JS 已死，Tailwind v4 + CSS Modules 是當前最務實的樣式方案
- shadcn/ui 的"擁有代碼"模式是組件庫的未來方向
- 工具鏈大洗牌：Biome 取代 ESLint，Vitest 取代 Jest，Bun 取代 npm
- React 生態在 2026 年趨於收斂，選擇少了反而更好——因為每個賽道的贏家都很明確
