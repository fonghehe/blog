---
title: "Vitest 初体验：Vite 原生的单元测试框架"
date: 2021-11-15 11:13:44
tags:
  - Vite
  - Vitest
readingTime: 2
description: "Vitest 在 2021 年底作为 Vite 生态的测试框架正式亮相。作为一个从 Jest 迁移过来的项目，Vitest 最大的卖点是和 Vite 共享配置和转换管线——不需要额外的打包配置，HMR 支持，以及原生 ESM。"
wordCount: 310
---

Vitest 在 2021 年底作为 Vite 生态的测试框架正式亮相。作为一个从 Jest 迁移过来的项目，Vitest 最大的卖点是和 Vite 共享配置和转换管线——不需要额外的打包配置，HMR 支持，以及原生 ESM。

## 为什么需要 Vitest

在 Vite 项目中用 Jest 并不顺畅：

```
Jest 的问题：
1. Jest 不认 Vite 的别名（@/ → src/）
2. Jest 不支持 Vite 的插件管线（需要单独配置 babel）
3. Jest 不原生支持 ESM，需要 --experimental-vm-modules
4. 两套配置文件，维护成本高
```

Vitest 直接复用 `vite.config.ts`，零配置起步。

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

Vitest 会自动读取 `vite.config.ts`，不需要额外配置。如果需要覆盖：

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,         // 使用全局 API（describe, it, expect）
    environment: 'jsdom',  // 或 'happy-dom'，更快
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
})
```

## 编写测试

API 和 Jest 几乎完全兼容：

```typescript
// src/utils/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('应该正确格式化人民币', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50')
  })

  it('应该处理负数', () => {
    expect(formatCurrency(-99.9)).toBe('-¥99.90')
  })

  it('应该处理零', () => {
    expect(formatCurrency(0)).toBe('¥0.00')
  })
})

describe('formatDate', () => {
  it('应该格式化为 YYYY-MM-DD', () => {
    const date = new Date(2021, 10, 15)
    expect(formatDate(date)).toBe('2021-11-15')
  })
})
```

## Vue 组件测试

用 `@vue/test-utils`，和 Jest 中的用法一样：

```typescript
// src/components/Button.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('应该渲染插槽内容', () => {
    const wrapper = mount(Button, {
      slots: { default: '点击我' }
    })
    expect(wrapper.text()).toContain('点击我')
  })

  it('点击时应该触发 click 事件', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disabled 状态不应该触发事件', async () => {
    const wrapper = mount(Button, {
      props: { disabled: true }
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
```

## Mock 功能

Vitest 内置了 `vi` 对象，提供 mock 功能：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 模块
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: '张三' })
}))

// Mock 定时器
vi.useFakeTimers()

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该在 3 秒后刷新用户数据', async () => {
    const { fetchUser } = await import('./api')
    // ... 测试逻辑
    vi.advanceTimersByTime(3000)
    expect(fetchUser).toHaveBeenCalledTimes(2)
  })
})
```

## 性能对比

在我们组件库项目中的实测数据：

```
项目规模：120 个测试文件，约 800 个测试用例

Jest：      ~18s
Vitest：    ~4s

vitest --watch 的 HMR 响应：约 200ms
```

性能提升主要来自 Vite 的 esbuild 预构建和原生 ESM 支持。

## 小结

- Vitest 和 Vite 共享配置，零配置起步，学习成本低
- API 和 Jest 高度兼容，迁移成本小
- 性能显著优于 Jest，特别是在大型项目中
- 内置 UI 界面（`--ui`）让调试体验更好
- 目前还在快速迭代中，但核心功能已经稳定可用
- 如果项目用 Vite，Vitest 是最自然的测试方案选择