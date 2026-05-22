---
title: "マイクロフロントエンドアーキテクチャ設計：技術選定だけではない"
date: 2021-06-07 10:05:40
tags:
  - マイクロフロントエンド
  - エンジニアリング

readingTime: 3
description: "今年、チームで大規模な B 端プラットフォームのマイクロフロントエンド化に取り組みました。初期のモノリシックな Vue アプリケーションから6つのサブアプリケーションに分割しました。技術選定には qiankun を採用しましたが、最も学びがあったのは導入プロセスそのものではなく、アーキテクチャ設計段階での意思決定でした。"
wordCount: 863
---

今年チームで大規模な B 端プラットフォームのマイクロフロントエンド化を推進し、初期のモノリシックな Vue アプリケーションから 6 つのサブアプリケーションに分割しました。技術選定には qiankun を採用しましたが、本当に学びがあったのは導入プロセスそのものではなく、アーキテクチャ設計段階での意思決定でした。

## マイクロフロントエンドを採用すべき時期

マイクロフロントエンドは銀の弾丸ではありません。マイクロフロントエンドのためにマイクロフロントエンドを導入し、結果的に複雑性が増したチームを何度も見てきました。私たちがマイクロフロントエンドの必要性を判断する基準：

```
マイクロフロントエンドが必要なシグナル：
- チームが 3 つ以上あり、それぞれ独立して反復開発し、リリースサイクルが異なる
- 技術スタックを統一できない（歴史的負債）
- 旧システムを段階的に移行する必要がある
- サブシステム間で統一されたユーザー体験を維持する必要がある

マイクロフロントエンドが不要な場合：
- チームが小さく、リリースを調整できる
- モジュール間の境界が明確で、独立したデプロイでも問題ない
- 純粋なフロントエンドルーティングのモノリシックアプリケーションで、コード分割で十分
```

私たちの状況は：3 つのチームが 6 つのサブシステムを保守しており、リリース頻度は毎週から毎月まで様々で、分割が不可欠でした。

## アプリ分割戦略

当初は業務ドメインで分割しようとしましたが、うまくいきませんでした。最終的に得られた経験則として、2つの軸で考慮します：

```javascript
// 分割粒度の参考
const splitStrategy = {
  // 軸一：チーム境界
  teamOwnership: '各サブアプリケーションには明確な担当チームが必要',

  // 軸二：独立性
  independence: 'サブアプリケーションは独立して開発、テスト、デプロイできるべき',

  // アンチパターン：ページ単位での分割
  antiPattern: '1 ルート = 1 サブアプリケーション はサブアプリケーションが多くなりすぎる'
}
```

最終的に私たちは業務ドメイン + チーム境界で分割しました：ユーザーセンター、注文システム、データダッシュボード、運用管理画面、カスタマーサポートツール、基本コンポーネント。

## 共有レイヤーの設計

これは最も陥りやすい落とし穴です。サブアプリケーション間には多くの共有すべきものがあります：ユーザー情報、権限データ、共通コンポーネント、ユーティリティ関数。私たちの解決策は階層化設計です：

```javascript
// shared/ はすべてのサブアプリケーションの共通依存レイヤー
// pnpm workspace で管理

// packages/shared-utils/src/index.ts
export { request } from './request'
export { useAuth } from './auth'
export { formatCurrency, formatDate } from './format'

// packages/shared-components/src/index.ts
export { DataTable } from './DataTable'
export { SearchForm } from './SearchForm'
export { PageContainer } from './PageContainer'

// サブアプリケーションは pnpm workspace 経由で参照
// apps/order-system/package.json
{
  "dependencies": {
    "@company/shared-utils": "workspace:*",
    "@company/shared-components": "workspace:*"
  }
}
```

重要な判断：共有レイヤーのバージョンは `workspace:*` で最新に固定し、すべてのサブアプリケーションで統一リリースすることで、バージョンの断片化を防ぎます。

## 状態通信ソリューション

サブアプリケーション間の通信は最も抑制が必要な部分です。私たちの原則は：通信できるならしない、どうしても必要な場合はメインアプリケーション経由で行う：

```javascript
// メインアプリケーション：グローバルステートセンター
// CustomEvent で実装、追加の依存関係は不要
class GlobalStore {
  constructor() {
    this.state = {}
    this.listeners = {}
  }

  set(key, value) {
    this.state[key] = value
    window.dispatchEvent(
      new CustomEvent(`store:${key}`, { detail: value })
    )
  }

  get(key) {
    return this.state[key]
  }

  on(key, callback) {
    window.addEventListener(`store:${key}`, (e) => callback(e.detail))
    return () => window.removeEventListener(`store:${key}`, callback)
  }
}

// サブアプリケーションでの使用
const store = window.__GLOBAL_STORE__
store.on('currentUser', (user) => {
  // ユーザー情報の変更に応答
  refreshPermissions(user.id)
})
```

## まとめ

- マイクロフロントエンドの価値は技術ではなく、チームの協業効率の向上にある
- 分割粒度はページ単位ではなく、チーム境界に従う
- 共有レイヤーの設計がその後の保守コストを左右するため、厳格に管理する必要がある
- 状態通信は抑制的に行い、URL と共有ストレージによる同期を優先する
- 段階的な移行が一気に行うよりも安全である
