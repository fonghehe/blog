---
title: "Agentic Coding 2026 實踐"
date: 2026-01-12 10:00:00
tags:
  - 前端
readingTime: 3
description: "Agentic Coding 已經不是概念驗證了。2026 年，Claude Code、Cursor Agent、GitHub Copilot Workspace 都已經是成熟產品。但真正用好 Agentic Coding 的團隊不多，大多數還停留在\"用 Agent 寫單個函數\"的階段。"
wordCount: 429
---

Agentic Coding 已經不是概念驗證了。2026 年，Claude Code、Cursor Agent、GitHub Copilot Workspace 都已經是成熟產品。但真正用好 Agentic Coding 的團隊不多，大多數還停留在"用 Agent 寫單個函數"的階段。

## Agent 工作流的三層架構

我總結的 Agent 工作流分三層：任務規劃層、執行層、驗證層。三層缺一不可，只做執行層的 Agent 不會比 Copilot 強太多。

```typescript
// agent-workflow.ts —— 三層架構的實現
import { createAgent } from '@anthropic-ai/claude-code';

// 第一層：任務規劃 —— 把大目標拆成可執行的步驟
const planner = createAgent({
  role: 'planner',
  model: 'claude-4.7-opus',
  systemPrompt: `你是技術架構師。收到任務後：
  1. 分析涉及的文件和模塊
  2. 拆分成 3-8 個原子步驟
  3. 每個步驟標註依賴關係和預估複雜度
  4. 標出需要人工確認的決策點`,
});

// 第二層：代碼執行 —— 逐步驟實現
const executor = createAgent({
  role: 'executor',
  model: 'claude-4.7-sonnet',
  tools: ['read', 'write', 'edit', 'bash', 'test'],
  rules: [
    '每完成一個步驟立即運行相關測試',
    '測試失敗時自動修復，最多嘗試 3 次',
    '超過 3 次失敗則暫停，請求人工介入',
  ],
});

// 第三層：驗證審查 —— 檢查輸出質量
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

## 實戰：用 Agent 完成一個完整功能

以一個實際需求為例：給電商項目添加"商品對比"功能。這個功能涉及頁面、組件、狀態管理、路由、API 對接，典型的中等複雜度任務。

```typescript
// 給 Agent 的任務描述 —— 越具體越好
const taskDescription = `
需求：商品對比功能

功能細節：
- 用户在商品列表頁可以勾選 2-4 個商品加入對比
- 對比頁面展示選中商品的規格參數橫向對比表
- 對比狀態通過 URL search params 持久化
- 對比欄懸浮在底部，顯示已選商品縮略圖

技術約束：
- 使用已有的 Zustand store 模式
- UI 組件用 shadcn/ui
- 數據獲取用 TanStack Query
- 路由用 App Router 的 Parallel Routes
`;

// Agent 實際產出的文件清單
const generatedFiles = [
  'src/stores/compare-store.ts',          // Zustand store
  'src/app/(shop)/compare/page.tsx',      // 對比頁面
  'src/app/(shop)/compare/@specs/page.tsx', // Parallel Route: 規格對比
  'src/components/product/compare-bar.tsx', // 底部懸浮欄
  'src/components/product/compare-checkbox.tsx', // 商品勾選框
  'src/hooks/use-compare-params.ts',      // URL params 同步
  'src/api/compare.ts',                   // API 調用
  'src/stores/__tests__/compare-store.test.ts', // Store 測試
  'src/components/product/__tests__/compare-bar.test.tsx', // 組件測試
];

// 關鍵的 Store 實現
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

Agent 的最大瓶頸是上下文窗口。項目一大，Agent 就"看不完"代碼庫。實踐中我用分層上下文策略解決這個問題。

```typescript
// context-strategy.ts
const contextLayers = {
  // 第一層：項目骨架（始終加載）
  skeleton: {
    files: ['package.json', 'tsconfig.json', 'README.md'],
    purpose: '瞭解項目類型、依賴、構建配置',
    tokens: '~2K',
  },

  // 第二層：相關模塊（按需加載）
  relevant: {
    files: 'auto-detect',
    purpose: '和當前任務直接相關的文件',
    detection: 'import-chain + same-directory + test-files',
    tokens: '~30K',
  },

  // 第三層：模式參考（按需注入）
  patterns: {
    files: 'similar-implementations',
    purpose: '項目中已有的類似功能實現，作為參考模板',
    injection: '當 Agent 需要寫新功能時，注入最近完成的 2-3 個類似文件',
    tokens: '~15K',
  },

  // 第四層：規則和約定（system prompt 注入）
  conventions: {
    content: '團隊編碼規範、Git 提交規範、命名約定',
    tokens: '~3K',
  },
};
```

## Agent 失敗模式與應對

Agent 不是萬能的。最常見的失敗模式：陷入循環（反覆修改同一個文件）、產生幻覺（引用不存在的 API）、忽略上下文（忘記之前的決策）。應對策略是設置明確的 guardrail。

```typescript
// agent-guardrails.ts
const guardrails = {
  // 防止無限循環
  maxIterationsPerFile: 3,
  maxTotalIterations: 20,

  // 防止破壞性操作
  blockedCommands: [
    'rm -rf',
    'git push --force',
    'npm publish',
    'DROP TABLE',
  ],

  // 防止幻覺：驗證引用的 API 是否存在
  validateImports: true,
  validateFunctionCalls: true,

  // 檢查點：每完成一個步驟保存狀態
  checkpoints: {
    enabled: true,
    onFail: 'rollback-to-last-checkpoint',
  },

  // 超時控制
  timeout: {
    singleStep: 120_000,   // 單步驟 2 分鐘
    totalTask: 600_000,     // 總任務 10 分鐘
  },
};
```

## 小結

- Agentic Coding 的核心是三層架構：規劃、執行、驗證，不是讓 Agent 一步到位
- 任務描述越具體越好，給約束比給自由更能讓 Agent 產出好代碼
- 上下文管理是 Agent 的命門，分層注入比一次性全量加載高效
- 設置 guardrail 防止 Agent 陷入循環、產生幻覺、執行破壞性操作
- Agent 最適合的場景：中等複雜度、有明確約束、有現成模式可參考的編碼任務
