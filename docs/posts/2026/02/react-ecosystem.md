---
title: "React 生态 2026 完整盘点"
date: 2026-02-02 18:16:53
tags:
  - React
readingTime: 4
description: "2026 年的 React 生态经历了大洗牌。很多曾经的\"必选库\"被淘汰，新工具填补了空白。本文做一个全面的盘点：哪些库该用、哪些该弃、哪些新秀值得关注。"
wordCount: 404
---

2026 年的 React 生态经历了大洗牌。很多曾经的"必选库"被淘汰，新工具填补了空白。本文做一个全面的盘点：哪些库该用、哪些该弃、哪些新秀值得关注。

## 状态管理：Zustand 一统江湖

Redux Toolkit 仍然维护，但新项目几乎没有选它的了。Zustand 5.x 以其极致简洁的 API 和对 React Compiler 的完美支持，成为事实标准。

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

## 数据获取：TanStack Query 稳坐第一

TanStack Query v5 已经是数据获取的绝对标准。SWR 仍在维护但更新缓慢，Apollo Client 退守 GraphQL 特定场景。

```typescript
// TanStack Query v5 的 2026 最佳实践
import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query';

// 集中定义 query options，便于复用和预取
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

// 组件中使用
function ProductList({ filters }: { filters: ProductFilters }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(productQueries.list(filters));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      // 精确失效，不刷新整个列表
      queryClient.invalidateQueries({ queryKey: productQueries.lists() });
    },
  });

  // 预取详情页 —— 用户 hover 时就开始加载
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

## 样式方案：Tailwind v4 + CSS Modules

CSS-in-JS 在 2026 年基本退出了主流。Tailwind CSS v4 的 JIT 引擎性能大幅提升，加上零运行时的优势，成为了默认选择。

```tsx
// 2026 年的样式组合策略
// Tailwind 用于布局和通用样式
// CSS Modules 用于组件特有的复杂样式

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

## UI 组件库：shadcn/ui 的生态统治

shadcn/ui 不是一个传统意义上的组件库——它是一套可复制的组件代码。2026 年，这个模式被证明是正确的：你需要的不是 npm 包，而是你拥有的、可自由修改的组件代码。

```typescript
// shadcn/ui 的 2026 使用方式
// 安装命令已经变成交互式 CLI
// $ bunx shadcn@latest add dialog combobox data-table

// 组件安装后直接在 src/components/ui/ 中，可以自由修改
// 这是 shadcn/ui 最大的优势：你拥有代码

// 自定义扩展示例：在 shadcn 的 Dialog 基础上封装业务组件
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
  confirmText = '确认',
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

## 测试、构建和其他工具

```typescript
// 2026 年的工具链推荐配置
const toolchain2026 = {
  // 测试
  unitTest: 'Vitest 3.x',
  componentTest: '@testing-library/react + vitest',
  e2e: 'Playwright 1.50+',
  visualRegression: 'Chromatic 或 Playwright screenshot',

  // 构建
  bundler: 'Turbopack (Next.js) / Vite 7 (SPA)',
  packageManager: 'Bun 3.x',

  // 代码质量
  linting: 'Biome 2.x (取代 ESLint + Prettier)',
  typeCheck: 'TypeScript 7.0',

  // 监控
  errorTracking: 'Sentry (仍然主流)',
  performance: 'Web Vitals + 自建 APM',

  // 已淘汰或不推荐
  deprecated: [
    'Webpack —— 被 Turbopack/Vite 取代',
    'ESLint + Prettier —— 被 Biome 取代',
    'Styled-components / Emotion —— 运行时 CSS-in-JS 退出主流',
    'Redux (即使 RTK) —— 被 Zustand 取代',
    'Jest —— 被 Vitest 取代',
    'Yarn / npm —— 被 Bun 取代',
  ],
};
```

## 小结

- 状态管理选 Zustand，数据获取选 TanStack Query，这是 2026 年无争议的默认组合
- CSS-in-JS 已死，Tailwind v4 + CSS Modules 是当前最务实的样式方案
- shadcn/ui 的"拥有代码"模式是组件库的未来方向
- 工具链大洗牌：Biome 取代 ESLint，Vitest 取代 Jest，Bun 取代 npm
- React 生态在 2026 年趋于收敛，选择少了反而更好——因为每个赛道的赢家都很明确
