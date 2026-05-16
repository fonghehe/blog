---
title: "Introduction to AST: Abstract Syntax Trees"
date: 2018-12-04 15:57:42
tags:
  - Frontend
readingTime: 1
description: "Babel, ESLint, and Prettier all work on ASTs. Understanding the AST principle helps you use these tools better and even write your own plugins."
---

Babel, ESLint, and Prettier all work on ASTs. Understanding the AST principle helps you use these tools better and even write your own plugins.

## What is an AST

An AST (Abstract Syntax Tree) is a tree-structure representation of code.

```javascript
// Source code
const add = (a, b) => a + b;
```

Corresponding AST (simplified):

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

## Parsing Code with @babel/parser

```javascript
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const code = `const add = (a, b) => a + b`;

// 1. Parse: source code → AST
const ast = parser.parse(code, {
  sourceType: "module",
  plugins: ["typescript"],
});

// 2. Traverse: walk the AST and process nodes
traverse(ast, {
  // Called when an arrow function is encountered
  ArrowFunctionExpression(path) {
    console.log("Found arrow function");
  },

  // Called when an identifier is encountered
  Identifier(path) {
    console.log("Variable name:", path.node.name);
  },
});

// 3. Generate: AST → code
const output = generate(ast, {}, code);
console.log(output.code);
```

## A Simple Babel Plugin

Replace `console.log` calls with nothing (remove logs in production):

```javascript
// babel-plugin-remove-console.js
module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        const { callee } = path.node;

        // Check if it's console.xxx(...)
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: "console" })
        ) {
          path.remove(); // Remove the entire call expression
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

## A Simple ESLint Rule

Disallow `var`:

```javascript
// eslint-rule-no-var.js
module.exports = {
  create(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind === "var") {
          context.report({
            node,
            message: "Please use const or let instead of var",
            fix(fixer) {
              // Auto-fix: replace var with let
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

## Online Tools

- **AST Explorer** (astexplorer.net): View the AST for any code in real time — essential for plugin debugging
- **Babel Plugin Handbook**: Complete documentation for Babel plugin development

## Summary

- An AST is the tree-structure representation of code; Babel, ESLint, and Prettier all build on it
- Workflow: Parse (code → AST) → Traverse (process) → Generate (AST → code)
- Babel plugins use the visitor pattern to handle specific node types
- astexplorer.net is an indispensable debugging tool
