---
title: "AI Coding Workflow Upgrade: From Copilot to Cursor"
date: 2023-11-08 15:28:08
tags:
  - Frontend
readingTime: 2
description: "In the first half of the year I wrote a six-month Copilot report. The second half brought even bigger changes — Cursor emerged, and AI coding evolved from a \"co"
wordCount: 373
---

In the first half of the year I wrote a six-month Copilot report. The second half brought even bigger changes — Cursor emerged, and AI coding evolved from a "completion tool" to a "coding partner".

## Copilot vs Cursor

Copilot is a code completion tool; Cursor is an AI-native editor. Their positioning is fundamentally different:

```
Copilot:  在你写代码时给你建议，你来决定接不接受
Cursor:   整个编辑器围绕 AI 设计，你描述意图，AI 来改代码
```

## Cursor's Core Features

### Cmd+K：自然语言编辑

Select a code block, press Cmd+K, and enter an instruction:

```
把这段逻辑提取成一个 custom hook，
返回 { data, loading, error, refetch }
```

Cursor directly modifies the code, not just gives suggestions. And it can see the project context, so the generated code will reference existing types and utility functions from the project.

### Cmd+L：对话模式

Similar to ChatGPT, but with awareness of the entire project:

```
Q: 这个组件的性能问题在哪？
A: PostList 组件每次渲染都创建新的 filter 函数，
   建议用 useMemo 包裹。另外 db.post.findMany
   缺少分页参数，大数据量时会全量加载。

   [Generate fix]
```

Click "Generate fix" to directly apply the changes.

### Codebase 索引

Cursor indexes the entire project codebase. Ask it "how does this project handle errors?" and it can search and summarize the global error-handling patterns.

## Real-World Experience

### Suitable Use Cases

**Refactoring Code (Most Efficient)**

```
选中 200 行旧组件 → Cmd+K
"重构成函数组件，用 TypeScript，添加类型定义"

10 秒后得到重构后的代码，类型定义完整。
手动调整几个细节就完成了。
```

**Generating Repetitive Code**

```
"根据 UserSchema 生成对应的 API CRUD handler"
"根据这个 mock 数据生成对应的测试用例"
```

**Understanding Unfamiliar Code**

```
选中一段没看过的库代码 → Cmd+L
"这段代码在做什么？为什么这样写？"
```

### 不适合的场景

**Complex Business Logic**

AI doesn't understand business context; the generated logic may look reasonable but can have subtle issues.

**Architecture Decisions**

Questions like "should this project use a monorepo or polyrepo" are ones AI can't answer well.

**Code Requiring Precise Control**

For example, security-related code and performance-critical paths — AI-generated code requires more thorough review.

## Using Together with Copilot

My actual workflow:

```
1. Copilot 负责日常代码补全（Tab 键接受）
2. Cursor Cmd+K 做有方向的代码修改
3. Cursor Cmd+L 做代码理解、调试辅助
4. 重要代码仍然手动审查每一行
```

The two don't conflict; Copilot completion + Cursor deep editing is the current optimal combination.

## Team Recommendations

- Don't ban AI tools; guide teams toward correct usage
- Teaching teams to "review generated code" is more important than teaching them to "use AI"
- Don't input sensitive code (keys, core algorithms) into AI tools
- Evaluate AI tool ROI: 30-50% coding speed improvement is real, but there are learning and adaptation costs
- Keep an eye on the Cursor/Copilot competitive landscape; this field is changing very rapidly

## Summary

- Cursor elevates AI from "code completion" to "coding partner" level
- Cmd+K natural language editing and Cmd+L project-aware conversation are core features
- Refactoring, generating repetitive code, and understanding unfamiliar code are the best use cases
- Complex business logic and architecture decisions still require human judgment
- Combining Copilot + Cursor is the current optimal workflow