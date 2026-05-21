---
title: "團隊擴展中的 AI 策略"
date: 2025-08-25 10:00:00
tags:
  - 工程化
readingTime: 2
description: "團隊從 5 人擴展到 20 人，AI 工具在知識傳遞、代碼一致性、新人 onboarding 方面起了很大作用。來分享實際策略。"
wordCount: 175
---

團隊從 5 人擴展到 20 人，AI 工具在知識傳遞、代碼一致性、新人 onboarding 方面起了很大作用。來分享實際策略。

## 團隊擴展的挑戰

```
5 人團隊：溝通成本低，代碼風格靠默契
15 人團隊：需要規範，但規範執行靠人工
20 人團隊：靠 AI 做強制執行 + 知識庫

AI 解決的問題：
  1. 代碼風格不一致 → AI review 強制執行
  2. 新人上手慢 → AI 輔助 onboarding
  3. 知識分散 → AI 知識庫
  4. 重複造輪子 → AI 推薦已有方案
```

## 策略一：團隊 Prompt 庫

```yaml
# prompts/component-creation.yaml
name: 創建新組件
description: 按團隊規範創建新的 React 組件
template: |
  創建組件 {{componentName}}，要求：
  1. 使用 TypeScript，嚴格模式
  2. 使用 cva 管理 variant
  3. 使用 forwardRef
  4. 配套 Storybook stories
  5. 配套單元測試（vitest + testing-library）
  6. 放在 src/components/{{componentName}} 目錄
  7. 遵循團隊 naming convention：PascalCase 組件，camelCase props
  8. 導出類型定義
variables:
  - name: componentName
    description: 組件名稱
    required: true

# prompts/api-integration.yaml
name: API 集成
description: 按團隊規範創建 API 集成代碼
template: |
  在 {{feature}} 模塊中集成 {{apiEndpoint}} API：
  1. 使用 @tanstack/react-query 管理請求
  2. 創建 src/api/{{feature}}.ts 定義請求函數
  3. 創建 src/hooks/use{{Feature}}.ts 封裝 hook
  4. 添加 loading/error 狀態處理
  5. 使用 zod 驗證響應類型
  6. 添加樂觀更新（如適用）
```

## 策略二：AI 新人 Onboarding

```tsx
// 新人第一天的 AI 工作流

// 1. AI 生成項目概覽
const onboardingGuide = await generateOnboardingGuide({
  projectName: "frontend-app",
  role: "frontend-engineer",
  techStack: ["react", "typescript", "tailwind", "next.js"],
});

// 2. AI 基於代碼庫回答新人問題
// 新人在 Claude Code 中提問：
// "這個項目的認證流程是怎麼實現的？"
// "useAuth hook 在哪些地方被使用？"
// "如何添加一個新的 API 端點？"

// 3. AI 分配的練習任務
const practiceTasks = [
  {
    title: "修復一個 Good First Issue",
    description: "選擇一個標記為 good-first-issue 的 ticket",
    aiSupport: "Claude Code 會幫助你理解相關代碼",
  },
  {
    title: "添加一個簡單的組件",
    description: "使用 AI prompt 庫創建一個 Button 組件",
    aiSupport: "AI 會按團隊規範生成初始代碼",
  },
  {
    title: "寫一個單元測試",
    description: "為現有組件補充測試用例",
    aiSupport: "AI 會分析代碼生成測試框架",
  },
];
```

## 策略三：代碼一致性保障

```json
// .claude/settings.json
{
  "rules": [
    {
      "pattern": "src/components/**/*.tsx",
      "rules": [
        "必須使用 TypeScript",
        "必須使用 forwardRef",
        "必須導出 Props 類型",
        "使用 cn() 合併 className",
        "禁止使用 inline style"
      ]
    },
    {
      "pattern": "src/api/**/*.ts",
      "rules": [
        "必須使用 zod 驗證響應",
        "必須定義返回類型",
        "使用 react-query 管理緩存",
        "錯誤處理必須返回 Result 類型"
      ]
    }
  ]
}
```

## 策略四：AI 知識庫

```ts
// scripts/knowledge-base.ts
// 將團隊的技術決策和最佳實踐存入 AI 可檢索的知識庫

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  lastUpdated: string;
  author: string;
}

const knowledgeBase: KnowledgeEntry[] = [
  {
    id: "state-management",
    title: "狀態管理選型",
    content: `我們使用：
      - 服務端狀態：@tanstack/react-query
      - 全局 UI 狀態：Zustand
      - 表單狀態：React Hook Form
      - URL 狀態：nuqs
    不使用 Redux（過度設計）和 Context（性能問題）`,
    tags: ["architecture", "state-management"],
    lastUpdated: "2025-06-01",
    author: "tech-lead",
  },
  {
    id: "error-handling",
    title: "錯誤處理規範",
    content: `所有 API 調用必須：
      1. 使用 try-catch 包裹
      2. 返回 Result<T, E> 類型
      3. 上報到 Sentry
      4. 展示用户友好的錯誤信息
    禁止：靜默吞掉錯誤`,
    tags: ["error-handling", "best-practices"],
    lastUpdated: "2025-05-15",
    author: "tech-lead",
  },
];
```

## 團隊數據

```
引入 AI 後的團隊效率變化（6 個月跟蹤）：

新人上手時間：從 3 周降到 1.5 周
代碼審查時間：減少 40%
代碼風格不一致問題：減少 75%
重複造輪子事件：減少 60%
技術債務累積速度：降低 30%
```

## 小結

- 團隊擴展時，AI 不是錦上添花，是必需品
- 建立團隊 Prompt 庫，確保 AI 輸出符合團隊規範
- AI 輔助 onboarding 可以顯著縮短新人上手時間
- 代碼一致性靠 AI review 強制執行，不靠人盯
- 知識庫的建設需要持續投入，但回報很高
