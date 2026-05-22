---
title: "shadcn/ui：重新思考組件庫的設計"
date: 2023-07-20 11:47:53
tags:
  - 前端
readingTime: 2
description: "shadcn/ui 是 2023 年前端圈最火的 UI 解決方案之一，但它不是傳統意義上的\"組件庫\"。"
wordCount: 329
---

shadcn/ui 是 2023 年前端圈最火的 UI 解決方案之一，但它不是傳統意義上的"組件庫"。

## shadcn/ui 是什麼

```bash
# 安裝（不是 npm install，是複製代碼到你的項目）
npx shadcn-ui@latest add button
# 這個命令會把 Button 組件的源代碼複製到 src/components/ui/button.tsx
```

傳統組件庫（Element UI、Ant Design）：你安裝它，用它，但不能改它（隻能用 API 覆蓋）。

shadcn/ui：把組件代碼放到你的項目裏，**你就擁有了這段代碼**，可以隨意修改。

## 技術棧

```bash
npm install @radix-ui/react-dialog class-variance-authority tailwind-merge
```

- **Radix UI**：無樣式、可訪問性強的組件原語
- **Tailwind CSS**：樣式
- **class-variance-authority (CVA)**：管理變體

## 組件結構

```typescript
// components/ui/button.tsx（shadcn/ui 生成的）
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // 基礎樣式
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

## 使用方式

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
      <Button onClick={() => setOpen(true)}>創建用户</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>創建新用户</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input placeholder="用户名" />
            <Input type="email" placeholder="郵箱" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button>確認</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## 為什麼這個思路好

1. **可訪問性**：基於 Radix UI，鍵盤導航、ARIA 屬性都處理好了
2. **可定製**：代碼在你項目裏，改樣式、改行為、加功能都隨意
3. **無版本鎖定**：不依賴上游的版本升級，你就是維護者
4. **按需複製**：隻複製你需要的組件，沒有無用代碼

缺點：不是"安裝就用"，需要理解 Tailwind + Radix 才能定製。

## `cn` 工具函數

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 合併 className，解決 Tailwind 類名衝突
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 使用
cn("px-4 py-2", "px-8"); // → "py-2 px-8"（不會重複 px）
```

## 小結

- shadcn/ui 不是傳統組件庫，是"可複製的組件代碼"
- 基於 Radix UI（可訪問性）+ Tailwind + CVA
- 優勢：完全可控、無版本依賴、可訪問性強
- 適合：有 Tailwind 經驗、需要高度定製 UI 的團隊
- 2023 年在 Next.js 生態裏幾乎成為默認選擇