---
title: "React 生态 2025 全景图"
date: 2025-01-24 10:00:00
tags:
  - React
---

React 20 发布后，整个生态系统发生了剧烈洗牌。很多曾经不可或缺的库被原生 API 取代，新的工具链也在重新定义开发体验。这篇文章梳理 2025 年初 React 生态的现状，帮你做出技术选型决策。

## 状态管理：谁还需要 Redux？

React 20 的 `useActionState`、Compiler 自动记忆化、和改进的 Context 让大部分状态管理需求回归原生。

```javascript
// 2025 的状态管理决策树

// 场景一：服务端状态 -> TanStack Query
import { useSuspenseQuery } from '@tanstack/react-query';
function UserProfile({ id }) {
  const { data } = useSuspenseQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  });
  return <Profile user={data} />;
}

// 场景二：表单/表单交互状态 -> React 原生
import { useField, Form } from 'react';
function LoginForm() {
  const email = useField({ name: 'email' });
  const password = useField({ name: 'password' });
  return <Form action={handleLogin}>...</Form>;
}

// 场景三：全局 UI 状态（主题、侧边栏） -> Context + useSyncExternalStore
import { useSyncExternalStore } from 'react';
const themeStore = {
  subscribe: (cb) => { /* ... */ return () => {}; },
  getSnapshot: () => currentTheme,
};
function ThemeToggle() {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return <button onClick={toggleTheme}>{theme === 'dark' ? '🌙' : '☀️'}</button>;
}

// 场景四：复杂客户端状态（协同编辑、游戏） -> Zustand
import { create } from 'zustand';
const useEditorStore = create((set) => ({
  nodes: [],
  selectedId: null,
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  selectNode: (id) => set({ selectedId: id }),
}));
```

Zustand 在 2025 年仍然是复杂客户端状态的首选，API 简洁且与 React 20 Compiler 完全兼容。Jotai 和 Recoil 逐渐式微，原生 Context + `useSyncExternalStore` 已经能满足大部分原子状态需求。

## 构建工具：Vite + Rspack 双雄

```javascript
// vite.config.ts - 2025 推荐配置
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
        // 利用 import map 实现更好的缓存
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
// rspack.config.js - 需要 Webpack 兼容性时的选择
const { defineConfig } = require('@rspack/core');
const { ReactCompilerRspackPlugin } = require('react-compiler-rspack');

module.exports = defineConfig({
  plugins: [
    new ReactCompilerRspackPlugin(),
  ],
  experiments: {
    rspackFuture: {
      newIncremental: true, // 增量编译
    },
  },
});
```

Rspack 2.0 在大型 Webpack 项目迁移中表现优异，API 兼容度达到 98%。Vite 6 在纯新项目中仍是首选，冷启动速度无人能及。

## CSS 方案：零运行时是王道

```javascript
// 2025 的 CSS 方案对比

// ✅ 推荐：CSS Modules (零运行时，原生支持)
import styles from './Button.module.css';
function Button({ children }) {
  return <button className={styles.primary}>{children}</button>;
}

// ✅ 推荐：Tailwind CSS 4 + Oxide 引擎
// 构建速度提升 10x，不再需要 PostCSS
function Card({ title, description }) {
  return (
    <div className="rounded-lg border p-4 hover:shadow-lg transition-shadow">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-gray-600 mt-1">{description}</p>
    </div>
  );
}

// ⚠️ 谨慎：CSS-in-JS (有运行时开销)
// styled-components 和 Emotion 仍在维护，但新项目不推荐

// ✅ 新选择：StyleX (Meta 出品，编译期 CSS-in-JS)
import { stylex } from '@stylexjs/react';
const styles = stylex.create({
  base: { padding: 16, borderRadius: 8 },
  primary: { backgroundColor: '#3b82f6', color: 'white' },
});
function Button({ children }) {
  return <button {...stylex.props(styles.base, styles.primary)}>{children}</button>;
}
```

## 测试和 AI 工具

```javascript
// Vitest + Testing Library 是 2025 的标准测试组合
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import UserProfile from './UserProfile';

test('renders user name', () => {
  render(<UserProfile user={{ name: '张三', role: 'admin' }} />);
  expect(screen.getByText('张三')).toBeInTheDocument();
  expect(screen.getByText('管理员')).toBeInTheDocument();
});

// AI 辅助工具链
// - Cursor / Claude Code：代码生成和重构
// - v0.dev (Vercel)：UI 组件生成
// - GitHub Copilot Workspace：Issue 到 PR 的自动化
```

## 小结

- 状态管理回归原生：TanStack Query 处理服务端状态，Zustand 处理复杂客户端状态，其他场景用 Context
- 构建工具：Vite 6 是新项目首选，Rspack 2.0 是 Webpack 迁移的最佳路径
- CSS 方案：CSS Modules 和 Tailwind 4 是主流，StyleX 是 CSS-in-JS 的未来方向
- 测试：Vitest + Testing Library 已经完全取代 Jest + RTL
- AI 工具成为开发标配，但核心架构决策仍需工程师把关
