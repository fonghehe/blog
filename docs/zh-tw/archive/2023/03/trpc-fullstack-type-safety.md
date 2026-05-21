---
title: "tRPC：全棧 TypeScript 型別安全的終極方案"
date: 2023-03-05 10:05:05
tags:
  - 前端
readingTime: 2
description: "用了 tRPC 半年，說說它到底解決了什麼問題。"
wordCount: 418
---

用了 tRPC 半年，說說它到底解決了什麼問題。

## 問題背景

在全棧 TypeScript 專案裡，前後端共享型別一直很彆扭：

- REST API 需要手寫介面文件 + 前端型別定義，兩者容易不同步
- GraphQL 需要寫 schema + resolver + codegen，學習成本和維護成本都高
- OpenAPI codegen 能自動生成型別，但生成的程式碼質量參差不齊

tRPC 的思路：前後端都是 TypeScript，直接在型別層面打通，不需要中間格式。

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

  // 巢狀路由
  post: t.router({
    list: t.procedure.query(() => db.post.findMany()),
    byId: t.procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => db.post.findUnique({ where: { id: input.id } })),
  }),
});

export type AppRouter = typeof appRouter;
// 關鍵：匯出型別，客戶端使用
```

### 客戶端呼叫

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/router";

const trpc = createTRPCReact<AppRouter>();

function UserPage({ userId }: { userId: string }) {
  // 型別完全自動推斷：data 的型別就是服務端的返回型別
  const { data: user, isLoading } = trpc.getUser.useQuery({ id: userId });

  // 輸入引數也有型別校驗：傳錯型別直接報錯
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

改了服務端的輸入輸出型別，客戶端立刻報型別錯誤。不需要 codegen，不需要手動同步。

## 中介軟體

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
  // 公開介面
  healthCheck: t.procedure.query(() => "ok"),

  // 需要登入
  me: protectedProcedure.query(({ ctx }) => ctx.user),
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string(), bio: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      return db.user.update({ where: { id: ctx.user.id }, data: input });
    }),
});
```

中介軟體的型別也會透傳。經過 `isAuthed` 中介軟體後，`ctx.user` 的型別從 `User | null` 變成了 `User`，下游程式碼不需要判空。

## 效能和限制

**優勢：**
- 零 codegen 步驟，型別即時推斷
- 基於 HTTP，和 REST 一樣可以上 CDN、做快取
- 請求批處理支援（預設開啟，減少請求數）

**限制：**
- 前後端必須都是 TypeScript
- 不適合給第三方客戶端用（需要 REST/GraphQL 對外暴露）
- 複雜的巢狀查詢不如 GraphQL 靈活

## 小結

- tRPC 在全棧 TS 專案中提供了最乾淨的端到端型別安全
- 不需要 schema 定義語言、不需要 codegen，改了型別立即生效
- 中介軟體系統型別安全，許可權控制邏輯清晰
- 適合內部專案、全棧應用，不適合公開 API
- 搭配 Zod 做輸入校驗是最佳實踐