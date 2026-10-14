# フロントエンド成長記録

[中文](./README.md) | [English](./README.en.md) | [繁體中文（台灣）](./README.zh-tw.md) | [繁體中文（香港）](./README.zh-hk.md)

2018年から始まったフロントエンドエンジニアの学習と成長の記録です。

**オンラインで読む**: https://fonghehe.github.io/blog/ja/

## 📖 コンテンツ

- **📅 最新記事**: [2026年の記事](https://fonghehe.github.io/blog/ja/posts/) - 最新フロントエンド動向と深掘り解説
- **📚 アーカイブ**: [2018–2025](https://fonghehe.github.io/blog/ja/archive/) - 過去の技術的な知見

## 🌐 言語

| 言語              | リンク                                 |
| ----------------- | -------------------------------------- |
| 中文 (デフォルト) | https://fonghehe.github.io/blog/       |
| English           | https://fonghehe.github.io/blog/en/    |
| 日本語            | https://fonghehe.github.io/blog/ja/    |
| 繁體中文（台灣）  | https://fonghehe.github.io/blog/zh-tw/ |
| 繁體中文（香港）  | https://fonghehe.github.io/blog/zh-hk/ |

## 技術スタック

- **フレームワーク**: VitePress 1.6.4
- **言語**: Markdown + Vue 3 + TypeScript
- **デプロイ**: GitHub Pages + GitHub Actions
- **パッケージマネージャー**: pnpm
- **テーマ**: カスタムダーク/ライトテーマ

## 🚀 ローカル開発

```bash
pnpm install
pnpm docs:dev
```

## 🏗️ ビルド

```bash
pnpm docs:build
```

## 👁️ ビルドのプレビュー

```bash
pnpm docs:preview
```

## 📝 記事統計

- 2018–2025年: 1,383本 (アーカイブ)
- 2026年: 135本の最新記事
- 合計: 1,518本の深度技術記事

## 🎯 主なトピック

- Vueエコシステム
- Reactの最新動向
- Angularフレームワーク
- エンジニアリング & ビルドツール
- パフォーマンス最適化
- セキュリティベストプラクティス
- TypeScriptの実践
- Node.js開発
- テストと品質
- CSSの新機能
- モバイル・クロスプラットフォーム開発

## 📄 ライセンス

MIT

## 保守と品質チェック

Node.js 22.18 以降と `packageManager` 指定の pnpm を使用します。

```bash
pnpm check
pnpm content:report
pnpm docs:build
```

[学習ルート](docs/ja/guides.md)、[編集方針](docs/ja/about.md)、[内容確認レポート](maintenance/content-quality-report.md)を追加しました。記事には `updated`、`lastVerified`、`version`、`series` を記載できます。検証日は実際の確認後だけ記載します。検索条件とページ番号は URL に保存されます。CI は全言語を確認し、既知の課題に対する新しい問題を検出します。

全体ビルドは両言語グループ、サイトマップ、5言語の RSS を統合し、最後にオフライン用ワーカーを生成します。開始画面の資源と閲覧済みページを保存し、全記事は事前取得しません。機械的な修正は全記事の検証を意味しません。
