---
title: "Vitest 初體驗：Vite 原生的單元測試框架"
date: 2021-11-15 11:13:44
tags:
  - Vite
  - Vitest
readingTime: 2
description: "Vitest 在 2021 年底作為 Vite 生態的測試框架正式亮相。作為一個從 Jest 遷移過來的專案，Vitest 最大的賣點是和 Vite 共享配置和轉換管線——不需要額外的打包配置，HMR 支援，以及原生 ESM。"
wordCount: 310
---

Vitest 在 2021 年底作為 Vite 生態的測試框架正式亮相。作為一個從 Jest 遷移過來的專案，Vitest 最大的賣點是和 Vite 共享配置和轉換管線——不需要額外的打包配置，HMR 支援，以及原生 ESM。

## 為什麼需要 Vitest

在 Vite 專案中用 Jest 並不順暢：

```
Jest 的問題：
1. Jest 不認 Vite 的別名（@/ → src/）
2. Jest 不支援 Vite 的外掛管線（需要單獨配置 babel）
3. Jest 不原生支援 ESM，需要 --experimental-vm-modules
4. 兩套配置檔案，維護成本高
```

Vitest 直接複用 `vite.config.ts`，零配置起步。

## 快速上手

```bash
npm install -D vitest

# package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

Vitest 會自動讀取 `vite.config.ts`，不需要額外配置。如果需要覆蓋：

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,         // 使用全域性 API（describe, it, expect）
    environment: 'jsdom',  // 或 'happy-dom'，更快
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
})
```

## 編寫測試

API 和 Jest 幾乎完全相容：

```typescript
// src/utils/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('應該正確格式化人民幣', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50')
  })

  it('應該處理負數', () => {
    expect(formatCurrency(-99.9)).toBe('-¥99.90')
  })

  it('應該處理零', () => {
    expect(formatCurrency(0)).toBe('¥0.00')
  })
})

describe('formatDate', () => {
  it('應該格式化為 YYYY-MM-DD', () => {
    const date = new Date(2021, 10, 15)
    expect(formatDate(date)).toBe('2021-11-15')
  })
})
```

## Vue 元件測試

用 `@vue/test-utils`，和 Jest 中的用法一樣：

```typescript
// src/components/Button.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('應該渲染插槽內容', () => {
    const wrapper = mount(Button, {
      slots: { default: '點選我' }
    })
    expect(wrapper.text()).toContain('點選我')
  })

  it('點選時應該觸發 click 事件', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disabled 狀態不應該觸發事件', async () => {
    const wrapper = mount(Button, {
      props: { disabled: true }
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
```

## Mock 功能

Vitest 內建了 `vi` 物件，提供 mock 功能：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 模組
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: '張三' })
}))

// Mock 定時器
vi.useFakeTimers()

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('應該在 3 秒後重新整理使用者資料', async () => {
    const { fetchUser } = await import('./api')
    // ... 測試邏輯
    vi.advanceTimersByTime(3000)
    expect(fetchUser).toHaveBeenCalledTimes(2)
  })
})
```

## 效能對比

在我們元件庫專案中的實測資料：

```
專案規模：120 個測試檔案，約 800 個測試用例

Jest：      ~18s
Vitest：    ~4s

vitest --watch 的 HMR 響應：約 200ms
```

效能提升主要來自 Vite 的 esbuild 預構建和原生 ESM 支援。

## 小結

- Vitest 和 Vite 共享配置，零配置起步，學習成本低
- API 和 Jest 高度相容，遷移成本小
- 效能顯著優於 Jest，特別是在大型專案中
- 內建 UI 介面（`--ui`）讓除錯體驗更好
- 目前還在快速迭代中，但核心功能已經穩定可用
- 如果專案用 Vite，Vitest 是最自然的測試方案選擇