---
title: "组件库自动化测试体系：从覆盖率到质量度量"
date: 2023-05-15 16:44:21
tags:
  - 前端
---

作为组件系统 owner，测试覆盖率只是起点。真正重要的是测试能拦住多少线上问题。分享一下我们组件库的测试体系设计。

## 测试分层

```
视觉回归测试（Chromatic / Percy）
    ↑
E2E 测试（Playwright）
    ↑
集成测试（Testing Library）
    ↑
单元测试（Vitest）
```

每一层解决不同的问题，不需要每一层都写到 100% 覆盖。

## 单元测试：纯逻辑

```typescript
// utils/cn.ts 的测试
import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("合并 class 名", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("处理条件 class", () => {
    expect(cn("base", false && "hidden", "end")).toBe("base end");
  });

  it("tailwind 冲突类名去重", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });
});
```

工具函数、hooks、纯逻辑用 Vitest 跑，要求 100% 覆盖。

## 组件集成测试

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "./Select";

describe("Select", () => {
  const options = [
    { label: "选项 A", value: "a" },
    { label: "选项 B", value: "b" },
    { label: "选项 C", value: "c" },
  ];

  it("渲染触发器和选项列表", async () => {
    render(<Select options={options} placeholder="请选择" />);

    expect(screen.getByText("请选择")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("选项 A")).toBeInTheDocument();
    expect(screen.getByText("选项 B")).toBeInTheDocument();
    expect(screen.getByText("选项 C")).toBeInTheDocument();
  });

  it("选中后触发 onChange", async () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);

    await fireEvent.click(screen.getByRole("combobox"));
    await fireEvent.click(screen.getByText("选项 B"));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("键盘导航", async () => {
    render(<Select options={options} />);

    const trigger = screen.getByRole("combobox");
    await fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("选项 A")).toHaveAttribute(
      "data-highlighted",
      "true"
    );
  });
});
```

组件测试关注行为，不关注实现细节。用 `screen.getByRole` 而不是 `getByTestId`，这样测试更接近用户真实操作。

## 视觉回归测试

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

用 Chromatic 做视觉 diff，每次 PR 自动截图对比。设计改了 UI 会自动标记需要 review 的快照。

## E2E 测试：关键路径

```typescript
// tests/dialog.spec.ts
import { test, expect } from "@playwright/test";

test("Dialog 完整交互流程", async ({ page }) => {
  await page.goto("/components/dialog");

  // 打开 Dialog
  await page.click("text=打开弹窗");
  await expect(page.getByRole("dialog")).toBeVisible();

  // 填写表单
  await page.fill('[name="reason"]', "测试原因");
  await page.click("text=确认");

  // 验证关闭和回调
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();
});

test("Dialog 按 Escape 关闭", async ({ page }) => {
  await page.goto("/components/dialog");
  await page.click("text=打开弹窗");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
```

E2E 只覆盖最核心的交互路径，不要写太多——维护成本高、速度慢。

## CI 集成

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

## 小结

- 测试分层：单元覆盖逻辑、集成覆盖行为、E2E 覆盖关键路径、视觉回归覆盖 UI
- 组件测试用 `getByRole` 而非 `getByTestId`，测试更贴近用户视角
- Storybook + Chromatic 做视觉回归，是组件库特有的测试手段
- 不要追求 100% 的覆盖率数字，追求"改了代码有信心发布"