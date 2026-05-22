---
title: "LLM 驅動的 UI 自動生成"
date: 2026-01-06 15:40:17
tags:
  - 工程化
readingTime: 3
description: "從 Figma 設計稿到可用程式碼，這一步曾經是前端最耗時的環節之一。2026 年，LLM 驅動的 UI 生成工具已經成熟到可以理解設計意圖、元件層級、甚至互動狀態。但\"能用\"和\"能上生產\"之間仍然有巨大的鴻溝。"
wordCount: 493
---

從 Figma 設計稿到可用程式碼，這一步曾經是前端最耗時的環節之一。2026 年，LLM 驅動的 UI 生成工具已經成熟到可以理解設計意圖、元件層級、甚至互動狀態。但"能用"和"能上生產"之間仍然有巨大的鴻溝。

## 設計稿到程式碼：當前工具鏈對比

市面上主流的三套方案各有優劣。v0.dev 適合快速原型，Claude Artifacts 適合複雜互動元件，GitHub Copilot Workspace 適合和現有專案整合。

```tsx
// 場景：從自然語言描述生成一個完整的 Dashboard 佈局
// 輸入："建立一個 SaaS 資料看板，左側導航欄，頂部搜尋+通知，
//       主區域包含 4 個數據卡片、一個折線圖、一個數據表格"

// v0.dev 生成的程式碼（精簡版）
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  metrics: Array<{ label: string; value: string; change: number }>;
  chartData: Array<{ date: string; revenue: number; users: number }>;
}

export function DashboardLayout({ metrics, chartData }: DashboardProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{m.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{m.value}</div>
            <span className={m.change >= 0 ? 'text-green-500' : 'text-red-500'}>
              {m.change >= 0 ? '+' : ''}{m.change}%
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## 元件庫感知的生成策略

裸生成 HTML 沒意義。高階的做法是讓 LLM 理解你的元件庫 API，生成直接使用現有元件的程式碼。關鍵是餵給模型你的元件文件和用法示例。

```typescript
// llm-ui-config.ts —— 元件庫感知配置
export const componentAwareConfig = {
  // 將元件庫的 props 定義作為 context 注入
  componentDocs: {
    source: './src/components/ui',
    format: 'extracted-props',
    // 提取每個元件的 props 型別、slot、variant
    extractors: ['typescript-docs', 'storybook-meta'],
  },

  // 生成時的約束
  constraints: {
    // 只使用已有的元件，不要生成原生 HTML
    allowedElements: ['from-component-library'],
    // 樣式方案限制
    styling: 'tailwind-only',
    // 互動狀態必須覆蓋
    requiredStates: ['loading', 'error', 'empty', 'success'],
  },

  // 生成後驗證
  postValidation: [
    'typescript-check',
    'visual-regression-compare',  // 和設計稿做畫素級對比
    'accessibility-audit',
  ],
};

// 實際呼叫示例
async function generateUI(prompt: string) {
  const components = await loadComponentDocs(componentAwareConfig.componentDocs);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'content-type': 'application/json',
      'anthropic-version': '2024-10-22',
    },
    body: JSON.stringify({
      model: 'claude-4.7-sonnet',
      max_tokens: 8192,
      system: `你是一個前端工程師。使用以下元件庫生成程式碼：\n${components}`,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  return response.json();
}
```

## 生成後的質量保障流水線

AI 生成的 UI 程式碼最多只完成了 60% 的工作。剩下的 40% 是響應式適配、無障礙訪問、邊緣情況處理、以及和業務邏輯的整合。自動化流水線能幫你快速定位問題。

```typescript
// ui-quality-pipeline.ts
import { chromium } from 'playwright';
import { compareSnapshots } from '@visual-regression/core';
import { runA11yAudit } from '@axe-core/playwright';

async function validateGeneratedUI(componentPath: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. TypeScript 編譯檢查
  const tsErrors = await runTypeCheck(componentPath);
  if (tsErrors.length > 0) {
    console.error('型別錯誤:', tsErrors);
    return { passed: false, errors: tsErrors };
  }

  // 2. 多視口截圖對比
  const viewports = [
    { width: 375, height: 812, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1440, height: 900, name: 'desktop' },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto(`http://localhost:3000/preview/${componentPath}`);
    const screenshot = await page.screenshot();
    const diff = await compareSnapshots(screenshot, `designs/${componentPath}/${vp.name}.png`);
    if (diff.percentage > 0.5) {
      console.warn(`${vp.name} 視覺差異 ${diff.percentage}%`);
    }
  }

  // 3. 無障礙審計
  const a11yResults = await runA11yAudit(page);
  if (a11yResults.violations.length > 0) {
    console.error('無障礙問題:', a11yResults.violations);
  }

  await browser.close();
}
```

## 給 Agent 補充互動邏輯

靜態 UI 生成是容易的部分。真正的挑戰是讓 AI 理解業務邏輯，生成正確的表單驗證、狀態管理、資料流。我的做法是先用 AI 生成 UI 骨架，再用第二輪 Agent 注入互動邏輯。

```tsx
// 第二輪 Agent 輸入：
// "為上面的 Dashboard 新增：點選卡片展開詳情抽屜，
//   使用 URL search params 同步選中狀態，
//   抽屜內用 TanStack Table 展示明細資料"

// Agent 生成的互動層
import { useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';

export function useDashboardInteraction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selectedMetric = searchParams.get('metric');

  const selectMetric = useCallback((metricId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('metric', metricId);
      return next;
    });
    setDrawerOpen(true);
  }, [setSearchParams]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('metric');
      return next;
    });
  }, [setSearchParams]);

  return { selectedMetric, drawerOpen, selectMetric, closeDrawer };
}
```

## 小結

- LLM UI 生成已經從"玩具"變成生產力工具，但"生成"只是第一步
- 元件庫感知的生成策略能大幅減少返工，關鍵是有結構化的元件文件
- 生成後必須經過型別檢查、視覺迴歸、無障礙審計三道關卡
- 互動邏輯建議用第二輪 Agent 注入，分層生成比一次性生成更可靠
- 2026 年最好的工作流：AI 出初稿，人做精修和業務邏輯整合
