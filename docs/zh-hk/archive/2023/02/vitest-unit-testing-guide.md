---
title: "Vitest 1.0：前端測試的下一代標準"
date: 2023-02-22 09:48:36
tags:
  - Vite
  - Vitest
readingTime: 2
description: "Vitest 1.0 正式發佈了。從 0.x 到 1.0，它已經從\"有趣的實驗\"變成了可以認真用在生產環境的測試框架。"
---

Vitest 1.0 正式發佈了。從 0.x 到 1.0，它已經從"有趣的實驗"變成了可以認真用在生產環境的測試框架。

## 為什麼從 Jest 遷移

我們項目的痛點：

1. **ESM 支持差**：Jest 對 ESM 的支持一直半生不熟，需要各種 transform 配置
2. **配置繁瑣**：`jest.config.js` 裏一堆 `moduleNameMapper`、`transform` 規則
3. **速度慢**：大型項目跑完測試要 2-3 分鐘
4. **和 Vite 配置割裂**：Vite 有一套 alias 和插件體系，Jest 不認

Vitest 直接複用 Vite 的配置和插件系統，天然支持 ESM、TypeScript、CSS Modules。

## 基礎配置

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

對比 Jest 配置，精簡了很多。不需要 `moduleNameMapper`，因為直接用 Vite 的 `resolve.alias`。

## 寫測試

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Counter } from "./Counter";

describe("Counter", () => {
  it("點擊按鈕後計數增加", async () => {
    render(<Counter />);
    const button = screen.getByRole("button");

    await fireEvent.click(button);
    await fireEvent.click(button);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("調用 onChange 回調", () => {
    const onChange = vi.fn();
    render(<Counter onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

`vi.fn()` 替代 `jest.fn()`，`vi.mock()` 替代 `jest.mock()`，API 幾乎一樣，遷移成本很低。

## 獨特優勢

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

測試寫在源碼裏，對於工具函數特別方便。`import.meta.vitest` 在生產構建時會被 tree-shake 掉。

### UI 模式

```bash
vitest --ui
```

Vitest 自帶 Web UI，可以可視化查看測試結果、覆蓋率，不用額外裝插件。

### 快照測試

```typescript
it("渲染一致性", () => {
  const { container } = render(<UserCard user={mockUser} />);
  expect(container).toMatchSnapshot();
});
```

快照格式和 Jest 一致，現有快照文件可以直接複用。

## 性能對比

在我們的項目上（~800 個測試用例）：

```
Jest:    68s
Vitest:  12s （單線程）
Vitest:  5s  （多線程，默認開啓）
```

Vitest 默認使用 worker threads 並行執行測試，速度提升顯著。

## 遷移建議

```bash
# 1. 安裝
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui

# 2. 全局替換 API
# jest.fn()    -> vi.fn()
# jest.mock()  -> vi.mock()
# jest.spyOn() -> vi.spyOn()
# jest.useFakeTimers() -> vi.useFakeTimers()

# 3. 刪除 jest 相關依賴
# jest, ts-jest, @types/jest, babel-jest, jest-environment-jsdom
```

大部分項目的遷移可以在一兩天內完成。Jest 的 matcher API（`toBe`、`toEqual` 等）完全一致。

## 小結

- Vitest 1.0 穩定可用，性能比 Jest 快 5-10 倍
- 複用 Vite 配置，消除了 Jest+Vite 配置割裂的問題
- ESM、TypeScript 原生支持，不需要額外 transform
- 從 Jest 遷移成本很低，API 高度兼容
- In-Source Testing 和 UI 模式是額外亮點