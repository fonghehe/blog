---
title: "提示工程 2026 前端最佳實踐"
date: 2026-01-21 10:00:00
tags:
  - 前端
readingTime: 3
description: "Prompt Engineering 在 2026 年仍然是前端工程師需要掌握的核心技能。雖然模型越來越強，但\"會提問\"和\"不會提問\"之間的差距反而更大了。好的 prompt 能讓 AI 一次產出可用代碼，差的 prompt 讓你在對話中浪費半小時。"
wordCount: 412
---

Prompt Engineering 在 2026 年仍然是前端工程師需要掌握的核心技能。雖然模型越來越強，但"會提問"和"不會提問"之間的差距反而更大了。好的 prompt 能讓 AI 一次產出可用代碼，差的 prompt 讓你在對話中浪費半小時。

## 前端 Prompt 的黃金結構

經過大量實踐，我總結出前端場景下最有效的 prompt 結構：角色設定 + 約束條件 + 輸入輸出格式 + 反例排除。

```typescript
// prompt-templates.ts —— 我們團隊的 prompt 模板庫
export const promptTemplates = {
  // 組件開發 prompt
  component: (spec: ComponentSpec) => `
你是一個資深 React 前端工程師，嚴格遵循以下規範：

技術棧：React 20 + TypeScript 7 + Tailwind CSS v4
組件模式：Server Component 優先，需要客户端交互時使用 'use client'
狀態管理：本地狀態用 useState/useReducer，全局狀態用 Zustand
錯誤處理：所有異步操作必須有 error boundary 兜底

要求：
- 組件名：${spec.name}
- 功能：${spec.description}
- Props 接口：${JSON.stringify(spec.props, null, 2)}
- 必須覆蓋的狀態：loading, error, empty, success
- 必須支持的無障礙：keyboard navigation, ARIA labels, focus management

不要做的事情：
- 不要使用 any 類型
- 不要使用 useEffect 做可以同步計算的派生狀態
- 不要內聯 style，使用 Tailwind 類名
- 不要使用 default export，使用 named export
  `,

  // 性能優化 prompt
  performance: (component: string) => `
分析以下組件的性能問題並給出優化方案。

分析維度：
1. 渲染性能：不必要的重渲染、缺失的 memoization
2. 包體積：可替代的重型依賴、未使用的導入
3. 運行時效率：循環中的對象創建、閉包陷阱
4. 網絡性能：瀑布式請求、缺失的預加載

輸出格式：
- 每個問題標註嚴重程度（critical/high/medium/low）
- 給出優化前後的代碼對比
- 預估優化效果（減少的渲染次數、減少的 bundle size）

${component}
  `,
};
```

## 上下文注入：讓 AI 理解你的項目

通用 prompt 只能產出通用代碼。讓 AI 理解你的項目上下文是產出可用代碼的關鍵。我的做法是維護一個 project-context.md 文件，每次對話時注入。

```markdown
<!-- project-context.md —— 注入到每次 AI 對話的項目上下文 -->

## 項目信息
- 框架：Next.js 15.1, React 20.2, TypeScript 7.0
- 樣式：Tailwind CSS v4.1 + shadcn/ui
- 狀態管理：Zustand 5.x + TanStack Query v5
- 測試：Vitest 3.x + Testing Library + Playwright
- 包管理：Bun 3.2
- 部署：Vercel (Edge Runtime)

## 編碼約定
- 組件用 PascalCase，文件用 kebab-case
- Hook 以 use 開頭，放在 hooks/ 目錄
- API 調用統一封裝在 api/ 目錄，使用自定義 fetch wrapper
- 類型定義優先放在 types/ 目錄，組件內類型不超過 3 行
- 禁止使用 any，禁止 @ts-ignore，必要時用 @ts-expect-error

## 目錄結構
src/
  app/          # App Router 頁面
  components/   # 共享組件
    ui/         # 基礎 UI 組件（shadcn）
    features/   # 業務組件
  hooks/        # 自定義 Hooks
  stores/       # Zustand stores
  api/          # API 調用層
  types/        # 共享類型
  utils/        # 工具函數
```

```typescript
// context-loader.ts —— 自動注入項目上下文的工具
import { readFileSync } from 'fs';
import { glob } from 'glob';

export async function buildProjectContext(): Promise<string> {
  // 加載基礎上下文
  const baseContext = readFileSync('project-context.md', 'utf-8');

  // 自動掃描最近修改的文件，瞭解當前開發方向
  const recentFiles = await glob('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.*', '**/node_modules/**'],
  });

  // 加載 package.json 獲取依賴信息
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

  return `
${baseContext}

## 當前依賴版本
${Object.entries(pkg.dependencies ?? {})
  .map(([name, version]) => `- ${name}: ${version}`)
  .join('\n')}
  `;
}
```

## Chain-of-Thought：複雜任務的拆分策略

複雜功能不應該一次性讓 AI 生成。用 Chain-of-Thought 策略，引導 AI 分步思考。

```typescript
// 複雜任務的 prompt 鏈
const cotSteps = [
  {
    step: 1,
    prompt: `
先不寫代碼，分析這個功能需要哪些數據結構和接口。
列出所有 TypeScript 類型定義。
    `,
    output: 'types/',
  },
  {
    step: 2,
    prompt: `
基於上面的類型定義，實現數據獲取層。
包括 API 調用函數和 TanStack Query hooks。
    `,
    output: 'api/ + hooks/',
  },
  {
    step: 3,
    prompt: `
基於上面的 hooks，實現 UI 組件。
從最底層的原子組件開始，逐步構建到頁面級組件。
    `,
    output: 'components/',
  },
  {
    step: 4,
    prompt: `
為上面的 hooks 和組件編寫測試。
優先覆蓋核心業務邏輯和邊界情況。
    `,
    output: '__tests__/',
  },
];

// 實際示例：實現一個搜索功能
async function buildSearchFeature() {
  // Step 1: 類型定義
  await askAI(cotSteps[0].prompt + `
搜索功能需求：
- 全文搜索：支持商品名、描述、標籤
- 篩選器：價格區間、分類、評分、庫存狀態
- 排序：相關性、價格升降序、銷量、上新時間
- 分頁：游標分頁（cursor-based），每頁 20 條
  `);

  // Step 2-4 依次執行...
}
```

## Few-Shot 示例：最被低估的 Prompt 技巧

Few-shot 是指在 prompt 中提供 1-2 個示例，告訴 AI 你期望的輸出格式和質量。這是提升 AI 輸出質量最直接的方法。

```typescript
// few-shot-prompt.ts
const fewShotExample = `
參考以下示例的代碼風格和質量標準：

// 示例：useDebounce hook 的實現
import { useEffect, useState, useRef } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 注意示例中的要點：
// 1. 泛型參數保證類型安全
// 2. useEffect 中正確清理 timer
// 3. 依賴數組精確，不多不少
// 4. 命名清晰，不需要註釋就能理解
// 5. 函數簽名簡潔，無多餘參數

現在，按照同樣的代碼風格實現 useThrottle hook。
`;
```

## 小結

- 好的前端 prompt = 角色 + 約束 + 格式 + 反例，缺一不可
- 項目上下文注入是讓 AI 產出可用代碼的前提條件
- 複雜任務用 Chain-of-Thought 分步引導，不要指望一次出結果
- Few-shot 示例是提升輸出質量最直接的技巧，值得花時間維護示例庫
- Prompt 模板應該和代碼一樣納入版本管理，團隊共享和迭代
