---
title: "Zod：TypeScript 时代的 Schema 校验利器"
date: 2023-02-08 15:28:32
tags:
  - 前端
readingTime: 2
description: "在全栈 TypeScript 项目里，类型安全应该是从数据库到前端一致的。Zod 是实现这个目标最干净的方案。"
wordCount: 282
---

在全栈 TypeScript 项目里，类型安全应该是从数据库到前端一致的。Zod 是实现这个目标最干净的方案。

## 为什么选 Zod

之前的校验方案各有问题：

- **Joi**：运行时校验好用，但没有类型推断，需要额外写 TypeScript 类型
- **Yup**：有类型推断但 API 繁琐，和 Zod 比起来不够简洁
- **io-ts**：类型系统强大但学习曲线陡峭，API 不直观

Zod 的优势：零依赖、API 简洁、类型推断完美、运行时校验合一。

## 基础用法

```typescript
import { z } from "zod";

// 定义 schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  age: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
});

// 自动推断出 TypeScript 类型
type User = z.infer<typeof UserSchema>;
// 等价于手动写 interface，但不用维护两份定义
```

一份定义同时得到运行时校验和静态类型，这是 Zod 的核心价值。

## 表单校验实践

配合 React Hook Form 使用非常丝滑：

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
    // data 已经是类型安全的
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

## API 校验（tRPC / Express）

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
      // input 的类型自动从 schema 推断
      // 且会在运行时自动校验
      return db.user.create({ data: input });
    }),
});
```

## 高级技巧

### Schema 复用和组合

```typescript
// 基础 schema
const BaseUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// 继承扩展
const AdminUserSchema = BaseUserSchema.extend({
  permissions: z.array(z.string()),
  lastLogin: z.date(),
});

// 条件校验
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

### 自定义校验

```typescript
const PhoneSchema = z.string().refine(
  (val) => /^1[3-9]\d{9}$/.test(val),
  { message: "请输入有效的手机号码" }
);

// transform 做数据转换
const DateSchema = z.string().transform((val) => new Date(val));
```

## 小结

- Zod 实现了"一个 schema 同时覆盖类型和校验"的目标
- 与 React Hook Form、tRPC 等工具配合天衣无缝
- API 简洁直观，学习成本低
- 零依赖，bundle 体积小
- 在全栈 TypeScript 项目中强烈推荐作为核心依赖