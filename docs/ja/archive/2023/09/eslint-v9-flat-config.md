---
title: "ESLint v9 Flat Config：設定構造と移行チェック"
date: 2023-09-08 15:28:03
updated: 2026-10-24
version: "ESLint 9.x (historical migration)"
tags:
  - ESLint
readingTime: 3
wordCount: 704
description: "ESLint v9 の設定配列、ファイル対象、除外パターン、移行確認を振り返り、公開日と修正日を区別します。"
---

> 修正について：元のアーカイブ日と URL を残し、2026-10-24 に書き直しました。ESLint v9 の正式公開日は 2024-04-05 です。以下は後から整理した移行解説であり、2023 年に v9 が正式公開されていたという意味ではありません。v9 の公式保守は終了しています。新規プロジェクトでは公式のサポート表を確認してください。

Flat Config は JavaScript モジュールから設定配列をエクスポートします。同じファイルに一致する設定オブジェクトを順に組み合わせ、後のルール設定が前の設定を上書きします。`files` は各オブジェクトの対象を指定します。

## 設定配列の例

歴史的な ESLint 9 と `@eslint/js` 9 の組み合わせを説明する学習用設定です。本番稼働や性能測定の実績を示すものではありません。

```javascript
// eslint.config.mjs — historical ESLint 9 example
import js from '@eslint/js'

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: { 'no-unused-vars': 'warn' },
  },
]
```

`js.configs.recommended` は推奨ルールを提供し、最後のオブジェクトで JavaScript 向けのルールを調整します。`ignores` だけを持つオブジェクトはグローバル除外を表します。ブラウザや Node.js のグローバル変数、TypeScript や Vue SFC のパーサー、フレームワーク用プラグインは別途設定が必要です。

## 移行の確認事項

1. ESLint とプラグインのバージョンを固定し、Flat Config と対象メジャーバージョンへの対応を確認します。
2. 旧設定の `env`、`parserOptions`、`globals` を新形式へ対応付けます。ファイル名の変更だけでは不十分です。
3. 除外パターンを設定へ移します。旧 `.eslintignore` の動作が自動的に維持されるとは限らないため、パスの一致を確認します。
4. `npx eslint --print-config src/example.js` で対象ファイルの最終的なルールと言語オプションを調べます。
5. 成功、エラー、除外となるべきファイルを確認してから全体の lint を実行します。lint の成功は業務機能の正しさを証明しません。

## バージョンの位置付け

本記事は v9 への移行の背景を残しています。現在の開発では、実際に使うバージョンの公式文書を参照してください。本番検証済みの事例としては扱いません。

## 参考資料

- [ESLint v9.0.0 release — 2024-04-05](https://eslint.org/blog/2024/04/eslint-v9.0.0-released/)
- [ESLint v9 configuration migration guide](https://eslint.org/docs/v9.x/use/configure/migration-guide)
- [ESLint version support](https://eslint.org/version-support/)
