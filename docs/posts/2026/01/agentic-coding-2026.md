---
title: "Agentic Coding 2026 实践"
date: 2026-01-12 10:00:00
tags:
  - 前端
readingTime: 3
description: "Agentic Coding 已经不是概念验证了。2026 年，Claude Code、Cursor Agent、GitHub Copilot Workspace 都已经是成熟产品。但真正用好 Agentic Coding 的团队不多，大多数还停留在\"用 Agent 写单个函数\"的阶段。"
wordCount: 429
---

Agentic Coding 已经不是概念验证了。2026 年，Claude Code、Cursor Agent、GitHub Copilot Workspace 都已经是成熟产品。但真正用好 Agentic Coding 的团队不多，大多数还停留在"用 Agent 写单个函数"的阶段。

## Agent 工作流的三层架构

我总结的 Agent 工作流分三层：任务规划层、执行层、验证层。三层缺一不可，只做执行层的 Agent 不会比 Copilot 强太多。

```typescript
// agent-workflow.ts —— 三层架构的实现
import { createAgent } from '@anthropic-ai/claude-code';

// 第一层：任务规划 —— 把大目标拆成可执行的步骤
const planner = createAgent({
  role: 'planner',
  model: 'claude-4.7-opus',
  systemPrompt: `你是技术架构师。收到任务后：
  1. 分析涉及的文件和模块
  2. 拆分成 3-8 个原子步骤
  3. 每个步骤标注依赖关系和预估复杂度
  4. 标出需要人工确认的决策点`,
});

// 第二层：代码执行 —— 逐步骤实现
const executor = createAgent({
  role: 'executor',
  model: 'claude-4.7-sonnet',
  tools: ['read', 'write', 'edit', 'bash', 'test'],
  rules: [
    '每完成一个步骤立即运行相关测试',
    '测试失败时自动修复，最多尝试 3 次',
    '超过 3 次失败则暂停，请求人工介入',
  ],
});

// 第三层：验证审查 —— 检查输出质量
const reviewer = createAgent({
  role: 'reviewer',
  model: 'claude-4.7-sonnet',
  checks: [
    'type-safety',
    'test-coverage',
    'no-console-logs',
    'no-unused-imports',
    'consistent-with-existing-patterns',
  ],
});
```

## 实战：用 Agent 完成一个完整功能

以一个实际需求为例：给电商项目添加"商品对比"功能。这个功能涉及页面、组件、状态管理、路由、API 对接，典型的中等复杂度任务。

```typescript
// 给 Agent 的任务描述 —— 越具体越好
const taskDescription = `
需求：商品对比功能

功能细节：
- 用户在商品列表页可以勾选 2-4 个商品加入对比
- 对比页面展示选中商品的规格参数横向对比表
- 对比状态通过 URL search params 持久化
- 对比栏悬浮在底部，显示已选商品缩略图

技术约束：
- 使用已有的 Zustand store 模式
- UI 组件用 shadcn/ui
- 数据获取用 TanStack Query
- 路由用 App Router 的 Parallel Routes
`;

// Agent 实际产出的文件清单
const generatedFiles = [
  'src/stores/compare-store.ts',          // Zustand store
  'src/app/(shop)/compare/page.tsx',      // 对比页面
  'src/app/(shop)/compare/@specs/page.tsx', // Parallel Route: 规格对比
  'src/components/product/compare-bar.tsx', // 底部悬浮栏
  'src/components/product/compare-checkbox.tsx', // 商品勾选框
  'src/hooks/use-compare-params.ts',      // URL params 同步
  'src/api/compare.ts',                   // API 调用
  'src/stores/__tests__/compare-store.test.ts', // Store 测试
  'src/components/product/__tests__/compare-bar.test.tsx', // 组件测试
];

// 关键的 Store 实现
// src/stores/compare-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompareState {
  selectedIds: string[];
  maxItems: number;
  addProduct: (id: string) => void;
  removeProduct: (id: string) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      maxItems: 4,

      addProduct: (id) => {
        const { selectedIds, maxItems } = get();
        if (selectedIds.length >= maxItems || selectedIds.includes(id)) return;
        set({ selectedIds: [...selectedIds, id] });
      },

      removeProduct: (id) => {
        set({ selectedIds: get().selectedIds.filter((i) => i !== id) });
      },

      clearAll: () => set({ selectedIds: [] }),

      isSelected: (id) => get().selectedIds.includes(id),
    }),
    { name: 'product-compare' }
  )
);
```

## Agent 的上下文管理策略

Agent 的最大瓶颈是上下文窗口。项目一大，Agent 就"看不完"代码库。实践中我用分层上下文策略解决这个问题。

```typescript
// context-strategy.ts
const contextLayers = {
  // 第一层：项目骨架（始终加载）
  skeleton: {
    files: ['package.json', 'tsconfig.json', 'README.md'],
    purpose: '了解项目类型、依赖、构建配置',
    tokens: '~2K',
  },

  // 第二层：相关模块（按需加载）
  relevant: {
    files: 'auto-detect',
    purpose: '和当前任务直接相关的文件',
    detection: 'import-chain + same-directory + test-files',
    tokens: '~30K',
  },

  // 第三层：模式参考（按需注入）
  patterns: {
    files: 'similar-implementations',
    purpose: '项目中已有的类似功能实现，作为参考模板',
    injection: '当 Agent 需要写新功能时，注入最近完成的 2-3 个类似文件',
    tokens: '~15K',
  },

  // 第四层：规则和约定（system prompt 注入）
  conventions: {
    content: '团队编码规范、Git 提交规范、命名约定',
    tokens: '~3K',
  },
};
```

## Agent 失败模式与应对

Agent 不是万能的。最常见的失败模式：陷入循环（反复修改同一个文件）、产生幻觉（引用不存在的 API）、忽略上下文（忘记之前的决策）。应对策略是设置明确的 guardrail。

```typescript
// agent-guardrails.ts
const guardrails = {
  // 防止无限循环
  maxIterationsPerFile: 3,
  maxTotalIterations: 20,

  // 防止破坏性操作
  blockedCommands: [
    'rm -rf',
    'git push --force',
    'npm publish',
    'DROP TABLE',
  ],

  // 防止幻觉：验证引用的 API 是否存在
  validateImports: true,
  validateFunctionCalls: true,

  // 检查点：每完成一个步骤保存状态
  checkpoints: {
    enabled: true,
    onFail: 'rollback-to-last-checkpoint',
  },

  // 超时控制
  timeout: {
    singleStep: 120_000,   // 单步骤 2 分钟
    totalTask: 600_000,     // 总任务 10 分钟
  },
};
```

## 小结

- Agentic Coding 的核心是三层架构：规划、执行、验证，不是让 Agent 一步到位
- 任务描述越具体越好，给约束比给自由更能让 Agent 产出好代码
- 上下文管理是 Agent 的命门，分层注入比一次性全量加载高效
- 设置 guardrail 防止 Agent 陷入循环、产生幻觉、执行破坏性操作
- Agent 最适合的场景：中等复杂度、有明确约束、有现成模式可参考的编码任务
