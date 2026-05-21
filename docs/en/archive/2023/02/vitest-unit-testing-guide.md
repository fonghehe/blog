---
title: "Vitest 1.0: The Next-Gen Standard for Frontend Testing"
date: 2023-02-22 09:48:36
tags:
  - Vite
  - Vitest
readingTime: 2
description: "Vitest 1.0 正式发布了。从 0.x 到 1.0，它已经从\"有趣的实验\"变成了可以认真用在生产环境的测试框架。"
wordCount: 411
---

Vitest 1.0 正式发布了。从 0.x 到 1.0，它已经从"有趣的实验"变成了可以认真用在生产环境的测试框架。

## Why Migrate from Jest

我们项目的痛点：

1. **ESM 支持差**：Jest 对 ESM 的支持一直半生不熟，需要各种 transform 配置
2. **配置繁琐**：`jest.config.js` 里一堆 `moduleNameMapper`、`transform` 规则
3. **速度慢**：大型项目跑完测试要 2-3 分钟
4. **和 Vite 配置割裂**：Vite 有一套 alias 和插件体系，Jest 不认

Vitest 直接复用 Vite 的配置和插件系统，天然支持 ESM、TypeScript、CSS Modules。

## Basic Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.{ts,tsx}"],
    },
  },
});
```

对比 Jest 配置，精简了很多。不需要 `moduleNameMapper`，因为直接用 Vite 的 `resolve.alias`。

## Writing Tests

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Counter } from "./Counter";

describe("Counter", () => {
  it("点击按钮后计数增加", async () => {
    render(<Counter />);
    const button = screen.getByRole("button");

    await fireEvent.click(button);
    await fireEvent.click(button);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("调用 onChange 回调", () => {
    const onChange = vi.fn();
    render(<Counter onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

`vi.fn()` 替代 `jest.fn()`，`vi.mock()` 替代 `jest.mock()`，API 几乎一样，迁移成本很低。

## Unique Advantages

### In-Source Testing

```typescript
// utils.ts
export function add(a: number, b: number) {
  return a + b;
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it("add", () => {
    expect(add(1, 2)).toBe(3);
  });
}
```

测试写在源码里，对于工具函数特别方便。`import.meta.vitest` 在生产构建时会被 tree-shake 掉。

### UI 模式

```bash
vitest --ui
```

Vitest 自带 Web UI，可以可视化查看测试结果、覆盖率，不用额外装插件。

### 快照测试

```typescript
it("渲染一致性", () => {
  const { container } = render(<UserCard user={mockUser} />);
  expect(container).toMatchSnapshot();
});
```

快照格式和 Jest 一致，现有快照文件可以直接复用。

## Performance Comparison

在我们的项目上（~800 个测试用例）：

```
Jest:    68s
Vitest:  12s （单线程）
Vitest:  5s  （多线程，默认开启）
```

Vitest 默认使用 worker threads 并行执行测试，速度提升显著。

## Migration Recommendations

```bash
# 1. 安装
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui

# 2. 全局替换 API
# jest.fn()    -> vi.fn()
# jest.mock()  -> vi.mock()
# jest.spyOn() -> vi.spyOn()
# jest.useFakeTimers() -> vi.useFakeTimers()

# 3. 删除 jest 相关依赖
# jest, ts-jest, @types/jest, babel-jest, jest-environment-jsdom
```

大部分项目的迁移可以在一两天内完成。Jest 的 matcher API（`toBe`、`toEqual` 等）完全一致。

## Summary

- Vitest 1.0 稳定可用，性能比 Jest 快 5-10 倍
- 复用 Vite 配置，消除了 Jest+Vite 配置割裂的问题
- ESM、TypeScript 原生支持，不需要额外 transform
- 从 Jest 迁移成本很低，API 高度兼容
- In-Source Testing 和 UI 模式是额外亮点