---
title: "AI-Driven Frontend Workflow: My Practice Summary"
date: 2024-10-18 14:32:09
tags:
  - Engineering
readingTime: 2
description: "In 2024, AI tools have gone from \"optional\" to \"essential\". Here's a summary of my current AI-assisted development workflow."
wordCount: 508
---

In 2024, AI tools have gone from "optional" to "essential". Here's a summary of my current AI-assisted development workflow.

## Tool Matrix

| 工具              | 用途                   | 我的使用频率 |
| ----------------- | ---------------------- | ------------ |
| GitHub Copilot    | 代码补全               | 每天         |
| Claude 3.5 Sonnet | 复杂问题分析、架构讨论 | 每天         |
| ChatGPT-4o        | 快速答疑、内容生成     | 每周         |
| Cursor            | AI 原生编辑器          | 新项目尝试中 |
| v0.dev            | UI 原型生成            | 每月         |

## Code Generation: From Prompt to Usable Code

```
提示词质量决定输出质量。

差的提示词：
"帮我写一个列表组件"

好的提示词：
"用 React 18 + TypeScript 写一个商品列表组件：
- Props：items: Product[]（Product 有 id, name, price, image, inStock 字段）
- 支持加载状态（skeleton loading）
- 支持空状态
- 每个 item 有'加入购物车'按钮，inStock 为 false 时禁用
- 用 Tailwind CSS 样式，响应式：1列→2列→4列
- 点击卡片触发 onSelect 回调"
```

With specific types, constraints, and interaction requirements, AI can produce code that is close to production-ready.

## My Daily Workflow

**1. 早晨规划（5分钟）**

把今天的任务告诉 Claude，让它帮我拆分任务、识别依赖、估时间。不是为了让 AI 替我规划，而是用对话的方式理清思路。

**2. 写代码时（持续）**

```
- 样板代码 → Copilot 自动补全
- 算法逻辑 → 先自己想，卡住了问 Claude
- 类型定义 → Copilot 补全 + 自己审查
- 正则表达式 → 直接让 AI 生成
- SQL 查询 → AI 草稿 + 自己优化
```

**3. Code Review 前（每次提 PR）**

```
把 diff 粘给 Claude，问：
- 有没有潜在的安全问题？
- 有没有明显的性能问题？
- 有没有边界条件没处理？
- 代码可读性如何？

不是让 AI 替代 Review，而是先自检
```

**4. Debug（有时）**

Give the error stack and relevant code to AI; it can usually quickly point you in the right direction. But AI can sometimes give confident but wrong answers—stay skeptical.

## Limitations of AI: What You Must Handle Yourself

**Business Logic**: AI does not understand your product requirements; decisions must be made by you.

**Security**: AI-generated code may have security vulnerabilities (SQL injection, XSS, IDOR); you must review it yourself.

```typescript
// AI 可能生成这样的代码（SQL 注入！）
const query = `SELECT * FROM users WHERE name = '${name}'`;

// 正确的做法
const users = await db.query("SELECT * FROM users WHERE name = ?", [name]);
```

**Performance Tuning**: AI can provide theoretical suggestions, but real performance issues require Profiler analysis.

**Architecture Decisions**: Which solution to choose and how to organize code — AI's suggestions are references, not answers.

## Cursor Experience

```
Cursor 是 VSCode fork，内置了 AI 功能：

最有用的：
- Cmd+K：在光标处生成/修改代码（比 Copilot 更强）
- @file：在对话中引用当前文件
- Cmd+Shift+I：对整个代码库的对话

不适合的：
- 已有 VSCode 完整配置的项目（迁移成本）
- 需要特定 VSCode 扩展的工作流
```

还没有完全从 VSCode 切到 Cursor，但新项目会优先用。

## Reflections on 2024

AI 工具让我在"写代码"上省了 30-40% 的时间，但这个时间的大部分被转移到了：

- 更多的 Code Review
- 更仔细的架构设计
- 更多的测试
- 理解 AI 生成的代码（不能不理解就用）

整体输出质量有提升，但不是"省了时间就能摸鱼"，而是把时间用在了更有价值的事情上。

## Summary

- AI 工具 2024 年已经是必要的生产力工具
- 提示词质量决定输出质量：具体、有上下文、有约束条件
- AI 不能替代：业务判断、安全审查、架构决策、性能调优
- AI 生成的代码必须审查，保持批判性思维
- Cursor > GitHub Copilot（但迁移成本需要考虑）
