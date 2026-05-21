---
title: "AST 抽象構文木入門"
date: 2018-12-04 15:57:42
tags:
  - フロントエンド
readingTime: 2
description: "Babel、ESLint、Prettier はすべて AST に基づいて動いています。AST の原理を理解することで、これらのツールをより上手く使えるようになり、独自のプラグインを書くことさえできます。"
wordCount: 314
---

Babel、ESLint、Prettier はすべて AST に基づいて動いています。AST の原理を理解することで、これらのツールをより上手く使えるようになり、独自のプラグインを書くことさえできます。

## AST とは

AST（Abstract Syntax Tree、抽象構文木）はコードをツリー構造で表現したものです。

```javascript
// ソースコード
const add = (a, b) => a + b;
```

対応する AST（簡略版）：

```
VariableDeclaration
  kind: "const"
  declarations:
    VariableDeclarator
      id: Identifier (name: "add")
      init: ArrowFunctionExpression
        params:
          Identifier (name: "a")
          Identifier (name: "b")
        body: BinaryExpression
          operator: "+"
          left: Identifier (name: "a")
          right: Identifier (name: "b")
```

## @babel/parser でコードを解析する

```javascript
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const code = `const add = (a, b) => a + b`;

// 1. Parse：ソースコード → AST
const ast = parser.parse(code, {
  sourceType: "module",
  plugins: ["typescript"],
});

// 2. Traverse：AST をトラバースしてノードを処理
traverse(ast, {
  // アロー関数に遭遇したときに呼ばれる
  ArrowFunctionExpression(path) {
    console.log("アロー関数を発見");
  },

  // 識別子に遭遇したときに呼ばれる
  Identifier(path) {
    console.log("変数名:", path.node.name);
  },
});

// 3. Generate：AST → コード
const output = generate(ast, {}, code);
console.log(output.code);
```

## シンプルな Babel プラグイン

`console.log` を削除する（本番環境でログを除去）：

```javascript
// babel-plugin-remove-console.js
module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        const { callee } = path.node;

        // console.xxx(...) かどうかを確認
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: "console" })
        ) {
          path.remove(); // 呼び出し式全体を削除
        }
      },
    },
  };
};
```

```json
// .babelrc
{
  "env": {
    "production": {
      "plugins": ["./babel-plugin-remove-console"]
    }
  }
}
```

## シンプルな ESLint ルール

`var` の使用を禁止する：

```javascript
// eslint-rule-no-var.js
module.exports = {
  create(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind === "var") {
          context.report({
            node,
            message: "const または let を使用してください",
            fix(fixer) {
              // 自動修正：var を let に置き換える
              return fixer.replaceText(
                node,
                node.getText().replace("var", "let"),
              );
            },
          });
        }
      },
    };
  },
};
```

## オンラインツール

- **AST Explorer**（astexplorer.net）：コードに対応する AST をリアルタイムで確認できる。プラグインのデバッグに必須
- **Babel Plugin Handbook**：Babel プラグイン開発の完全ドキュメント

## まとめ

- AST はコードのツリー構造表現。Babel/ESLint/Prettier はすべてこれに基づいている
- フロー：Parse（コード→AST）→ Traverse（処理）→ Generate（AST→コード）
- Babel プラグインは visitor パターンで特定のノードタイプを処理する
- astexplorer.net はデバッグに必須のツール
