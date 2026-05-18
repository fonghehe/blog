---
title: "用 AI 生成設計系統：從 Figma 到程式碼"
date: 2025-06-08 10:00:00
tags:
  - 工程化
readingTime: 3
description: "設計系統建設一直是前端團隊的重活。2025 年，AI 工具讓這個過程的效率有了質的提升。來分享一下我們團隊的實踐。"
---

設計系統建設一直是前端團隊的重活。2025 年，AI 工具讓這個過程的效率有了質的提升。來分享一下我們團隊的實踐。

## 傳統流程 vs AI 流程

```
傳統流程（4-6 周）：
  設計師出稿 → 前端還原 → 手寫 Storybook → 反覆調整 → 完成

AI 流程（1-2 周）：
  設計師出稿 → AI 生成初始程式碼 → 前端 review 調整 → 完成
  同時：AI 自動生成 Storybook、測試、文件
```

## 第一步：定義 Design Token

```ts
// tokens/colors.ts
// AI 根據設計稿的色板自動生成

export const colors = {
  // 基礎色
  gray: {
    50: "oklch(0.98 0.005 264)",
    100: "oklch(0.96 0.008 264)",
    200: "oklch(0.92 0.012 264)",
    300: "oklch(0.85 0.02 264)",
    400: "oklch(0.7 0.025 264)",
    500: "oklch(0.55 0.03 264)",
    600: "oklch(0.45 0.03 264)",
    700: "oklch(0.37 0.025 264)",
    800: "oklch(0.27 0.02 264)",
    900: "oklch(0.2 0.015 264)",
    950: "oklch(0.14 0.01 264)",
  },
  primary: {
    50: "oklch(0.97 0.02 250)",
    500: "oklch(0.55 0.2 250)",
    900: "oklch(0.25 0.1 250)",
  },
  semantic: {
    success: "oklch(0.65 0.18 145)",
    warning: "oklch(0.75 0.16 75)",
    error: "oklch(0.55 0.2 25)",
    info: "oklch(0.55 0.2 250)",
  },
} as const;
```

## 第二步：AI 生成元件

```tsx
// 給 Claude Code 的 prompt：
// "根據 design-token.json 生成 Button 元件，
//  支援 5 種 variant、3 種 size、loading 狀態，
//  使用 forwardRef，配套 Storybook stories"

// AI 生成的元件（經人工 review 調整後）
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500",
        outline: "border border-gray-300 bg-transparent hover:bg-gray-50 focus-visible:ring-gray-500",
        ghost: "bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500",
        danger: "bg-error-500 text-white hover:bg-error-600 focus-visible:ring-error-500",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner className="h-4 w-4 animate-spin" />}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants, type ButtonProps };
```

## 第三步：AI 生成 Storybook

```tsx
// Button.stories.tsx — AI 自動生成
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    children: { control: "text" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: "按鈕", variant: "primary" } };
export const Secondary: Story = { args: { children: "按鈕", variant: "secondary" } };
export const Outline: Story = { args: { children: "按鈕", variant: "outline" } };
export const Ghost: Story = { args: { children: "按鈕", variant: "ghost" } };
export const Danger: Story = { args: { children: "刪除", variant: "danger" } };
export const Loading: Story = { args: { children: "載入中", loading: true } };
export const Small: Story = { args: { children: "小按鈕", size: "sm" } };
export const Large: Story = { args: { children: "大按鈕", size: "lg" } };
```

## 第四步：AI 自動生成測試

```tsx
// Button.test.tsx — AI 自動生成
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>點選</Button>);
    expect(screen.getByRole("button", { name: "點選" })).toBeInTheDocument();
  });

  it("applies variant classes correctly", () => {
    const { rerender } = render(<Button variant="primary">按鈕</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary-500");

    rerender(<Button variant="danger">按鈕</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-error-500");
  });

  it("shows loading state", () => {
    render(<Button loading>提交</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("calls onClick handler", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>點選</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>點選</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

## 效率資料

```
元件數量    傳統方式    AI 輔助    效率提升
─────────────────────────────────────────
5 個元件     1 周      1.5 天      3.3x
20 個元件    4 周      1 周        4x
50 個元件    10 周     2.5 周      4x

注意：AI 生成的程式碼平均需要 30% 的人工調整
```

## 小結

- AI 不能替代設計師和前端工程師的思考，但能大幅減少重複勞動
- Token 管理是設計系統的基礎，AI 幫忙但 Token 定義需要人工決策
- AI 生成的元件程式碼質量不錯，但一定要做 review
- Storybook、測試、文件的自動生成是 AI 的最大價值
- 投入時間建立 prompt 模板，複用率很高
