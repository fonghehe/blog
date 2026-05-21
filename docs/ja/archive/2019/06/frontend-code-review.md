---
title: "フロントエンドのコードレビューのポイント"
date: 2019-06-27 16:43:22
tags:
  - フロントエンド
readingTime: 2
description: "チームで最近コードレビューを推進しています。フロントエンドのCRチェックリストをまとめました。実際に運用してみると、バグの発見だけでなく、知識共有の方法でもあることが分かります。"
wordCount: 427
---

チームで最近コードレビューを推進しています。フロントエンドのCRチェックリストをまとめました。実際に運用してみると、バグの発見だけでなく、知識共有の方法でもあることが分かります。

## コードスタイルの一貫性

スタイルが不統一なコードは読むのが辛いです。2019年では、ESLint + Prettierの組み合わせが標準です。

**プロジェクトルートのESLint設定**：

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "prettier", // Prettierと競合するルールを無効化するため最後に
  ],
  plugins: ["react", "react-hooks"],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  env: {
    browser: true,
    node: true,
    jest: true,
    es6: true,
  },
  rules: {
    // React Hooksのルール（2019年の新機能）
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // よく使うルール
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: ["error", "always"],
  },
};
```

**Prettierの設定**：

```json
// .prettierrc
{
  "singleQuote": true,
  "semi": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**エディターの自動フォーマット（VS Code）**：

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

`husky` + `lint-staged`を追加して、コミット前に強制チェック：

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,scss}": ["prettier --write"]
  }
}
```

## CRチェックリスト

スタイル以外に確認すること：

1. **正確性**：ロジックは要件と一致しているか？エッジケースは処理されているか？
2. **パフォーマンス**：不要な再レンダリングは？メモリリークは？ループ内に高コストな操作は？
3. **セキュリティ**：XSS脆弱性は？機密データの露出は？入力バリデーションは？
4. **可読性**：変数・関数名は意味があるか？複雑なロジックにコメントはあるか？
5. **テスト可能性**：重要なロジックをユニットテストできるか？

コードレビューは双方向の会話として行うことが最も効果的です——レビュアーは理由を説明し、著者は決定を説明します。
