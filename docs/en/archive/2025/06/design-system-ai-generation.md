---
title: "Using AI to Generate Design Systems: From Figma to Code"
date: 2025-06-08 10:00:00
tags:
  - Engineering
readingTime: 3
description: "Building a design system has always been heavy lifting for frontend teams. In 2025, AI tools have fundamentally improved efficiency in this process. Here's what"
wordCount: 127
---

Building a design system has always been heavy lifting for frontend teams. In 2025, AI tools have fundamentally improved efficiency in this process. Here's what our team has learned in practice.

## Traditional Flow vs. AI Flow

```
Traditional Flow (4-6 weeks):
  Designer creates mockups → Frontend implements → Writes Storybook by hand → Iterates → Done

AI Flow (1-2 weeks):
  Designer creates mockups → AI generates initial code → Frontend reviews & adjusts → Done
  Meanwhile: AI auto-generates Storybook, tests, and documentation
```

## Step 1: Define Design Tokens

```ts
// tokens/colors.ts
// AI generates this automatically from the design's color palette

export const colors = {
  // Base colors
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

## Step 2: AI-Generated Components

```tsx
// Prompt given to Claude Code:
// "Based on design-token.json, generate a Button component
//  with 5 variants, 3 sizes, loading state,
//  using forwardRef, with accompanying Storybook stories"

// AI-generated component (after human review and adjustments)
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

## Step 3: AI-Generated Storybook

```tsx
// Button.stories.tsx — AI auto-generated
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
  args: { children: "按钮", variant: "primary" },
};
export const Secondary: Story = {
  args: { children: "按钮", variant: "secondary" },
};
export const Outline: Story = {
  args: { children: "按钮", variant: "outline" },
};
export const Ghost: Story = { args: { children: "按钮", variant: "ghost" } };
export const Danger: Story = { args: { children: "删除", variant: "danger" } };
export const Loading: Story = { args: { children: "加载中", loading: true } };
export const Small: Story = { args: { children: "小按钮", size: "sm" } };
export const Large: Story = { args: { children: "大按钮", size: "lg" } };
```

## Step 4: AI Auto-Generated Tests

```tsx
// Button.test.tsx — AI auto-generated
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
    render(
      <Button disabled onClick={handleClick}>
        点击
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

## Efficiency Data

```
Components    Traditional    AI-Assisted    Efficiency Gain
────────────────────────────────────────────────────────
5 components    1 week         1.5 days         3.3x
20 components   4 weeks        1 week           4x
50 components   10 weeks       2.5 weeks        4x

Note: AI-generated code requires an average of 30% human adjustment
```

## Summary

- AI cannot replace the thinking of designers and frontend engineers, but it dramatically reduces repetitive work
- Token management is the foundation of a design system; AI helps but token definitions need human decision-making
- AI-generated component code quality is decent, but code review is a must
- Auto-generation of Storybook, tests, and documentation is where AI delivers the most value
- Invest time in building reusable prompt templates—the reuse rate is very high
