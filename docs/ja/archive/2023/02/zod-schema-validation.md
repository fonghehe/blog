---
title: "Zod：TypeScript 時代のスキーマバリデーションツール"
date: 2023-02-08 15:28:32
tags:
  - フロントエンド
readingTime: 3
description: "フルスタック TypeScript プロジェクトでは、型安全性はデータベースからフロントエンドまで一貫しているべきです。Zod はこの目標を達成するための最もクリーンなソリューションです。"
wordCount: 518
---

フルスタック TypeScript プロジェクトでは、型安全性はデータベースからフロントエンドまで一貫しているべきです。Zod はこの目標を達成するための最もクリーンなソリューションです。

## なぜZodを選ぶのか

これまでのバリデーションソリューションにはそれぞれ問題がありました：

- **Joi**：ランタイムバリデーションは便利ですが、型推論がなく、別途 TypeScript の型定義が必要でした
- **Yup**：型推論はあるものの API が煩雑で、Zod と比較すると簡潔さに欠けます
- **io-ts**：型システムは強力ですが学習曲線が急で、API が直感的ではありません

Zod の優位性：ゼロ依存、API が簡潔、型推論が完璧、ランタイムバリデーションが一体化しています。

## 基本的な使い方

```typescript
import { z } from "zod";

// スキーマを定義
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  age: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
});

// 自動的に TypeScript の型を推論
type User = z.infer<typeof UserSchema>;
// 手動で interface を書くのと同等ですが、2つの定義を維持する必要はありません
```

1つの定義でランタイムバリデーションと静的型の両方を得られることが、Zod の核となる価値です。

## フォームバリデーションの実践

React Hook Form との組み合わせは非常にスムーズです：

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const LoginFormSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(8, "密码至少 8 位").max(128),
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
    // data は型安全です
    console.log(data.email); // string
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
      <input type="password" {...register("password")} />
      {errors.password && <span>{errors.password.message}</span>}
      <button type="submit">登录</button>
    </form>
  );
}
```

## APIバリデーション（tRPC / Express）

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
      // input の型はスキーマから自動的に推論されます
      // かつランタイムで自動的にバリデーションされます
      return db.user.create({ data: input });
    }),
});
```

## 高度なテクニック

### スキーマの再利用と合成

```typescript
// ベーススキーマ
const BaseUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// 継承と拡張
const AdminUserSchema = BaseUserSchema.extend({
  permissions: z.array(z.string()),
  lastLogin: z.date(),
});

// 条件付きバリデーション
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

### カスタムバリデーション

```typescript
const PhoneSchema = z.string().refine(
  (val) => /^1[3-9]\d{9}$/.test(val),
  { message: "请输入有效的手机号码" }
);

// transform でデータ変換
const DateSchema = z.string().transform((val) => new Date(val));
```

## まとめ

- Zod は「1つのスキーマで型とバリデーションの両方をカバーする」目標を実現しました
- React Hook Form、tRPC などのツールとシームレスに連携します
- API は簡潔で直感的であり、学習コストが低いです
- ゼロ依存で、バンドルサイズが小さいです
- フルスタック TypeScript プロジェクトでは、コア依存関係として強く推奨します
