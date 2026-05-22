---
title: "tRPC：フルスタック TypeScript 型安全の究極ソリューション"
date: 2023-03-05 10:05:05
tags:
  - フロントエンド
readingTime: 3
description: "tRPC を半年間使ってみて、それが本当に解決する問題について説明します。"
wordCount: 763
---

tRPC を半年間使ってみて、それが本当に解決する問題について説明します。

## 問題の背景

フルスタック TypeScript プロジェクトでは、フロントエンドとバックエンドで型を共有することが常に厄介でした：

- REST API は手書きのインターフェースドキュメントとフロントエンドの型定義が必要で、両者は同期が取れなくなりがちです
- GraphQL は schema + resolver + codegen が必要で、学習コストと保守コストの両方が高いです
- OpenAPI codegen は型を自動生成できますが、生成されるコードの品質はまちまちです

tRPC の考え方：フロントエンドもバックエンドも TypeScript なので、型レベルで直接接続し、中間フォーマットは必要ありません。

## クイックスタート

### サーバーサイドの定義

```typescript
import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const appRouter = t.router({
  // クエリ
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return db.user.findUnique({ where: { id: input.id } });
    }),

  // 変更
  createUser: t.procedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
    }))
    .mutation(({ input }) => {
      return db.user.create({ data: input });
    }),

  // ネストされたルーター
  post: t.router({
    list: t.procedure.query(() => db.post.findMany()),
    byId: t.procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => db.post.findUnique({ where: { id: input.id } })),
  }),
});

export type AppRouter = typeof appRouter;
// 重要：型をエクスポートし、クライアントで使用する
```

### クライアントからの呼び出し

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/router";

const trpc = createTRPCReact<AppRouter>();

function UserPage({ userId }: { userId: string }) {
  // 型が完全に自動推論される：data の型はサーバーの戻り値の型そのもの
  const { data: user, isLoading } = trpc.getUser.useQuery({ id: userId });

  // 入力パラメータにも型バリデーションがある：間違った型を渡すと即座にエラー
  // trpc.getUser.useQuery({ id: 123 })  // Error: number を string に代入できない

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

サーバーサイドの入出力型を変更すると、クライアント側で即座に型エラーが発生します。codegen も手動同期も必要ありません。

## ミドルウェア

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
  // 公開インターフェース
  healthCheck: t.procedure.query(() => "ok"),

  // ログインが必要
  me: protectedProcedure.query(({ ctx }) => ctx.user),
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string(), bio: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      return db.user.update({ where: { id: ctx.user.id }, data: input });
    }),
});
```

ミドルウェアの型も透過的に伝搬されます。`isAuthed` ミドルウェアを通過すると、`ctx.user` の型が `User | null` から `User` に変わり、後続のコードでは null チェックが不要になります。

## パフォーマンスと制限

**利点：**
- codegen が不要で、型が即座に推論される
- HTTP ベースで、REST 同様に CDN やキャッシュが利用可能
- リクエストバッチ処理をサポート（デフォルトで有効、リクエスト数を削減）

**制限：**
- フロントエンドとバックエンドの両方が TypeScript である必要がある
- サードパーティのクライアントには不向き（REST/GraphQL で外部公開する必要がある場合）
- 複雑なネストクエリは GraphQL ほど柔軟ではない

## まとめ

- tRPC はフルスタック TS プロジェクトにおいて、最もクリーンなエンドツーエンドの型安全性を提供します
- スキーマ定義言語や codegen は不要で、型を変更すれば即座に反映されます
- ミドルウェアシステムは型安全で、権限制御のロジックが明確です
- 内部プロジェクトやフルスタックアプリケーションに適しており、公開 API には不向きです
- Zod と組み合わせて入力バリデーションを行うのがベストプラクティスです
