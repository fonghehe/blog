---
title: "2018年 フロントエンドツールチェーンまとめ"
date: 2018-12-24 17:28:57
tags:
  - フロントエンド
readingTime: 3
description: "年末が近づいてきました。今年使ったフロントエンドツールを振り返り、各ツールの位置づけと選定理由を記録します。"
---

年末が近づいてきました。今年使ったフロントエンドツールを振り返り、各ツールの位置づけと選定理由を記録します。

## ビルドツール

**Webpack 4**（主力）

- 向いている場面：複雑なアプリ。コード分割、Tree Shaking、各種 loader が必要
- 特徴：機能が最も充実していてエコシステムが豊富。設定も最も複雑
- 今年のバージョン：4.0（2月リリース）。ビルド速度が大幅向上

**Parcel**（サブ選択）

- 向いている場面：クイックプロトタイプ、シンプルなプロジェクト。設定ゼロ
- 特徴：すぐに使える。設定ファイル不要
- 社内ツールを一度作ったとき、確かに速かった

**Rollup**（ライブラリのバンドル）

- 向いている場面：JS ライブラリのバンドル。クリーンな ESM/CJS 形式で出力
- 特徴：Webpack より早くから Tree Shaking をサポート。バンドルが小さい
- npm パッケージを公開するときに使う

## パッケージマネージャー

**yarn**（現在の主力）

- lockfile の信頼性が高く、インストール速度が速い
- workspace で monorepo をサポート

**npm 6**（も使っている）

- 今年のアップデートで速度が大幅向上
- package-lock.json がより完善された

## コード品質

**ESLint**

- `eslint-config-airbnb` を基本ルールとして使用
- Vue と組み合わせて `eslint-plugin-vue` を使用
- コミット前に lint-staged で自動チェック

**Prettier**

- コードフォーマットの統一
- ESLint との連携：ESLint はロジックエラーを管理し、Prettier はフォーマットを管理

**husky + lint-staged**

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,vue}": ["eslint --fix", "git add"],
    "*.{css,scss}": ["stylelint --fix", "git add"]
  }
}
```

## フレームワークとライブラリ

**Vue 2.5**（仕事のプロジェクト）

- Vuex 3.x
- Vue Router 3.x
- Element UI（デスクトップ向け）
- Vant（モバイル向け）

**React 16.x**（自己学習）

- Redux + Redux Thunk
- React Router v4

**TypeScript 3.x**

- 今年から新しいプロジェクトで使い始めた
- JS より型安全なのは確かに便利

## HTTP

**axios**（ほぼすべてのプロジェクトで使用）

- インターセプターをカプセル化して認証とエラーを統一処理
- リクエストのキャンセルをサポート

## テスト

**Jest**（単体テスト）

- Vue Test Utils と組み合わせて使用

**Cypress**（E2E、使い始めたばかり）

- ユーザー操作を録画してテストを生成できる

## 開発体験

**VS Code**（主力エディター）

- Vetur（Vue サポート）
- ESLint プラグイン
- Prettier プラグイン
- GitLens

**Chrome DevTools**

- Performance パネル（パフォーマンス分析）
- Network パネル（ネットワーク分析）
- Application パネル（localStorage、Service Worker）

## 来年注目したいツール

```
Vite（尤雨溪が開発中。ES module ベースの開発サーバー）→ まだ早いが注目価値あり
TypeScript 3.x の新機能
React Hooks（提案段階）→ React エコシステムを変えると思う
```

## まとめ

ツールは適切なものを選ぶ。新しいほど良いとは限らない：

- 複雑なアプリ → Webpack
- クイックプロトタイプ → Parcel
- ライブラリの公開 → Rollup
- コード品質 → ESLint + Prettier + lint-staged（必須設定）
- TypeScript は投資する価値あり。開発体験とリファクタリングの自信が向上する

2018年はフロントエンドツールチェーンが急速に進化した一年。2019年もさらなる驚きを期待しています。
