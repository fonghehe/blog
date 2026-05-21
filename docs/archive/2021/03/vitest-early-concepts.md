---
title: "Jest 前世今生：Vite 原生测试框架的构想"
date: 2021-03-15 11:13:15
tags:
  - Vite
  - Vitest
readingTime: 4
description: "最近社区在讨论一个话题：既然 Vite 已经解决了开发和构建的问题，为什么测试环节还是需要一套独立的、和 Vite 完全无关的工具链？测试跑在 Node 上，用 Jest 的 transform 配置，又回到了 Babel/TypeScript 编译那一套。如果测试也能复用 Vite 的模块解析和转换能力呢？"
wordCount: 696
---

最近社区在讨论一个话题：既然 Vite 已经解决了开发和构建的问题，为什么测试环节还是需要一套独立的、和 Vite 完全无关的工具链？测试跑在 Node 上，用 Jest 的 transform 配置，又回到了 Babel/TypeScript 编译那一套。如果测试也能复用 Vite 的模块解析和转换能力呢？

## 现有测试工具的痛点

用 Jest 跑 Vite 项目，配置复杂且容易出错：

```javascript
// jest.config.js —— 一个 Vite + Vue 3 + TypeScript 项目的典型配置
module.exports = {
  // 需要配置 transform 来处理 TS
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.vue$': '@vue/vue3-jest'
  },

  // 需要配置模块别名（和 vite.config.ts 重复）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 需要配置文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'vue'],

  // 需要配置环境
  testEnvironment: 'jsdom',

  // CSS 文件要 mock
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '\\.(png|jpg|svg)$': '<rootDir>/__mocks__/fileMock.js'
  }
}
```

几个问题很明显：

1. **配置重复**：vite.config.ts 里配了一遍别名、CSS 预处理、TS 转换，jest.config.js 里再配一遍
2. **转换链不同**：Vite 用 esbuild 编译，Jest 用 Babel/ts-jest，两套编译结果可能不一致
3. **调试困难**：测试和开发用不同的工具链，出了问题不好定位

## 复用 Vite 的思路

核心想法很直接：让测试也走 Vite 的模块处理管道。Vite 内部已经有一个 transform pipeline，处理 TypeScript、Vue SFC、CSS Modules、静态资源等，测试只需要复用它。

```
现有的工具链：
  开发: Vite (esbuild) → 浏览器
  测试: Jest (Babel/ts-jest) → Node/JSDOM
  构建: Vite (Rollup) → 生产

理想状态：
  开发: Vite → 浏览器
  测试: Vite → Node/JSDOM
  构建: Vite → 生产
```

基于这个思路，可以设计一个 Vite 原生的测试运行器。核心是利用 Vite 的 `createServer` API 做模块转换：

```javascript
// 概念验证：用 Vite 做测试的模块加载器
import { createServer } from 'vite'

async function createTestRunner() {
  // 复用项目的 vite.config.ts
  const server = await createServer({
    // 不需要启动 HTTP 服务
    server: { middlewareMode: true },
    // 测试环境配置
    optimizeDeps: { disabled: true },
    // 覆盖一些配置
    mode: 'test'
  })

  // 利用 Vite 的 transform 能力处理模块
  async function loadModule(filepath) {
    // Vite 会处理 TS、Vue SFC、CSS 等
    const result = await server.transformRequest(filepath)
    // 在 Node 中执行
    return executeInNode(result.code)
  }

  return { loadModule, close: () => server.close() }
}
```

## 假设的 API 设计

如果要设计一个 Vite 原生的测试框架，API 应该是什么样的？

```typescript
// jest.config.ts —— 直接复用 Vite 配置
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

测试文件写法和 Jest 类似，但不需要额外配置：

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

组件测试：

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

## 和现有方案的对比

| 维度 | Jest | 未来方案（Vite 原生） |
|
------|------|---------------------|
| 配置 | 独立配置，和 Vite 重复 | 继承 vite.config.ts |
| 转换 | Babel/ts-jest | Vite transform（esbuild） |
| 速度 | 中等 | 预期更快（esbuild 编译） |
| 生态 | 成熟（jest-dom、msw 等） | 需要兼容层 |
| 模块处理 | CommonJS 为主 | ESM 原生 |
| Mock | jest.mock() | import.meta.jest 或类似的 |

## 对未来的展望

几个方向值得关注：

1. **esbuild 编译测试文件**：比 Babel 快很多，且 TypeScript 支持开箱即用
2. **ESM 原生**：不再需要 `transform` 把 ESM 转成 CJS，测试直接跑 ESM
3. **Jest 兼容**：上层 API 兼容 Jest，迁移成本低
4. **JSDOM / happy-dom**：统一的 DOM 环境管理
5. **Watch 模式利用 Vite HMR**：文件变更时利用 Vite 的 HMR 管道增量更新

如果社区能把这个方向做好，2021 年下半年前端工具链会真正实现 Vite 全覆盖——开发、测试、构建，一套配置搞定。

## 小结

- 目前测试工具链和 Vite 开发工具链割裂，配置重复且编译器不一致
- 核心思路是复用 Vite 的 transform 管道，让测试也走 esbuild 编译
- API 设计上可以继承 vite.config.ts，减少重复配置
- Jest 生态成熟，新方案需要兼容层（jest 的 describe/it/expect API）
- 这个方向值得期待，可能会在 2021 年下半年实现