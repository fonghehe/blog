---
title: "tRPC：全棧 TypeScript 類型安全的終極方案"
date: 2023-03-05 10:05:05
tags:
  - 前端
readingTime: 2
description: "用了 tRPC 半年，説説它到底解決了什麼問題。"
wordCount: 411
---

用了 tRPC 半年，説説它到底解決了什麼問題。

## 問題背景

在全棧 TypeScript 項目裏，前後端共享類型一直很彆扭：

- REST API 需要手寫介面文檔 + 前端類型定義，兩者容易不同步
- GraphQL 需要寫 schema + resolver + codegen，學習成本和維護成本都高
- OpenAPI codegen 能自動生成類型，但生成的代碼質量參差不齊

tRPC 的思路：前後端都是 TypeScript，直接在類型層面打通，不需要中間格式。

## 快速上手

### 服務端定義

```typescript
import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const appRouter = t.router({
  // 查詢
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
// 關鍵：導出類型，客户端使用
```

### 客户端調用

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/router";

const trpc = createTRPCReact<AppRouter>();

function UserPage({ userId }: { userId: string }) {
  // 類型完全自動推斷：data 的類型就是服務端的返回類型
  const { data: user, isLoading } = trpc.getUser.useQuery({ id: userId });

  // 輸入參數也有類型校驗：傳錯類型直接報錯
  // trpc.getUser.useQuery({ id: 123 })  // Error: number 不能賦值給 string

  const createUser = trpc.createUser.useMutation();

  const handleCreate = () => {
    createUser.mutate({
      name: "張三",
      email: "zhangsan@example.com",
    });
  };

  if (isLoading) return <div>Loading...</div>;
  return <div>{user?.name}</div>;
}
```

改了服務端的輸入輸出類型，客户端立刻報類型錯誤。不需要 codegen，不需要手動同步。

## 中間件

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
  // 公開接口
  healthCheck: t.procedure.query(() => "ok"),

  // 需要登錄
  me: protectedProcedure.query(({ ctx }) => ctx.user),
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string(), bio: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      return db.user.update({ where: { id: ctx.user.id }, data: input });
    }),
});
```

中間件的類型也會透傳。經過 `isAuthed` 中間件後，`ctx.user` 的類型從 `User | null` 變成了 `User`，下游代碼不需要判空。

## 效能和限製

**優勢：**
- 零 codegen 步驟，類型即時推斷
- 基於 HTTP，和 REST 一樣可以上 CDN、做緩存
- 請求批處理支援（默認開啓，減少請求數）

**限製：**
- 前後端必須都是 TypeScript
- 不適合給第三方客户端用（需要 REST/GraphQL 對外暴露）
- 複雜的嵌套查詢不如 GraphQL 靈活

## 小結

- tRPC 在全棧 TS 項目中提供了最乾淨的端到端類型安全
- 不需要 schema 定義語言、不需要 codegen，改了類型立即生效
- 中間件系統類型安全，權限控製邏輯清晰
- 適合內部項目、全棧應用，不適合公開 API
- 搭配 Zod 做輸入校驗是最佳實踐