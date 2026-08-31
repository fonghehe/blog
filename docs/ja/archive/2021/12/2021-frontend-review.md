---
title: "2021 フロントエンドエコシステム振り返り：Vite の年"
date: 2021-12-13 16:06:07
tags:
  - フロントエンド
  - エンジニアリング
  - Vite

readingTime: 5
description: "2021 年快结束了，整理一下这一年前端生态的重要变化。如果用一个词总结 2021 的前端，我会选\"Vite\"。"
wordCount: 1504
---

2021 年も終わりに近づき、この 1 年前端エコシステムで起きた重要な変化を整理する。2021 年のフロントエンドを一言で総括するなら、私は「Vite」を選ぶ。

## ビルドツール：Vite がデファクトスタンダードに

2021 年初頭に Vite 2.0 がリリースされ、年末には Vue 3 や多くの React プロジェクトのデフォルト選択となっていた。

**主な節目：**
- 2 月：Vite 2.0 が正式リリースされ、ESM + esbuild による事前バンドルのアーキテクチャを採用
- 6 月：SvelteKit がデフォルトで Vite を使用に
- 9 月：Vite チームが Vitest の設計案を公開
- 12 月：Vite エコシステムのプラグインが 300 を超える

Vite はフロントエンドにおける「開発サーバー」の概念を変えた。バンドルしなくても開発でき、必要に応じたオンデマンドのコンパイルこそが正道だ。

```bash
# Webpack 时代的启动
npm run dev    # 等待 30s...

# Vite 时代的启动
npm run dev    # < 1s
```

Webpack 5 も今年は多くの最適化（永続キャッシュ、Module Federation）を行ったが、開発体験の差はすでに開いている。

## フレームワークの勢力図

### Vue エコシステム

- **Vue 3.2**：`<script setup>` が安定版としてマークされ、コンパイル時マクロが推奨の書き方になった
- **Pinia**：Vue の状態管理の推奨ソリューションとなり、Vuex 5 は Pinia をベースに再設計される
- **VitePress**：ドキュメントサイト生成器で、VuePress を置き換える
- **Nuxt 3**：10 月に RC をリリース。Vite + Nitro サーバーエンジンをベースとする

### React エコシステム

- **React 18**：Alpha → Beta を経て、年末に RC 段階へ
- **Concurrent 機能**：`useTransition`、`useDeferredValue`、Automatic Batching
- **Suspense SSR**：ストリーミングレンダリング + 選択的ハイドレーション
- **Next.js 12**：Rust コンパイラ（SWC）、Middleware、React 18 対応
- **Remix**：11 月にオープンソース化され、Next.js に挑む

### 新興フレームワーク

- **Solid.js**：React 風の構文で仮想 DOM を持たず、パフォーマンスに優れる
- **Qwik**：Resumability（再開可能性）の概念により、JS ゼロでのインタラクティブ性を実現
- **Astro**：アイランドアーキテクチャによる一部のハイドレーション

## CSS の変化

- **Tailwind CSS 3.0**：JIT がデフォルトモードになり、任意の値がサポートされた
- **CSS Container Queries**：Chrome Canary で実験的にサポート
- **Lightning CSS**：Rust 製の CSS ツールチェーン（Parcel 2 が使用）
- **UnoCSS**：Anthony Fu が公開したアトミック CSS エンジンで、Windi CSS よりも高性能

## TypeScript

- **TypeScript 4.4**：制御フロー解析の改善、`exactOptionalPropertyTypes`
- **TypeScript 4.5**：`Awaited` 型、`type` 修飾子のインポート
- 型レベル体操のコミュニティが活発：`type-fest`、`ts-toolbelt`

## ツールチェーン

### パッケージ管理

- **pnpm**：2021 年最も成長したパッケージマネージャーで、ディスク容量の節約と厳格な依存関係の分離を実現
- **Corepack**：Node.js 組み込みのパッケージマネージャー管理ツール

### Monorepo

- **Turborepo**：12 月に Vercel がオープンソース化した、Go 製の高性能ビルドオーケストレーター
- **Nx**：継続的に改善され、12.9 で Vite executor をサポート
- **pnpm workspace**：最も軽量な Monorepo 手法となった

### テスト

- **Vitest**：概念が固まり、年末に beta をリリース。Vite ベースのユニットテストフレームワーク
- **Playwright**：E2E テストの新星で、マイクロソフト製。クロスブラウザ対応が優れている
- **Testing Library**：React コンポーネントテストの主流の選択肢となった

## ランタイム

- **Deno 1.15**：互換性が向上し、npm パッケージ互換レイヤーが改善
- **Bun**：Jarred Sumner が Zig で新しい JS ランタイムの開発を開始（年末に予告）
- **Node.js 16 LTS**：10 月に LTS バージョンとなった

## 注目すべきトレンド

### 1. Rust によるフロントエンドツールチェーンの再実装

esbuild、SWC、Rome、Lightning CSS……JavaScript ツールチェーンを Rust や Go で書き直す流れは不可逆だ。10 倍以上の性能差がその中核的な推進力である。

### 2. ESM First

Vite は開発環境での ESM 普及を推し進めた。ブラウザネイティブの ESM サポートがますます成熟し、バンドルが唯一の選択肢ではなくなっている。

### 3. コンパイル時の最適化

`<script setup>`、Svelte のコンパイル戦略、Solid のコンパイル時レスポンシブ性……フレームワークは実行時ではなくコンパイル段階で最適化を行う方向にますます傾いている。

### 4. Edge Computing

Vercel Edge Functions、Cloudflare Workers、Deno Deploy……エッジコンピューティングにより、フロントエンドに新たなデプロイ形態が生まれた。

## 私の 2021 年ツールチェーン

```
框架：    Vue 3 + <script setup>
构建：    Vite
状态：    Pinia
CSS：     Tailwind CSS 3.0
包管理：  pnpm
Monorepo：pnpm workspace + Turborepo
测试：    Vitest（实验中）+ Playwright
部署：    Vite SSR + Docker
```

## まとめ

- 2021 年は Vite の年であり、ビルドツールの勢力図は根本から変わった
- React 18 のコンカレント機能は、フレームワーク層で最も重要な変化だ
- Rust によるツールチェーンの書き直しはトレンドであり、性能差により JavaScript ツールは見劣りする
- Monorepo ツールチェーンが成熟：pnpm + Turborepo が最適な組み合わせだ
- 2022 年に期待：Vitest の正式リリース、React 18 正式版、RSC（React Server Components）の本番導入
