---
title: "AIでデザインシステムを生成：FigmaからコードまでQ"
date: 2025-06-08 10:00:00
tags:
  - エンジニアリング
readingTime: 3
description: "デザインシステムの構築はフロントエンドチームにとって常に重労働でした。2025年、AIツールによってこのプロセスの効率は質的に向上しました。チームの実践を紹介します。"
---

デザインシステムの構築はフロントエンドチームにとって常に重労働でした。2025年、AIツールによってこのプロセスの効率は質的に向上しました。チームの実践を紹介します。

## 従来のフローとAIフロー

```
従来のフロー（4-6週間）：
  デザイナーが原稿作成 → フロントエンドが再現 → Storybookを手書き → 繰り返し調整 → 完了

AIフロー（1-2週間）：
  デザイナーが原稿作成 → AIが初期コードを生成 → フロントエンドがレビュー・調整 → 完了
  同時進行：AIがStorybook・テスト・ドキュメントを自動生成
```

## ステップ1：Design Tokenの定義

```ts
// tokens/colors.ts
// AIがデザイン稿のカラーパレットから自動生成

export const colors = {
  // 基本色
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

## ステップ2：AIがコンポーネントを生成

```tsx
// Claude Codeへのプロンプト：
// "design-token.jsonに基づいてButtonコンポーネントを生成してください。
//  5種のvariant、3種のsize、loading状態をサポートし、
//  forwardRefを使用し、Storybookのstoriesも付けてください"

// AIが生成したコンポーネント（人間がレビュー・調整後）
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500",
        outline:
          "border border-gray-300 bg-transparent hover:bg-gray-50 focus-visible:ring-gray-500",
        ghost: "bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500",
        danger:
          "bg-error-500 text-white hover:bg-error-600 focus-visible:ring-error-500",
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
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      loading,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
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

## ステップ3：AIがStorybookを生成

```tsx
// Button.stories.tsx — AIが自動生成
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

export const Primary: Story = {
  args: { children: "ボタン", variant: "primary" },
};
export const Secondary: Story = {
  args: { children: "ボタン", variant: "secondary" },
};
export const Outline: Story = {
  args: { children: "ボタン", variant: "outline" },
};
export const Ghost: Story = { args: { children: "ボタン", variant: "ghost" } };
export const Danger: Story = { args: { children: "削除", variant: "danger" } };
export const Loading: Story = {
  args: { children: "読み込み中", loading: true },
};
export const Small: Story = { args: { children: "小ボタン", size: "sm" } };
export const Large: Story = { args: { children: "大ボタン", size: "lg" } };
```

## ステップ4：AIがテストを自動生成

```tsx
// Button.test.tsx — AIが自動生成
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>クリック</Button>);
    expect(
      screen.getByRole("button", { name: "クリック" }),
    ).toBeInTheDocument();
  });

  it("applies variant classes correctly", () => {
    const { rerender } = render(<Button variant="primary">ボタン</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary-500");

    rerender(<Button variant="danger">ボタン</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-error-500");
  });

  it("shows loading state", () => {
    render(<Button loading>送信</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("calls onClick handler", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>クリック</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        クリック
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

## 効率データ

```
コンポーネント数   従来の方法    AI補助    効率向上
─────────────────────────────────────────
5個             1週間      1.5日     3.3倍
20個            4週間      1週間     4倍
50個            10週間     2.5週間   4倍

注意：AIが生成したコードは平均30%の人間による調整が必要
```

## まとめ

- AIはデザイナーとフロントエンドエンジニアの思考を代替できないが、繰り返し作業を大幅に削減できる
- Token管理はデザインシステムの基盤。AIがサポートするが、Tokenの定義は人間が決定する必要がある
- AIが生成したコンポーネントコードの品質は良いが、必ずレビューを行うこと
- Storybook・テスト・ドキュメントの自動生成がAIの最大の価値
- プロンプトテンプレートの整備に時間を投資すると、再利用率が非常に高くなる
