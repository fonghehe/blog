---
title: "Agentic Coding：AI Agent 驱动的编码模式"
date: 2025-05-03 09:37:14
tags:
  - 工程化
readingTime: 2
description: "2025 年最大的变化之一是 Agentic Coding 的成熟。AI 不再只是补全代码的工具，而是能自主完成复杂任务的 Agent。来分享一些实战模式。"
wordCount: 171
---

2025 年最大的变化之一是 Agentic Coding 的成熟。AI 不再只是补全代码的工具，而是能自主完成复杂任务的 Agent。来分享一些实战模式。

## Agentic vs 传统 AI 辅助

```
传统 AI 辅助（2023-2024）：
  - Tab 补全：你写一行，AI 补一行
  - Chat 对话：你问一个问题，AI 回答
  - 人类主导，AI 辅助

Agentic Coding（2025）：
  - AI Agent 能理解整个项目上下文
  - 能自主规划多步任务
  - 能调用工具（终端、文件系统、浏览器）
  - 人类定目标，AI 执行 + 人类审核
```

## 模式一：Spec-Driven Development

```markdown
# 任务：实现用户收藏功能

## 需求
用户可以在产品详情页收藏产品，在个人中心查看收藏列表。

## 数据模型
- Favorite 表：id, userId, productId, createdAt
- 关联 Product 和 User 表

## API
- POST /api/favorites - 添加收藏
- DELETE /api/favorites/:id - 取消收藏
- GET /api/favorites - 获取收藏列表

## 前端
- ProductDetail 页面添加收藏按钮
- Favorites 页面展示收藏列表
- 使用 optimistic UI 更新

## 约束
- 每个用户最多收藏 100 个产品
- 未登录时引导登录
```

```bash
# 在 Claude Code 中执行
claude "按照 SPEC.md 实现用户收藏功能"
# Agent 会：
# 1. 创建数据库 migration
# 2. 实现 API 路由
# 3. 创建前端组件
# 4. 编写测试
# 5. 更新文档
```

## 模式二：TDD with Agent

```bash
# 先写测试，让 Agent 实现功能

# 1. 人类写测试用例
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

# 2. 让 Agent 实现功能，直到所有测试通过
claude "实现 lib/search.ts，让 tests/search.test.ts 中的所有测试通过"
```

## 模式三：Refactoring Agent

```bash
# 大规模重构任务

# 1. 把 class 组件迁移到函数组件
claude "将 src/components/ 下所有 class 组件迁移到函数组件 + hooks，
       保持 props 接口不变，保持功能不变"

# 2. 从 Redux 迁移到 Zustand
claude "将 src/store/ 从 Redux 迁移到 Zustand，
       保持所有 action 和 selector 的 API 不变"

# 3. CSS Modules 迁移到 Tailwind
claude "将 src/styles/ 下的 CSS Modules 迁移到 Tailwind CSS，
       直接写在组件的 className 中"
```

## 模式四：Bug Fix Agent

```bash
# 复现 bug 后让 Agent 修复

# 1. 提供错误信息
claude "修复以下错误：
  TypeError: Cannot read properties of undefined (reading 'map')
  at ProductList (src/components/ProductList.tsx:15)

  复现步骤：
  1. 访问 /products
  2. 网络请求失败时页面崩溃
  3. 预期：显示空状态，不是崩溃"

# Agent 会：
# 1. 定位到 ProductList.tsx:15
# 2. 发现 products 可能为 undefined
# 3. 添加 loading 和 error 状态处理
# 4. 可能还会建议添加 error boundary
```

## 模式五：Migration Agent

```bash
# 依赖升级

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

## Agent 的边界

```
Agent 擅长的：
  ✓ 有明确规范的重复性工作
  ✓ 代码迁移和重构
  ✓ 测试生成
  ✓ Bug 修复（有明确的错误信息）
  ✓ 文档生成

Agent 不擅长的：
  ✗ 需要深入业务理解的决策
  ✗ 性能优化（需要分析实际数据）
  ✗ 架构设计（需要前瞻性思考）
  ✗ 安全敏感代码（认证、加密）
  ✗ 创造性的 UI/UX 设计
```

## 小结

- Agentic Coding 是 2025 年最重要的开发模式变化
- Spec-Driven Development 让开发流程更结构化
- TDD + Agent 是高质量代码的保证
- Agent 擅长迁移、重构、测试生成，不擅长业务创新
- 人类的角色从 "写代码" 转变为 "定义需求 + 审核代码"
