---
title: "2021年 フロントエンド技術展望：フレームワーク成熟期とエンジニアリングの深化"
date: 2020-12-31 09:35:56
tags:
  - フロントエンド
readingTime: 4
description: "2020 年はフロントエンドの歴史の中で変化が最も密集した年のひとつだった。Vue 3 の正式リリース、React 17 が次への布石を打ち、Angular は四半期ごとのリリースペースを維持し、Vite が開発体験を覆し、webpack 5 が Module Federation を登場させた。2020 年末に立って、2021 年に注目すべき方向を語る。"
wordCount: 1137
---

2020 年はフロントエンドの歴史のなかで、変化の最も密度が高かった年のひとつです。Vue 3 が正式リリースされ、React 17 が次への布石を打ち、Angular は四半期ごとのリリースペースを維持し、Vite が開発体験をひっくり返し、webpack 5 が Module Federation を登場させました。2020 年の末に立って、2021 年に注目すべき方向を語ります。

## フレームワークが安定・成熟期に

### Vue 3 エコシステムの補完

Vue 3 は 2020 年 9 月にリリースされましたが、エコシステムはまだ十分ではありません。2021 年の見通し：

- Vue Router 4 と Pinia（Vuex 5）が安定化に向かう
- Nuxt 3（Vue 3 ベース）がリリースされる
- UI ライブラリ（Element Plus、Ant Design Vue 3.x）が順次充実する

### React Server Components

React チームは 2020 年末に Server Components をプレビューしました。それはサーバー側でコンポーネントをレンダリングし、クライアント側への JS はゼロです。これはおそらく、近年の React における最大のアーキテクチャ変更です：

```jsx
// Server Component（文件名 .server.js）
// 直接访问数据库，代码不发送到浏览器
import db from "./db";

async function Notes() {
  const notes = await db.query("SELECT * FROM notes");
  return <NoteList notes={notes} />;
}
```

### Angular 12 の予告

Angular 12 は 2021 年 Q2 のリリースが見込まれ、View Engine が正式に削除され、Ivy が唯一のレンダリングエンジンになります。Webpack 5 も実験的からデフォルトに移行します。

## エンジニアリングが深化する

### マイクロフロントエンドが概念から実装へ

Module Federation（webpack 5）のおかげで、マイクロフロントエンドは「フレームワークの支援が必要」なものから「ビルドツールに組み込まれた」ものへと変わりました：

```javascript
// 2021 年微前端的标准方案将更清晰
// qiankun（基于 single-spa）vs Module Federation 的边界会越来越明确
```

### Monorepo ツールの成熟

Nx や Turborepo（Vercel、2020 年末リリース）の登場により、Monorepo の管理がより簡単になりました。2021 年には、大規模チームによる Monorepo の採用率が显著に上昇するでしょう。

### ビルド速度の軍備競争

esbuild や SWC（Rust で書かれた JS コンパイラで、Next.js 12 が採用予定）の登場は、**システム言語（Go/Rust）で JS ツールチェーンを書き直す**ことが 2021 年の主旋律であることを示しています。

## TypeScriptの全面普及

2020 年の State of JS 調査では、TypeScript の満足度は 93%、純粋な JavaScript を初めて上回る使用率でした。2021 年の見通し：

- 大規模チームの新プロジェクトは 100% TypeScript に
- TypeScript 4.x は型推論とパフォーマンスの改善を継続する
- `ts-node` と Deno によりサーバーサイドの TS がより主流に

## パフォーマンス指標の標準化

Google の Core Web Vitals（LCP、FID、CLS）は 2021 年 5 月に Google の検索ランキングアルゴリズムに正式に組み込まれます。これは、パフォーマンス最適化が「おまけ」から「必須項目」へと変わることを意味します：

| 指標 | 意味         | Good 基準 |
| ---- | ------------ | --------- |
| LCP  | 最大コンテンツ描画 | ≤ 2.5s    |
| FID  | 初回入力遅延 | ≤ 100ms   |
| CLS  | 累積レイアウト偏移 | ≤ 0.1     |

## 個人学習ロードマップの提案

**深掘りする方向**（どれかひとつを選ぶ）：

- Vue 3 + Composition API + Pinia（Vue エコシステム一式）
- React + React Query + Zustand/Jotai（モダンな React 状態管理）
- Angular + RxJS + NgRx（エンタープライズ向け）

**横断的な能力**：

- TypeScript のジェネリクスと高度な型
- webpack 5 / Vite の設定チューニング
- パフォーマンス最適化：Core Web Vitals 指標体系

## まとめ

2021 年のフロントエンドのキーワードは**成熟と深化**です。フレームワークそのものに破壊的な変化はありませんが、エンジニアリング、パフォーマンス、TypeScript という方向は引き続き深まります。新しいフレームワークを追いかけるより、既存の技術スタックを極めきるほうがよいでしょう。
