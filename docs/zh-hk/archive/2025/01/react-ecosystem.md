---
title: "React 生態 2025 全景圖：落地路徑與實戰建議"
date: 2025-01-24 13:18:55
tags:
  - React
readingTime: 2
description: "React 20 發佈後，整個生態系統發生了劇烈洗牌。很多曾經不可或缺的庫被原生 API 取代，新的工具鏈也在重新定義開發體驗。這篇文章梳理 2025 年初 React 生態的現狀，幫你做出技術選型決策。"
wordCount: 360
---

React 20 發佈後，整個生態系統發生了劇烈洗牌。很多曾經不可或缺的庫被原生 API 取代，新的工具鏈也在重新定義開發體驗。這篇文章梳理 2025 年初 React 生態的現狀，幫你做出技術選型決策。

## 狀態管理：誰還需要 Redux？

React 20 的 `useActionState`、Compiler 自動記憶化、和改進的 Context 讓大部分狀態管理需求迴歸原生。

```javascript
// 2025 的狀態管理決策樹

// 場景一：服務端狀態 -> TanStack Query
import { useSuspenseQuery } from '@tanstack/react-query';
function UserProfile({ id }) {
  const { data } = useSuspenseQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  });
  return <Profile user={data} />;
}

// 場景二：表單/表單交互狀態 -> React 原生
import { useField, Form } from 'react';
function LoginForm() {
  const email = useField({ name: 'email' });
  const password = useField({ name: 'password' });
  return <Form action={handleLogin}>...</Form>;
}

// 場景三：全局 UI 狀態（主題、側邊欄） -> Context + useSyncExternalStore
import { useSyncExternalStore } from 'react';
const themeStore = {
  subscribe: (cb) => { /* ... */ return () => {}; },
  getSnapshot: () => currentTheme,
};
function ThemeToggle() {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return <button onClick={toggleTheme}>{theme === 'dark' ? '🌙' : '☀️'}</button>;
}

// 場景四：複雜客户端狀態（協同編輯、遊戲） -> Zustand
import { create } from 'zustand';
const useEditorStore = create((set) => ({
  nodes: [],
  selectedId: null,
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  selectNode: (id) => set({ selectedId: id }),
}));
```

Zustand 在 2025 年仍然是複雜客户端狀態的首選，API 簡潔且與 React 20 Compiler 完全相容。Jotai 和 Recoil 逐漸式微，原生 Context + `useSyncExternalStore` 已經能滿足大部分原子狀態需求。

## 構建工具：Vite + Rspack 雙雄

```javascript
// vite.config.ts - 2025 推薦配置
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactCompiler } from 'react-compiler-vite';

export default defineConfig({
  plugins: [
    react(),
    reactCompiler(),
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // 利用 import map 實現更好的緩存
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['@tanstack/react-router'],
        },
      },
    },
  },
});
```

```javascript
// rspack.config.js - 需要 Webpack 相容性時的選擇
const { defineConfig } = require('@rspack/core');
const { ReactCompilerRspackPlugin } = require('react-compiler-rspack');

module.exports = defineConfig({
  plugins: [
    new ReactCompilerRspackPlugin(),
  ],
  experiments: {
    rspackFuture: {
      newIncremental: true, // 增量編譯
    },
  },
});
```

Rspack 2.0 在大型 Webpack 項目遷移中表現優異，API 相容度達到 98%。Vite 6 在純新項目中仍是首選，冷啓動速度無人能及。

## CSS 方案：零運行時是王道

```javascript
// 2025 的 CSS 方案對比

// ✅ 推薦：CSS Modules (零運行時，原生支援)
import styles from './Button.module.css';
function Button({ children }) {
  return <button className={styles.primary}>{children}</button>;
}

// ✅ 推薦：Tailwind CSS 4 + Oxide 引擎
// 構建速度提升 10x，不再需要 PostCSS
function Card({ title, description }) {
  return (
    <div className="rounded-lg border p-4 hover:shadow-lg transition-shadow">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-gray-600 mt-1">{description}</p>
    </div>
  );
}

// ⚠️ 謹慎：CSS-in-JS (有運行時開銷)
// styled-components 和 Emotion 仍在維護，但新項目不推薦

// ✅ 新選擇：StyleX (Meta 出品，編譯期 CSS-in-JS)
import { stylex } from '@stylexjs/react';
const styles = stylex.create({
  base: { padding: 16, borderRadius: 8 },
  primary: { backgroundColor: '#3b82f6', color: 'white' },
});
function Button({ children }) {
  return <button {...stylex.props(styles.base, styles.primary)}>{children}</button>;
}
```

## 測試和 AI 工具

```javascript
// Vitest + Testing Library 是 2025 的標準測試組合
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import UserProfile from './UserProfile';

test('renders user name', () => {
  render(<UserProfile user={{ name: '張三', role: 'admin' }} />);
  expect(screen.getByText('張三')).toBeInTheDocument();
  expect(screen.getByText('管理員')).toBeInTheDocument();
});

// AI 輔助工具鏈
// - Cursor / Claude Code：代碼生成和重構
// - v0.dev (Vercel)：UI 組件生成
// - GitHub Copilot Workspace：Issue 到 PR 的自動化
```

## 小結

- 狀態管理迴歸原生：TanStack Query 處理服務端狀態，Zustand 處理複雜客户端狀態，其他場景用 Context
- 構建工具：Vite 6 是新項目首選，Rspack 2.0 是 Webpack 遷移的最佳路徑
- CSS 方案：CSS Modules 和 Tailwind 4 是主流，StyleX 是 CSS-in-JS 的未來方向
- 測試：Vitest + Testing Library 已經完全取代 Jest + RTL
- AI 工具成為開發標配，但核心架構決策仍需工程師把關
