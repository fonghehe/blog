---
title: "AST 抽象語法樹入門"
date: 2018-12-04 15:57:42
tags:
  - 前端
readingTime: 1
description: "Babel、ESLint、Prettier 都基於 AST 工作。瞭解 AST 原理，能幫助我們更好地使用這些工具，甚至寫自己的外掛。"
---

Babel、ESLint、Prettier 都基於 AST 工作。瞭解 AST 原理，能幫助我們更好地使用這些工具，甚至寫自己的外掛。

## 什麼是 AST

AST（Abstract Syntax Tree）是程式碼的樹形結構表示。

```javascript
// 原始碼
const add = (a, b) => a + b;
```

對應的 AST（簡化版）：

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

## 用 @babel/parser 解析程式碼

```javascript
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const code = `const add = (a, b) => a + b`;

// 1. Parse：原始碼 → AST
const ast = parser.parse(code, {
  sourceType: "module",
  plugins: ["typescript"],
});

// 2. Traverse：遍歷 AST，處理節點
traverse(ast, {
  // 遇到箭頭函式時呼叫
  ArrowFunctionExpression(path) {
    console.log("找到箭頭函式");
  },

  // 遇到識別符號時呼叫
  Identifier(path) {
    console.log("變數名:", path.node.name);
  },
});

// 3. Generate：AST → 程式碼
const output = generate(ast, {}, code);
console.log(output.code);
```

## 簡單的 Babel 外掛

把 `console.log` 替換為空（生產環境去掉 log）：

```javascript
// babel-plugin-remove-console.js
module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        const { callee } = path.node;

        // 檢查是否是 console.xxx(...)
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: "console" })
        ) {
          path.remove(); // 刪除整個呼叫表示式
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

## 簡單的 ESLint 規則

禁止使用 `var`：

```javascript
// eslint-rule-no-var.js
module.exports = {
  create(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind === "var") {
          context.report({
            node,
            message: "請使用 const 或 let 替代 var",
            fix(fixer) {
              // 自動修復：把 var 替換為 let
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

## 線上工具

- **AST Explorer**（astexplorer.net）：即時檢視程式碼對應的 AST，除錯外掛必備
- **Babel Plugin Handbook**：Babel 外掛開發完整文件

## 小結

- AST 是程式碼的樹形結構，Babel/ESLint/Prettier 都基於它工作
- 流程：Parse（程式碼→AST）→ Traverse（處理）→ Generate（AST→程式碼）
- Babel 外掛通過 visitor 模式處理特定節點型別
- astexplorer.net 是必備的除錯工具
