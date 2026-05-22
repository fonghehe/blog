---
title: "AST 抽象語法樹入門：落地路徑與實戰建議"
date: 2018-12-04 15:57:42
tags:
  - 前端
readingTime: 1
description: "Babel、ESLint、Prettier 都基於 AST 工作。瞭解 AST 原理，能幫助我們更好地使用這些工具，甚至寫自己的外掛。"
wordCount: 184
---

Babel、ESLint、Prettier 都基於 AST 工作。瞭解 AST 原理，能幫助我們更好地使用這些工具，甚至寫自己的插件。

## 什麼是 AST

AST（Abstract Syntax Tree）是代碼的樹形結構表示。

```javascript
// 源碼
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

## 用 @babel/parser 解析代碼

```javascript
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const code = `const add = (a, b) => a + b`;

// 1. Parse：源碼 → AST
const ast = parser.parse(code, {
  sourceType: "module",
  plugins: ["typescript"],
});

// 2. Traverse：遍歷 AST，處理節點
traverse(ast, {
  // 遇到箭頭函數時調用
  ArrowFunctionExpression(path) {
    console.log("找到箭頭函數");
  },

  // 遇到標識符時調用
  Identifier(path) {
    console.log("變量名:", path.node.name);
  },
});

// 3. Generate：AST → 代碼
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
          path.remove(); // 刪除整個調用表達式
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

## 在線工具

- **AST Explorer**（astexplorer.net）：實時查看代碼對應的 AST，調試插件必備
- **Babel Plugin Handbook**：Babel 插件開發完整文檔

## 小結

- AST 是代碼的樹形結構，Babel/ESLint/Prettier 都基於它工作
- 流程：Parse（代碼→AST）→ Traverse（處理）→ Generate（AST→代碼）
- Babel 插件通過 visitor 模式處理特定節點類型
- astexplorer.net 是必備的調試工具
