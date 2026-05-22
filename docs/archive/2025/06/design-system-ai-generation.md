---
title: "用 AI 生成设计系统：从 Figma 到代码"
date: 2025-06-08 11:22:59
tags:
  - 工程化
readingTime: 3
description: "设计系统建设一直是前端团队的重活。2025 年，AI 工具让这个过程的效率有了质的提升。来分享一下我们团队的实践。"
wordCount: 198
---

设计系统建设一直是前端团队的重活。2025 年，AI 工具让这个过程的效率有了质的提升。来分享一下我们团队的实践。

## 传统流程 vs AI 流程

```
传统流程（4-6 周）：
  设计师出稿 → 前端还原 → 手写 Storybook → 反复调整 → 完成

AI 流程（1-2 周）：
  设计师出稿 → AI 生成初始代码 → 前端 review 调整 → 完成
  同时：AI 自动生成 Storybook、测试、文档
```

## 第一步：定义 Design Token

```ts
// tokens/colors.ts
// AI 根据设计稿的色板自动生成

export const colors = {
  // 基础色
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

## 第二步：AI 生成组件

```tsx
// 给 Claude Code 的 prompt：
// "根据 design-token.json 生成 Button 组件，
//  支持 5 种 variant、3 种 size、loading 状态，
//  使用 forwardRef，配套 Storybook stories"

// AI 生成的组件（经人工 review 调整后）
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
// Button.stories.tsx — AI 自动生成
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

export const Primary: Story = { args: { children: "按钮", variant: "primary" } };
export const Secondary: Story = { args: { children: "按钮", variant: "secondary" } };
export const Outline: Story = { args: { children: "按钮", variant: "outline" } };
export const Ghost: Story = { args: { children: "按钮", variant: "ghost" } };
export const Danger: Story = { args: { children: "删除", variant: "danger" } };
export const Loading: Story = { args: { children: "加载中", loading: true } };
export const Small: Story = { args: { children: "小按钮", size: "sm" } };
export const Large: Story = { args: { children: "大按钮", size: "lg" } };
```

## 第四步：AI 自动生成测试

```tsx
// Button.test.tsx — AI 自动生成
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>点击</Button>);
    expect(screen.getByRole("button", { name: "点击" })).toBeInTheDocument();
  });

  it("applies variant classes correctly", () => {
    const { rerender } = render(<Button variant="primary">按钮</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary-500");

    rerender(<Button variant="danger">按钮</Button>);
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
    render(<Button onClick={handleClick}>点击</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>点击</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

## 效率数据

```
组件数量    传统方式    AI 辅助    效率提升
─────────────────────────────────────────
5 个组件     1 周      1.5 天      3.3x
20 个组件    4 周      1 周        4x
50 个组件    10 周     2.5 周      4x

注意：AI 生成的代码平均需要 30% 的人工调整
```

## 小结

- AI 不能替代设计师和前端工程师的思考，但能大幅减少重复劳动
- Token 管理是设计系统的基础，AI 帮忙但 Token 定义需要人工决策
- AI 生成的组件代码质量不错，但一定要做 review
- Storybook、测试、文档的自动生成是 AI 的最大价值
- 投入时间建立 prompt 模板，复用率很高
