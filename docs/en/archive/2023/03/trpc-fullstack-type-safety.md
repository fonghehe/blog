---
title: "tRPC: The Ultimate Solution for Full-Stack TypeScript Type Safety"
date: 2023-03-05 10:05:05
tags:
  - Frontend
readingTime: 2
description: "用了 tRPC 半年，说说它到底解决了什么问题。"
wordCount: 402
---

用了 tRPC 半年，说说它到底解决了什么问题。

## Problem Background

在全栈 TypeScript 项目里，前后端共享类型一直很别扭：

- REST API 需要手写接口文档 + 前端类型定义，两者容易不同步
- GraphQL 需要写 schema + resolver + codegen，学习成本和维护成本都高
- OpenAPI codegen 能自动生成类型，但生成的代码质量参差不齐

tRPC 的思路：前后端都是 TypeScript，直接在类型层面打通，不需要中间格式。

## Quick Start

### 服务端定义

```typescript
import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const appRouter = t.router({
  // 查询
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return db.user.findUnique({ where: { id: input.id } });
    }),

  // 修改
  createUser: t.procedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
    }))
    .mutation(({ input }) => {
      return db.user.create({ data: input });
    }),

  // 嵌套路由
  post: t.router({
    list: t.procedure.query(() => db.post.findMany()),
    byId: t.procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => db.post.findUnique({ where: { id: input.id } })),
  }),
});

export type AppRouter = typeof appRouter;
// 关键：导出类型，客户端使用
```

### 客户端调用

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/router";

const trpc = createTRPCReact<AppRouter>();

function UserPage({ userId }: { userId: string }) {
  // 类型完全自动推断：data 的类型就是服务端的返回类型
  const { data: user, isLoading } = trpc.getUser.useQuery({ id: userId });

  // 输入参数也有类型校验：传错类型直接报错
  // trpc.getUser.useQuery({ id: 123 })  // Error: number 不能赋值给 string

  const createUser = trpc.createUser.useMutation();

  const handleCreate = () => {
    createUser.mutate({
      name: "张三",
      email: "zhangsan@example.com",
    });
  };

  if (isLoading) return <div>Loading...</div>;
  return <div>{user?.name}</div>;
}
```

改了服务端的输入输出类型，客户端立刻报类型错误。不需要 codegen，不需要手动同步。

## Middleware

```typescript
import { TRPCError } from "@trpc/server";

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { user: ctx.user } });
});

const protectedProcedure = t.procedure.use(isAuthed);

const appRouter = t.router({
  // 公开接口
  healthCheck: t.procedure.query(() => "ok"),

  // 需要登录
  me: protectedProcedure.query(({ ctx }) => ctx.user),
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string(), bio: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      return db.user.update({ where: { id: ctx.user.id }, data: input });
    }),
});
```

中间件的类型也会透传。经过 `isAuthed` 中间件后，`ctx.user` 的类型从 `User | null` 变成了 `User`，下游代码不需要判空。

## Performance and Limitations

**优势：**
- 零 codegen 步骤，类型即时推断
- 基于 HTTP，和 REST 一样可以上 CDN、做缓存
- 请求批处理支持（默认开启，减少请求数）

**限制：**
- 前后端必须都是 TypeScript
- 不适合给第三方客户端用（需要 REST/GraphQL 对外暴露）
- 复杂的嵌套查询不如 GraphQL 灵活

## Summary

- tRPC 在全栈 TS 项目中提供了最干净的端到端类型安全
- 不需要 schema 定义语言、不需要 codegen，改了类型立即生效
- 中间件系统类型安全，权限控制逻辑清晰
- 适合内部项目、全栈应用，不适合公开 API
- 搭配 Zod 做输入校验是最佳实践