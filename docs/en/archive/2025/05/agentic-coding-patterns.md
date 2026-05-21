---
title: "Agentic Coding: AI Agent-Driven Development Patterns"
date: 2025-05-03 10:00:00
tags:
  - Engineering
readingTime: 2
description: "One of the biggest shifts in 2025 is the maturation of Agentic Coding. AI is no longer just a tab-completion tool—it's an agent capable of autonomously completi"
wordCount: 121
---

One of the biggest shifts in 2025 is the maturation of Agentic Coding. AI is no longer just a tab-completion tool—it's an agent capable of autonomously completing complex tasks. Here are some battle-tested patterns.

## Agentic vs. Traditional AI Assistance

```
Traditional AI Assistance (2023-2024):
  - Tab completion: you write a line, AI completes a line
  - Chat: you ask a question, AI answers
  - Human-led, AI-assisted

Agentic Coding (2025):
  - AI agent understands the entire project context
  - Can autonomously plan multi-step tasks
  - Can call tools (terminal, file system, browser)
  - Human sets the goal; AI executes + human reviews
```

## Pattern 1: Spec-Driven Development

```markdown
# Task: Implement User Favorites Feature

## Requirements

Users can bookmark products from the product detail page and view their list in their profile.

## Data Model

- Favorite table: id, userId, productId, createdAt
- Links to Product and User tables

## API

- POST /api/favorites - Add favorite
- DELETE /api/favorites/:id - Remove favorite
- GET /api/favorites - Get favorites list

## Frontend

- Add favorite button to ProductDetail page
- Favorites page displays the favorites list
- Use optimistic UI updates

## Constraints

- Maximum 100 favorites per user
- Prompt unauthenticated users to log in
```

```bash
# Execute in Claude Code
claude "按照 SPEC.md 实现用户收藏功能"
# Agent will:
# 1. Create database migration
# 2. Implement API routes
# 3. Create frontend components
# 4. Write tests
# 5. Update documentation
```

## Pattern 2: TDD with Agent

```bash
# Write tests first, let the Agent implement the feature

# 1. Human writes test cases
cat > tests/search.test.ts << 'EOF'
import { describe, it, expect } from "vitest";
import { search } from "../lib/search";

describe("search", () => {
  it("should find exact match", () => {
    const results = search([{ name: "iPhone" }], "iPhone");
    expect(results).toHaveLength(1);
  });

  it("should support fuzzy search", () => {
    const results = search([{ name: "iPhone 15" }], "ipone");
    expect(results).toHaveLength(1);
  });

  it("should highlight match keywords", () => {
    const results = search([{ name: "iPhone 15 Pro" }], "iPhone");
    expect(results[0].highlight).toBe("<mark>iPhone</mark> 15 Pro");
  });

  it("should rank by relevance", () => {
    const items = [
      { name: "iPhone 15 Pro Max" },
      { name: "iPhone 15" },
      { name: "iPhone Case" },
    ];
    const results = search(items, "iPhone 15");
    expect(results[0].name).toBe("iPhone 15");
  });
});
EOF

# 2. Let the Agent implement the feature until all tests pass
claude "实现 lib/search.ts，让 tests/search.test.ts 中的所有测试通过"
```

## Pattern 3: Refactoring Agent

```bash
# Large-scale refactoring tasks

# 1. Migrate class components to function components
claude "将 src/components/ 下所有 class 组件迁移到函数组件 + hooks，
       保持 props 接口不变，保持功能不变"

# 2. Migrate from Redux to Zustand
claude "将 src/store/ 从 Redux 迁移到 Zustand，
       保持所有 action 和 selector 的 API 不变"

# 3. Migrate CSS Modules to Tailwind
claude "将 src/styles/ 下的 CSS Modules 迁移到 Tailwind CSS，
       直接写在组件的 className 中"
```

## Pattern 4: Bug Fix Agent

```bash
# Let the Agent fix a reproduced bug

# 1. Provide the error
claude "修复以下错误：
  TypeError: Cannot read properties of undefined (reading 'map')
  at ProductList (src/components/ProductList.tsx:15)

  复现步骤：
  1. 访问 /products
  2. 网络请求失败时页面崩溃
  3. 预期：显示空状态，不是崩溃"

# Agent will:
# 1. Navigate to ProductList.tsx:15
# 2. Find that products may be undefined
# 3. Add loading and error state handling
# 4. Possibly also suggest adding an error boundary
```

## Pattern 5: Migration Agent

```bash
# Dependency upgrades

# Next.js 14 → 15
claude "将项目从 Next.js 14 升级到 15，
       处理所有 breaking changes，
       运行测试确保功能不变"

# React 18 → 19
claude "将项目从 React 18 升级到 19，
       将 forwardRef 改为直接 ref prop，
       将 useFormState 改为 useActionState"

# Tailwind 3 → 4
claude "将项目从 Tailwind CSS 3 升级到 4，
       将 tailwind.config.js 迁移到 CSS @theme 块"
```

## Boundaries of Agent Capability

```
What agents are good at:
  ✓ Repetitive work with clear specifications
  ✓ Code migration and refactoring
  ✓ Test generation
  ✓ Bug fixing (with clear error messages)
  ✓ Documentation generation

What agents are not good at:
  ✗ Decisions requiring deep business understanding
  ✗ Performance optimization (needs real data analysis)
  ✗ Architecture design (requires forward-looking thinking)
  ✗ Security-sensitive code (auth, encryption)
  ✗ Creative UI/UX design
```

## Summary

- Agentic Coding is the most important development pattern change of 2025
- Spec-Driven Development makes the development process more structured
- TDD + Agent is the formula for high-quality code
- Agents excel at migration, refactoring, and test generation; they're not suited for business innovation
- The human role shifts from "writing code" to "defining requirements + reviewing code"
