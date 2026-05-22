---
title: "Edge レンダリング戦略の選定：CDN Worker、ISR、Streaming SSR"
date: 2024-08-20 16:14:51
tags:
  - エンジニアリング
readingTime: 3
description: "Edge Computing はフロントエンド領域でますます注目を集めています。アーキテクチャ責任者として、最近いくつかのプロジェクトでレンダリング戦略の選定を行いました。異なるシナリオにおける決定ロジックを整理します。"
wordCount: 504
---

Edge Computing はフロントエンド領域でますます注目を集めています。アーキテクチャ責任者として、最近いくつかのプロジェクトでレンダリング戦略の選定を行いました。異なるシナリオにおける決定ロジックを整理します。

## レンダリング戦略の全体像

```
静的生成（SSG）          → ビルド時に生成、CDN キャッシュ、最速
インクリメンタル静的再生成（ISR）→ オンデマンド生成 + 定期的な再検証
ストリーミング SSR       → サーバーサイドレンダリング + ストリーミング転送
Edge SSR                 → CDN エッジノードでレンダリング
Edge Middleware           → エッジノードでルーティング/認証/書き換え
```

## シナリオ1：マーケティングページ → SSG + ISR

内容の変更が頻繁でないページには、SSG が最適な解決策です：

```typescript
// next.config.js
module.exports = {
  output: "export", // 纯静态
};
```

内容の更新は必要だがリアルタイム性が不要な場合は、ISR を使用します：

```typescript
// app/marketing/[slug]/page.tsx
export async function generateStaticParams() {
  const pages = await getCmsPages();
  return pages.map((p) => ({ slug: p.slug }));
}

// 60秒後に再検証、ユーザーが目にする遅延は最大60秒
export const revalidate = 60;

export default async function MarketingPage({
  params,
}: {
  params: { slug: string };
}) {
  const page = await getPage(params.slug);
  return <MarketingLayout page={page} />;
}
```

## シナリオ2：ユーザーダッシュボード → Edge SSR

パーソナライズされたコンテンツが多く、初回表示の遅延に敏感なシナリオ：

```typescript
// middleware.ts — Edge Runtime
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // エッジノードで認証を行い、オリジンに戻る必要なし
  const token = request.cookies.get("auth-token");

  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ユーザーの地域に基づいて言語を選択
  const country = request.geo?.country || "CN";
  const response = NextResponse.next();
  response.headers.set("x-user-country", country);

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

```typescript
// Edge Runtime を設定
export const runtime = "edge";
```

## シナリオ3：ECサイト商品ページ → Streaming SSR + Edge

商品情報のリアルタイム性要件は高いが、ブロックごとに優先度が異なる場合：

```tsx
// app/product/[id]/page.tsx
import { Suspense } from "react";

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      {/* コア情報は同期的に読み込み */}
      <ProductHeader id={params.id} />

      {/* レビューは遅延読み込み */}
      <Suspense fallback={<div>レビューを読み込み中...</div>}>
        <ProductReviews id={params.id} />
      </Suspense>

      {/* おすすめ商品は遅延読み込み */}
      <Suspense fallback={<div>おすすめを読み込み中...</div>}>
        <Recommendations id={params.id} />
      </Suspense>
    </div>
  );
}
```

## シナリオ4：A/Bテスト → Edge Middleware

エッジノードで振り分けを行い、バックエンドのロジックに影響を与えません：

```typescript
// middleware.ts
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const bucket = Math.random() < 0.5 ? "control" : "variant-a";

  const response = NextResponse.next();
  response.cookies.set("ab-bucket", bucket, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 天
  });

  // バケットに応じて異なるバージョンのページに書き換え
  if (bucket === "variant-a" && request.nextUrl.pathname === "/checkout") {
    return NextResponse.rewrite(new URL("/checkout-v2", request.url));
  }

  return response;
}
```

## 選択決定ツリー

```
コンテンツは全ユーザーで同一か？
├── はい → SSG
└── いいえ → コンテンツの変更頻度は？
    ├── 低い（分単位）→ ISR
    ├── 中程度（秒単位）→ Streaming SSR
    └── 高い（リアルタイム）→ Edge SSR + WebSocket
```

```
エッジでの処理（認証/振り分け/地理情報）が必要か？
├── はい → Edge Middleware + 上記のレンダリング戦略
└── いいえ → 通常の SSR で十分
```

## コストの考慮

```
SSG：     ビルドコストは高いが、実行コストは極めて低い（純粋な CDN）
ISR：     ビルドコストは低い、実行コストも低い（オンデマンド生成）
Edge SSR：実行コストは中程度（Edge Worker 課金）
Streaming SSR：実行コストは中程度（Node.js サーバーが必要）
```

私たちの社内プロジェクトの経験：90% のページは SSG/ISR、10% のページは Edge SSR を使用しています。Edge を使うために Edge を使わないようにしましょう。

## まとめ

- コンテンツがほとんど変わらない → SSG/ISR、コスト最小
- パーソナライズ + 低レイテンシ → Edge SSR
- ブロックごとの優先度付け → Streaming SSR + Suspense
- 認証/振り分け/書き換え → Edge Middleware
- 過度なエンジニアリングを避け、必要に応じて選択
