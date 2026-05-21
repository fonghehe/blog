---
title: "Vitest：Vite 原生的測試框架，Jest 的終結者？"
date: 2022-05-24 14:31:37
tags:
  - Vite
  - Vitest
readingTime: 3
description: "如果你的項目用 Vite，那 Vitest 就是測試的最優解。和 Vite 共享配置、同一轉換管道、原生 ESM 支持——Jest 需要各種 hack 才能做到的事，Vitest 天然支持。"
wordCount: 379
---

如果你的項目用 Vite，那 Vitest 就是測試的最優解。和 Vite 共享配置、同一轉換管道、原生 ESM 支持——Jest 需要各種 hack 才能做到的事，Vitest 天然支持。

## 快速上手

```bash
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 與 Jest 的 API 兼容

```typescript
// sum.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sum, asyncSum } from './sum';

describe('sum', () => {
  it('兩數相加', () => {
    expect(sum(1, 2)).toBe(3);
  });

  it('異步計算', async () => {
    const result = await asyncSum(1, 2);
    expect(result).toBe(3);
  });
});

// Mock 函數
describe('with mocks', () => {
  it('spy 函數調用', () => {
    const fn = vi.fn();
    fn('hello');
    expect(fn).toHaveBeenCalledWith('hello');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Mock 模塊', () => {
    vi.mock('./api', () => ({
      fetchData: vi.fn().mockResolvedValue({ id: 1 }),
    }));
  });

  it('Mock 定時器', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    setTimeout(callback, 1000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

大部分 Jest API 可以直接用，遷移成本很低。

## 與 Vite 共享配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
});

// vitest.config.ts
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig({
  ...viteConfig,
  test: {
    environment: 'jsdom',
    globals: true,
    // 測試專用配置
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

路徑別名、插件、環境變量——全部自動繼承，不需要像 Jest 那樣單獨配置 `moduleNameMapper`。

## React 組件測試

```tsx
// Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('渲染文本', () => {
    render(<Button>點擊我</Button>);
    expect(screen.getByText('點擊我')).toBeInTheDocument();
  });

  it('點擊回調', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>點擊</Button>);
    fireEvent.click(screen.getByText('點擊'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('禁用狀態', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>禁用</Button>);
    fireEvent.click(screen.getByText('禁用'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

## Snapshot 測試

```typescript
// config.test.ts
import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from './config';

describe('config', () => {
  it('默認配置快照', () => {
    const config = getDefaultConfig();
    expect(config).toMatchInlineSnapshot(`
      {
        "debug": false,
        "port": 3000,
        "theme": "light",
      }
    `);
  });
});
```

inline snapshot 直接嵌入測試文件，比單獨的 `.snap` 文件更直觀。

## 測試 UI

```bash
vitest --ui
```

Vitest 自帶一個 Web UI，可以查看測試結果、覆蓋率、測試用時。比 Jest 的輸出更友好。

## Mock 策略

```typescript
// Mock 第三方模塊
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { users: [] } }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}));

// Mock 一部分模塊
vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils');
  return {
    ...actual,
    formatDate: vi.fn().mockReturnValue('2022-01-01'),
  };
});

// Mock CSS 模塊
vi.mock('*.module.css', () => ({
  default: { container: 'mock-container' },
}));

// Mock 圖片
vi.mock('*.svg', () => ({
  default: 'mock-svg-url',
}));
```

## 性能對比

我們一箇中型項目的測試套件（150 個測試文件，800 個測試用例）：

| 指標 | Jest | Vitest |
|
------|------|--------|
| 全量執行 | 28s | 8s |
| 單文件運行 | 3.2s | 0.8s |
| watch 模式重跑 | 1.8s | 0.3s |
| 啓動時間 | 4.5s | 1.2s |

快了 3 倍以上，主要是因為 Vitest 利用了 Vite 的轉換管道，避免了重複編譯。

## 從 Jest 遷移

```typescript
// vitest.config.ts - 兼容 Jest 的全局 API
export default defineConfig({
  test: {
    globals: true,        // 不需要 import { describe } from 'vitest'
    environment: 'jsdom',
    // Jest 的 setupFilesAfterSetup
    setupFiles: ['./vitest.setup.ts'],
    // Jest 的 testMatch
    include: ['**/*.test.{ts,tsx}'],
    // Jest 的 transform
    // 不需要！Vite 已經處理了
  },
});
```

遷移步驟：
1. `pnpm add -D vitest`
2. 把 jest.config 改為 vitest.config（API 很像）
3. 把 `jest.fn()` 替換為 `vi.fn()`（大部分用全局模式不需要改）
4. 刪除 jest 相關依賴

## 小結

Vitest 不是 Jest 的簡單替代品，而是 Vite 生態的原生測試方案。速度快、配置簡單、與 Vite 深度集成。對於用 Vite 的項目，沒有理由不遷移。