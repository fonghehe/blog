---
title: "shadcn/ui：コンポーネントライブラリ設計の再考"
date: 2023-07-20 11:47:53
tags:
  - フロントエンド
readingTime: 2
description: "shadcn/ui は2023年のフロントエンド界隈で最も注目されたUIソリューションの一つですが、従来の意味での「コンポーネントライブラリ」ではありません。"
wordCount: 441
---

shadcn/ui は2023年のフロントエンド界隈で最も注目されたUIソリューションの一つですが、従来の意味での「コンポーネントライブラリ」ではありません。

## shadcn/ui とは何か

```bash
# 安装（不是 npm install，是复制代码到你的项目）
npx shadcn-ui@latest add button
# 这个命令会把 Button 组件的源代码复制到 src/components/ui/button.tsx
```

従来のコンポーネントライブラリ（Element UI、Ant Design）：インストールして使うが、変更できない（APIでのオーバーライドのみ）。

shadcn/ui：コンポーネントコードをプロジェクトに置くことで、**そのコードを所有し**、自由に変更できます。

## 技術スタック

```bash
npm install @radix-ui/react-dialog class-variance-authority tailwind-merge
```

- **Radix UI**：スタイルなし、アクセシビリティの強いコンポーネントプリミティブ
- **Tailwind CSS**：スタイリング
- **class-variance-authority (CVA)**：バリアントの管理

## コンポーネント構造

```typescript
// components/ui/button.tsx（shadcn/ui 生成的）
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // 基础样式
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)

export { Button, buttonVariants }
```

## 使い方

```tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function CreateUserDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>创建用户</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新用户</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input placeholder="用户名" />
            <Input type="email" placeholder="邮箱" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button>确认</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## なぜこのアプローチが優れているのか

1. **可访问性**：基于 Radix UI，键盘导航、ARIA 属性都处理好了
2. **可定制**：代码在你项目里，改样式、改行为、加功能都随意
3. **无版本锁定**：不依赖上游的版本升级，你就是维护者
4. **按需复制**：只复制你需要的组件，没有无用代码

缺点：不是"安装就用"，需要理解 Tailwind + Radix 才能定制。

## `cn` ユーティリティ関数

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 合并 className，解决 Tailwind 类名冲突
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 使用
cn("px-4 py-2", "px-8"); // → "py-2 px-8"（不会重复 px）
```

## まとめ

- shadcn/ui 不是传统组件库，是"可复制的组件代码"
- 基于 Radix UI（可访问性）+ Tailwind + CVA
- 优势：完全可控、无版本依赖、可访问性强
- 适合：有 Tailwind 经验、需要高度定制 UI 的团队
- 2023 年在 Next.js 生态里几乎成为默认选择