---
title: "元件庫自動化測試體系：從覆蓋率到質量度量"
date: 2023-05-15 16:44:21
tags:
  - 前端
readingTime: 2
description: "作為元件系統 owner，測試覆蓋率只是起點。真正重要的是測試能攔住多少線上問題。分享一下我們元件庫的測試體系設計。"
---

作為元件系統 owner，測試覆蓋率只是起點。真正重要的是測試能攔住多少線上問題。分享一下我們元件庫的測試體系設計。

## 測試分層

```
視覺迴歸測試（Chromatic / Percy）
    ↑
E2E 測試（Playwright）
    ↑
整合測試（Testing Library）
    ↑
單元測試（Vitest）
```

每一層解決不同的問題，不需要每一層都寫到 100% 覆蓋。

## 單元測試：純邏輯

```typescript
// utils/cn.ts 的測試
import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("合併 class 名", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("處理條件 class", () => {
    expect(cn("base", false && "hidden", "end")).toBe("base end");
  });

  it("tailwind 衝突類名去重", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });
});
```

工具函式、hooks、純邏輯用 Vitest 跑，要求 100% 覆蓋。

## 元件整合測試

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "./Select";

describe("Select", () => {
  const options = [
    { label: "選項 A", value: "a" },
    { label: "選項 B", value: "b" },
    { label: "選項 C", value: "c" },
  ];

  it("渲染觸發器和選項列表", async () => {
    render(<Select options={options} placeholder="請選擇" />);

    expect(screen.getByText("請選擇")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("選項 A")).toBeInTheDocument();
    expect(screen.getByText("選項 B")).toBeInTheDocument();
    expect(screen.getByText("選項 C")).toBeInTheDocument();
  });

  it("選中後觸發 onChange", async () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);

    await fireEvent.click(screen.getByRole("combobox"));
    await fireEvent.click(screen.getByText("選項 B"));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("鍵盤導航", async () => {
    render(<Select options={options} />);

    const trigger = screen.getByRole("combobox");
    await fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("選項 A")).toHaveAttribute(
      "data-highlighted",
      "true"
    );
  });
});
```

元件測試關注行為，不關注實現細節。用 `screen.getByRole` 而不是 `getByTestId`，這樣測試更接近使用者真實操作。

## 視覺迴歸測試

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div data-theme="dark" className="p-4 bg-gray-900">
      <Button variant="primary">Dark Mode</Button>
    </div>
  ),
};
```

用 Chromatic 做視覺 diff，每次 PR 自動截圖對比。設計改了 UI 會自動標記需要 review 的快照。

## E2E 測試：關鍵路徑

```typescript
// tests/dialog.spec.ts
import { test, expect } from "@playwright/test";

test("Dialog 完整互動流程", async ({ page }) => {
  await page.goto("/components/dialog");

  // 開啟 Dialog
  await page.click("text=開啟彈窗");
  await expect(page.getByRole("dialog")).toBeVisible();

  // 填寫表單
  await page.fill('[name="reason"]', "測試原因");
  await page.click("text=確認");

  // 驗證關閉和回撥
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();
});

test("Dialog 按 Escape 關閉", async ({ page }) => {
  await page.goto("/components/dialog");
  await page.click("text=開啟彈窗");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
```

E2E 只覆蓋最核心的互動路徑，不要寫太多——維護成本高、速度慢。

## CI 整合

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit
      - run: pnpm test:e2e
      - run: pnpm chromatic --exit-zero-on-changes
```

## 小結

- 測試分層：單元覆蓋邏輯、整合覆蓋行為、E2E 覆蓋關鍵路徑、視覺迴歸覆蓋 UI
- 元件測試用 `getByRole` 而非 `getByTestId`，測試更貼近使用者視角
- Storybook + Chromatic 做視覺迴歸，是元件庫特有的測試手段
- 不要追求 100% 的覆蓋率數字，追求"改了程式碼有信心釋出"