---
title: "AI 輔助架構決策工具"
date: 2026-01-08 16:42:19
tags:
  - 工程化
readingTime: 3
description: "技術選型和架構決策是高階工程師的核心工作，也是最難用 AI 替代的部分。但 AI 可以成為極強的決策輔助工具——幫你分析 trade-off、模擬不同方案的效能表現、甚至發現你遺漏的約束條件。"
wordCount: 427
---

技術選型和架構決策是高階工程師的核心工作，也是最難用 AI 替代的部分。但 AI 可以成為極強的決策輔助工具——幫你分析 trade-off、模擬不同方案的效能表現、甚至發現你遺漏的約束條件。

## 用 AI 做技術選型對比分析

選型不再是拍腦袋或看 GitHub star 數。現在的做法是讓 AI 基於你的專案約束做結構化分析，給出帶權重評分的推薦。

```typescript
// tech-selection.ts —— AI 輔助技術選型框架
interface SelectionCriteria {
  factor: string;
  weight: number; // 1-10
  description: string;
}

interface TechOption {
  name: string;
  scores: Record<string, number>; // factor -> score (1-10)
}

// 定義你的專案約束
const criteria: SelectionCriteria[] = [
  { factor: 'performance', weight: 9, description: '首屏載入 < 2s，互動響應 < 100ms' },
  { factor: 'dx', weight: 7, description: '開發體驗，型別安全，HMR 速度' },
  { factor: 'ecosystem', weight: 8, description: '社群活躍度、第三方庫質量' },
  { factor: 'team-familiarity', weight: 6, description: '團隊現有技術棧匹配度' },
  { factor: 'hiring', weight: 5, description: '人才市場供給' },
  { factor: 'ai-tooling', weight: 8, description: 'AI 工具支援程度' },
];

// AI 根據約束評估各方案
function calculateWeightedScore(option: TechOption, criteria: SelectionCriteria[]) {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  return criteria.reduce((score, c) => {
    return score + (option.scores[c.factor] * c.weight) / totalWeight;
  }, 0);
}
```

## 架構影響分析：拆分還是聚合？

"該不該拆微前端"、"該不該上 Monorepo"這類問題沒有標準答案。AI 的價值是幫你量化分析不同決策的長期影響。

```typescript
// architecture-analysis.ts
interface ModuleAnalysis {
  path: string;
  linesOfCode: number;
  changeFrequency: number;      // 每月平均變更次數
  dependencyCount: number;      // 被多少模組依賴
  couplingScore: number;        // 0-1，耦合度
  teamOwner: string;
}

// AI 分析程式碼庫後輸出的模組關係圖
const moduleGraph: ModuleAnalysis[] = [
  { path: 'src/features/auth', linesOfCode: 3200, changeFrequency: 4.2, dependencyCount: 23, couplingScore: 0.82, teamOwner: 'platform' },
  { path: 'src/features/checkout', linesOfCode: 8500, changeFrequency: 12.1, dependencyCount: 8, couplingScore: 0.35, teamOwner: 'commerce' },
  { path: 'src/features/catalog', linesOfCode: 6100, changeFrequency: 8.7, dependencyCount: 15, couplingScore: 0.61, teamOwner: 'catalog' },
  { path: 'src/shared/ui', linesOfCode: 4200, changeFrequency: 2.1, dependencyCount: 45, couplingScore: 0.12, teamOwner: 'platform' },
];

// AI 的拆分建議邏輯
function shouldExtractModule(mod: ModuleAnalysis): boolean {
  // 高變更頻率 + 低耦合 = 適合獨立
  // 高耦合 + 多依賴 = 拆分成本高，不建議
  const independenceScore = (1 - mod.couplingScore) * mod.changeFrequency;
  return independenceScore > 5;
}
```

## 效能預算決策支援

AI 可以基於你的使用者畫像和流量資料，幫你製定合理的效能預算，而不是拍一個"LCP < 2.5s"了事。

```typescript
// performance-budget-ai.ts
interface UserSegment {
  name: string;
  percentage: number;
  device: 'high-end' | 'mid-range' | 'low-end';
  network: '4g' | '3g' | 'slow-3g';
  region: string;
}

const userSegments: UserSegment[] = [
  { name: '一線城市iOS', percentage: 35, device: 'high-end', network: '4g', region: 'cn-east' },
  { name: '二線城市Android', percentage: 28, device: 'mid-range', network: '4g', region: 'cn-central' },
  { name: '下沉市場', percentage: 22, device: 'low-end', network: '3g', region: 'cn-west' },
  { name: '海外使用者', percentage: 15, device: 'mid-range', network: '4g', region: 'sea' },
];

// AI 基於使用者分群推薦的效能預算
interface PerformanceBudget {
  metric: string;
  p50: number;
  p75: number;
  p95: number;
  unit: string;
}

const aiRecommendedBudget: PerformanceBudget[] = [
  { metric: 'FCP', p50: 1200, p75: 1800, p95: 3200, unit: 'ms' },
  { metric: 'LCP', p50: 2000, p75: 2800, p95: 4500, unit: 'ms' },
  { metric: 'INP', p50: 80, p75: 150, p95: 350, unit: 'ms' },
  { metric: 'CLS', p50: 0.02, p75: 0.08, p95: 0.18, unit: 'score' },
  { metric: 'JS Bundle', p50: 180, p75: 250, p95: 400, unit: 'KB' },
  // 注意：下沉市場佔 22%，所以 p95 預算比一般建議更保守
];
```

## 避免 AI 決策的常見陷阱

AI 最大的問題是"看起來很有道理但其實是錯的"。它會編造不存在的 benchmark 資料、忽略你的具體業務場景、甚至推薦已經停止維護的庫。永遠交叉驗證 AI 的輸出。

```typescript
// 決策驗證檢查清單
const decisionValidation = {
  // AI 推薦的庫/框架，必須驗證以下幾點
  checks: [
    {
      name: '活躍度驗證',
      action: 'npm info <package> --json | jq ".time.modified"',
      threshold: '最近 6 個月內有更新',
    },
    {
      name: '安全審計',
      action: 'npm audit && snyk test <package>',
      threshold: '無 critical/high 漏洞',
    },
    {
      name: '相容性驗證',
      action: '在目標 Node/瀏覽器版本上執行測試',
      threshold: 'CI 全綠',
    },
    {
      name: '團隊反饋',
      action: '技術評審會上討論，收集意見',
      threshold: '核心成員無強烈反對',
    },
  ],
};
```

## 小結

- AI 是決策的加速器和放大器，不是決策者本身
- 結構化的約束定義是 AI 給出好建議的前提條件
- 量化分析（加權評分、耦合度計算）比模糊的"AI 推薦"更可靠
- 效能預算應該基於實際使用者分群資料，而不是行業平均值
- 永遠交叉驗證 AI 的輸出，尤其是 benchmark 資料和庫推薦
