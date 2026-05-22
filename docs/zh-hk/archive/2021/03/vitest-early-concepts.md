---
title: "Jest 前世今生：Vite 原生測試框架的構想"
date: 2021-03-15 11:13:15
tags:
  - Vite
  - Vitest
readingTime: 4
description: "最近社區在討論一個話題：既然 Vite 已經解決了開發和構建的問題，為什麼測試環節還是需要一套獨立的、和 Vite 完全無關的工具鏈？測試跑在 Node 上，用 Jest 的 transform 設定，又回到了 Babel/TypeScript 編譯那一套。如果測試也能複用 Vite 的模塊解析和轉換能力呢？"
wordCount: 696
---

最近社區在討論一個話題：既然 Vite 已經解決了開發和構建的問題，為什麼測試環節還是需要一套獨立的、和 Vite 完全無關的工具鏈？測試跑在 Node 上，用 Jest 的 transform 設定，又回到了 Babel/TypeScript 編譯那一套。如果測試也能複用 Vite 的模塊解析和轉換能力呢？

## 現有測試工具的痛點

用 Jest 跑 Vite 項目，配置複雜且容易出錯：

```javascript
// jest.config.js —— 一個 Vite + Vue 3 + TypeScript 項目的典型配置
module.exports = {
  // 需要設定 transform 來處理 TS
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.vue$': '@vue/vue3-jest'
  },

  // 需要設定模塊別名（和 vite.config.ts 重複）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 需要設定檔案擴展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'vue'],

  // 需要設定環境
  testEnvironment: 'jsdom',

  // CSS 文件要 mock
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '\\.(png|jpg|svg)$': '<rootDir>/__mocks__/fileMock.js'
  }
}
```

幾個問題很明顯：

1. **配置重複**：vite.config.ts 裏配了一遍別名、CSS 預處理、TS 轉換，jest.config.js 裏再配一遍
2. **轉換鏈不同**：Vite 用 esbuild 編譯，Jest 用 Babel/ts-jest，兩套編譯結果可能不一致
3. **調試困難**：測試和開發用不同的工具鏈，出了問題不好定位

## 複用 Vite 的思路

核心想法很直接：讓測試也走 Vite 的模塊處理管道。Vite 內部已經有一個 transform pipeline，處理 TypeScript、Vue SFC、CSS Modules、靜態資源等，測試隻需要複用它。

```
現有的工具鏈：
  開發: Vite (esbuild) → 瀏覽器
  測試: Jest (Babel/ts-jest) → Node/JSDOM
  構建: Vite (Rollup) → 生產

理想狀態：
  開發: Vite → 瀏覽器
  測試: Vite → Node/JSDOM
  構建: Vite → 生產
```

基於這個思路，可以設計一個 Vite 原生的測試運行器。核心是利用 Vite 的 `createServer` API 做模塊轉換：

```javascript
// 概念驗證：用 Vite 做測試的模塊加載器
import { createServer } from 'vite'

async function createTestRunner() {
  // 複用項目的 vite.config.ts
  const server = await createServer({
    // 不需要啓動 HTTP 服務
    server: { middlewareMode: true },
    // 測試環境配置
    optimizeDeps: { disabled: true },
    // 覆蓋一些配置
    mode: 'test'
  })

  // 利用 Vite 的 transform 能力處理模塊
  async function loadModule(filepath) {
    // Vite 會處理 TS、Vue SFC、CSS 等
    const result = await server.transformRequest(filepath)
    // 在 Node 中執行
    return executeInNode(result.code)
  }

  return { loadModule, close: () => server.close() }
}
```

## 假設的 API 設計

如果要設計一個 Vite 原生的測試框架，API 應該是什麼樣的？

```typescript
// jest.config.ts —— 直接複用 Vite 配置
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,          // 全局 API（describe/it/expect）
    environment: 'jsdom',   // 或 'happy-dom'
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules'],
    coverage: {
      provider: 'c8',       // 或 'istanbul'
      reporter: ['text', 'html']
    }
  }
})
```

測試檔案寫法和 Jest 類似，但不需要額外設定：

```typescript
// src/utils/format.test.ts
import { describe, it, expect } from 'jest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('should format number to currency', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50')
  })

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('¥0.00')
  })
})

describe('formatDate', () => {
  it('should format date to yyyy-MM-dd', () => {
    const date = new Date(2021, 2, 15)
    expect(formatDate(date)).toBe('2021-03-15')
  })
})
```

組件測試：

```typescript
// src/components/Button.test.ts
import { describe, it, expect } from 'jest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Click me' }
    })
    expect(wrapper.text()).toContain('Click me')
  })

  it('emits click event', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disables when disabled prop is true', () => {
    const wrapper = mount(Button, {
      props: { disabled: true }
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

## 和現有方案的對比

| 維度 | Jest | 未來方案（Vite 原生） |
|
------|------|---------------------|
| 配置 | 獨立配置，和 Vite 重複 | 繼承 vite.config.ts |
| 轉換 | Babel/ts-jest | Vite transform（esbuild） |
| 速度 | 中等 | 預期更快（esbuild 編譯） |
| 生態 | 成熟（jest-dom、msw 等） | 需要相容層 |
| 模塊處理 | CommonJS 為主 | ESM 原生 |
| Mock | jest.mock() | import.meta.jest 或類似的 |

## 對未來的展望

幾個方向值得關注：

1. **esbuild 編譯測試文件**：比 Babel 快很多，且 TypeScript 支持開箱即用
2. **ESM 原生**：不再需要 `transform` 把 ESM 轉成 CJS，測試直接跑 ESM
3. **Jest 兼容**：上層 API 兼容 Jest，遷移成本低
4. **JSDOM / happy-dom**：統一的 DOM 環境管理
5. **Watch 模式利用 Vite HMR**：文件變更時利用 Vite 的 HMR 管道增量更新

如果社區能把這個方向做好，2021 年下半年前端工具鏈會真正實現 Vite 全覆蓋——開發、測試、構建，一套配置搞定。

## 小結

- 目前測試工具鏈和 Vite 開發工具鏈割裂，配置重複且編譯器不一致
- 核心思路是複用 Vite 的 transform 管道，讓測試也走 esbuild 編譯
- API 設計上可以繼承 vite.config.ts，減少重複配置
- Jest 生態成熟，新方案需要相容層（jest 的 describe/it/expect API）
- 這個方向值得期待，可能會在 2021 年下半年實現