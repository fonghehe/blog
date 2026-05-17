---
title: "Web標準 2026 新機能まとめ"
date: 2026-05-04 10:00:00
tags:
  - フロントエンド
readingTime: 2
description: "2026年にウェブプラットフォームに登場した最も重要な新機能を、実践的なサンプルとともにまとめる。"
---

2026年にウェブプラットフォームに登場した最も重要な新機能を、実践的なサンプルとともにまとめる。

## CSS `light-dark()` とカラースキーム

`light-dark()` 関数を使うと、`@media` クエリなしでインラインにライト/ダークモードの値を定義できる：

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}
```

`color-scheme` と組み合わせると、ブラウザがシステム設定に基づいて自動的に正しい値を選択する ─ JavaScriptも `@media` ボイラープレートも不要。

## CSSスクロールスナップ

スクロールスナップにより、JavaScriptゼロでネイティブなカルーセルのような動作が実現できる：

```css
.carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%;
  scroll-snap-align: start;
  border-radius: 12px;
  transition: scale 0.3s ease;
}
```

パフォーマンス面の注意：スクロールスナップはGPUコンポジット処理されるため、JavaScript駆動のカルーセルより大幅に滑らかだ。

## TypeScript `DeepPartial` パターン

設定のマージに広く使われるユーティリティ型：

```typescript
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

interface AppConfig {
  api: { baseUrl: string; timeout: number; retries: number };
  ui: { theme: "light" | "dark"; language: string; pageSize: number };
}

function mergeConfig(
  defaults: AppConfig,
  overrides: DeepPartial<AppConfig>,
): AppConfig {
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    if (overrides[key] && typeof overrides[key] === "object") {
      result[key] = { ...defaults[key], ...overrides[key] } as never;
    }
  }
  return result;
}
```

境界条件の処理を忘れずに ─ このパターンは部分的なオーバーライドが標準的な本番設定システムで重要だ。

## Reactページネーションと `useCallback`

```javascript
import { useState, useEffect, useCallback } from "react";

function DataList({ endpoint, pageSize = 20 }) {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}?page=${page}&size=${pageSize}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return <div>{loading ? <Spinner /> : <List items={data} />}</div>;
}
```

## まとめ

2026年のウェブプラットフォームは、複雑さをJavaScriptからネイティブブラウザ機能へと移行させ続けている。`light-dark()`、スクロールスナップ、改善されたCSSカスケードにより、以前はJavaScriptでしか実現できなかったパターンが純粋なCSSで実現可能になった。これらのAPIを積極的に活用しよう ─ 高速で、アクセシブルで、保守コストがはるかに低い。
