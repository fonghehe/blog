---
title: "Agentic Coding：AI Agent 驅動的編碼模式"
date: 2025-05-03 09:37:14
tags:
  - 工程化
readingTime: 2
description: "2025 年最大的變化之一是 Agentic Coding 的成熟。AI 不再隻是補全程式碼的工具，而是能自主完成複雜任務的 Agent。來分享一些實戰模式。"
wordCount: 175
---

2025 年最大的變化之一是 Agentic Coding 的成熟。AI 不再隻是補全程式碼的工具，而是能自主完成複雜任務的 Agent。來分享一些實戰模式。

## Agentic vs 傳統 AI 輔助

```
傳統 AI 輔助（2023-2024）：
  - Tab 補全：你寫一行，AI 補一行
  - Chat 對話：你問一個問題，AI 回答
  - 人類主導，AI 輔助

Agentic Coding（2025）：
  - AI Agent 能理解整個專案上下文
  - 能自主規劃多步任務
  - 能呼叫工具（終端、檔案系統、瀏覽器）
  - 人類定目標，AI 執行 + 人類稽核
```

## 模式一：Spec-Driven Development

```markdown
# 任務：實現使用者收藏功能

## 需求
使用者可以在產品詳情頁收藏產品，在個人中心檢視收藏列表。

## 資料模型
- Favorite 表：id, userId, productId, createdAt
- 關聯 Product 和 User 表

## API
- POST /api/favorites - 新增收藏
- DELETE /api/favorites/:id - 取消收藏
- GET /api/favorites - 獲取收藏列表

## 前端
- ProductDetail 頁面新增收藏按鈕
- Favorites 頁面展示收藏列表
- 使用 optimistic UI 更新

## 約束
- 每個使用者最多收藏 100 個產品
- 未登入時引導登入
```

```bash
# 在 Claude Code 中執行
claude "按照 SPEC.md 實現使用者收藏功能"
# Agent 會：
# 1. 建立資料庫 migration
# 2. 實現 API 路由
# 3. 建立前端元件
# 4. 編寫測試
# 5. 更新檔案
```

## 模式二：TDD with Agent

```bash
# 先寫測試，讓 Agent 實現功能

# 1. 人類寫測試用例
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

# 2. 讓 Agent 實現功能，直到所有測試通過
claude "實現 lib/search.ts，讓 tests/search.test.ts 中的所有測試通過"
```

## 模式三：Refactoring Agent

```bash
# 大規模重構任務

# 1. 把 class 元件遷移到函式元件
claude "將 src/components/ 下所有 class 元件遷移到函式元件 + hooks，
       保持 props 介面不變，保持功能不變"

# 2. 從 Redux 遷移到 Zustand
claude "將 src/store/ 從 Redux 遷移到 Zustand，
       保持所有 action 和 selector 的 API 不變"

# 3. CSS Modules 遷移到 Tailwind
claude "將 src/styles/ 下的 CSS Modules 遷移到 Tailwind CSS，
       直接寫在元件的 className 中"
```

## 模式四：Bug Fix Agent

```bash
# 復現 bug 後讓 Agent 修復

# 1. 提供錯誤資訊
claude "修復以下錯誤：
  TypeError: Cannot read properties of undefined (reading 'map')
  at ProductList (src/components/ProductList.tsx:15)

  復現步驟：
  1. 訪問 /products
  2. 網路請求失敗時頁面崩潰
  3. 預期：顯示空狀態，不是崩潰"

# Agent 會：
# 1. 定位到 ProductList.tsx:15
# 2. 發現 products 可能為 undefined
# 3. 新增 loading 和 error 狀態處理
# 4. 可能還會建議新增 error boundary
```

## 模式五：Migration Agent

```bash
# 依賴升級

# Next.js 14 → 15
claude "將專案從 Next.js 14 升級到 15，
       處理所有 breaking changes，
       執行測試確保功能不變"

# React 18 → 19
claude "將專案從 React 18 升級到 19，
       將 forwardRef 改為直接 ref prop，
       將 useFormState 改為 useActionState"

# Tailwind 3 → 4
claude "將專案從 Tailwind CSS 3 升級到 4，
       將 tailwind.config.js 遷移到 CSS @theme 塊"
```

## Agent 的邊界

```
Agent 擅長的：
  ✓ 有明確規範的重複性工作
  ✓ 程式碼遷移和重構
  ✓ 測試生成
  ✓ Bug 修復（有明確的錯誤資訊）
  ✓ 文件生成

Agent 不擅長的：
  ✗ 需要深入業務理解的決策
  ✗ 效能最佳化（需要分析實際資料）
  ✗ 架構設計（需要前瞻性思考）
  ✗ 安全敏感程式碼（認證、加密）
  ✗ 創造性的 UI/UX 設計
```

## 小結

- Agentic Coding 是 2025 年最重要的開發模式變化
- Spec-Driven Development 讓開發流程更結構化
- TDD + Agent 是高質量程式碼的保證
- Agent 擅長遷移、重構、測試生成，不擅長業務創新
- 人類的角色從 "寫程式碼" 轉變為 "定義需求 + 稽核程式碼"
