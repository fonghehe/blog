---
title: "AST 抽象语法树入门"
date: 2018-12-04 15:57:42
tags:
  - 前端
readingTime: 1
description: "Babel、ESLint、Prettier 都基于 AST 工作。了解 AST 原理，能帮助我们更好地使用这些工具，甚至写自己的插件。"
wordCount: 184
---

Babel、ESLint、Prettier 都基于 AST 工作。了解 AST 原理，能帮助我们更好地使用这些工具，甚至写自己的插件。

## 什么是 AST

AST（Abstract Syntax Tree）是代码的树形结构表示。

```javascript
// 源码
const add = (a, b) => a + b;
```

对应的 AST（简化版）：

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

## 用 @babel/parser 解析代码

```javascript
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const code = `const add = (a, b) => a + b`;

// 1. Parse：源码 → AST
const ast = parser.parse(code, {
  sourceType: "module",
  plugins: ["typescript"],
});

// 2. Traverse：遍历 AST，处理节点
traverse(ast, {
  // 遇到箭头函数时调用
  ArrowFunctionExpression(path) {
    console.log("找到箭头函数");
  },

  // 遇到标识符时调用
  Identifier(path) {
    console.log("变量名:", path.node.name);
  },
});

// 3. Generate：AST → 代码
const output = generate(ast, {}, code);
console.log(output.code);
```

## 简单的 Babel 插件

把 `console.log` 替换为空（生产环境去掉 log）：

```javascript
// babel-plugin-remove-console.js
module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        const { callee } = path.node;

        // 检查是否是 console.xxx(...)
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: "console" })
        ) {
          path.remove(); // 删除整个调用表达式
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

## 简单的 ESLint 规则

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
            message: "请使用 const 或 let 替代 var",
            fix(fixer) {
              // 自动修复：把 var 替换为 let
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

## 在线工具

- **AST Explorer**（astexplorer.net）：实时查看代码对应的 AST，调试插件必备
- **Babel Plugin Handbook**：Babel 插件开发完整文档

## 小结

- AST 是代码的树形结构，Babel/ESLint/Prettier 都基于它工作
- 流程：Parse（代码→AST）→ Traverse（处理）→ Generate（AST→代码）
- Babel 插件通过 visitor 模式处理特定节点类型
- astexplorer.net 是必备的调试工具
