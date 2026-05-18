---
title: "Zod：TypeScript 時代的 Schema 校驗利器"
date: 2023-02-08 15:28:32
tags:
  - 前端
readingTime: 2
description: "在全棧 TypeScript 專案裡，型別安全應該是從資料庫到前端一致的。Zod 是實現這個目標最乾淨的方案。"
---

在全棧 TypeScript 專案裡，型別安全應該是從資料庫到前端一致的。Zod 是實現這個目標最乾淨的方案。

## 為什麼選 Zod

之前的校驗方案各有問題：

- **Joi**：執行時校驗好用，但沒有型別推斷，需要額外寫 TypeScript 型別
- **Yup**：有型別推斷但 API 繁瑣，和 Zod 比起來不夠簡潔
- **io-ts**：型別系統強大但學習曲線陡峭，API 不直觀

Zod 的優勢：零依賴、API 簡潔、型別推斷完美、執行時校驗合一。

## 基礎用法

```typescript
import { z } from "zod";

// 定義 schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  age: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
});

// 自動推斷出 TypeScript 型別
type User = z.infer<typeof UserSchema>;
// 等價於手動寫 interface，但不用維護兩份定義
```

一份定義同時得到執行時校驗和靜態型別，這是 Zod 的核心價值。

## 表單校驗實踐

配合 React Hook Form 使用非常絲滑：

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const LoginFormSchema = z.object({
  email: z.string().email("請輸入有效的郵箱地址"),
  password: z.string().min(8, "密碼至少 8 位").max(128),
  remember: z.boolean().default(false),
});

type LoginForm = z.infer<typeof LoginFormSchema>;

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginFormSchema),
  });

  const onSubmit = (data: LoginForm) => {
    // data 已經是型別安全的
    console.log(data.email); // string
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
      <input type="password" {...register("password")} />
      {errors.password && <span>{errors.password.message}</span>}
      <button type="submit">登入</button>
    </form>
  );
}
```

## API 校驗（tRPC / Express）

```typescript
import { z } from "zod";
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

const CreateUserInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});

const appRouter = t.router({
  createUser: t.procedure
    .input(CreateUserInput)
    .mutation(({ input }) => {
      // input 的型別自動從 schema 推斷
      // 且會在執行時自動校驗
      return db.user.create({ data: input });
    }),
});
```

## 高階技巧

### Schema 複用和組合

```typescript
// 基礎 schema
const BaseUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// 繼承擴充套件
const AdminUserSchema = BaseUserSchema.extend({
  permissions: z.array(z.string()),
  lastLogin: z.date(),
});

// 條件校驗
const PaymentSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("credit_card"),
    cardNumber: z.string().length(16),
    cvv: z.string().length(3),
  }),
  z.object({
    method: z.literal("alipay"),
    account: z.string(),
  }),
]);
```

### 自定義校驗

```typescript
const PhoneSchema = z.string().refine(
  (val) => /^1[3-9]\d{9}$/.test(val),
  { message: "請輸入有效的手機號碼" }
);

// transform 做資料轉換
const DateSchema = z.string().transform((val) => new Date(val));
```

## 小結

- Zod 實現了"一個 schema 同時覆蓋型別和校驗"的目標
- 與 React Hook Form、tRPC 等工具配合天衣無縫
- API 簡潔直觀，學習成本低
- 零依賴，bundle 體積小
- 在全棧 TypeScript 專案中強烈推薦作為核心依賴