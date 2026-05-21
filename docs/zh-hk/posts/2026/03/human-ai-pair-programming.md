---
title: "人機結對編程的三個階段：從補全到協作"
date: 2026-03-05 10:00:00
tags:
  - 前端
readingTime: 3
description: "去年底我做了一個實驗：連續兩週，所有新功能都用\"人機結對\"的方式開發。不是 Copilot 式的代碼補全，而是真正的協作模式。效果超出預期，但過程中的心態轉變才是最大的收穫。"
wordCount: 634
---

去年底我做了一個實驗：連續兩週，所有新功能都用"人機結對"的方式開發。不是 Copilot 式的代碼補全，而是真正的協作模式。效果超出預期，但過程中的心態轉變才是最大的收穫。

## 階段一：AI 是"高級自動補全"（2023-2024）

這個階段大家都經歷過。AI 是 Tab 鍵的增強版：

```typescript
// 你寫：
function calculateTotal(items: CartItem[])

// AI 補全：
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

**這個階段的特徵：**
- 人類寫骨架，AI 填充血肉
- AI 的輸出範圍很小（一行到一個函數）
- 人類對每一行代碼都有完全的掌控感
- 信任度：低。每行都要審

這個模式的瓶頸很明顯：**AI 不理解業務上下文**。它只能根據當前文件和附近文件做預測。

## 階段二：AI 是"實習生"（2025）

到了 2025 年，上下文窗口擴大 + MCP 協議普及，AI 開始能理解整個項目。但人類的心態還是"監工"：

```typescript
// 人：寫一個用户註冊表單組件
// 要求：郵箱、密碼、確認密碼
// 密碼需要強度校驗，弱密碼要實時提示
// 提交時調用 POST /api/auth/register

// AI 生成完整組件
// 人類 review，改幾個細節，合併
```

**這個階段的特徵：**
- 人類寫需求，AI 寫實現
- 人類花大量時間做 code review
- 信任度：中。大方向信任，細節不放心
- 瓶頸：**review 的時間可能比自己寫還長**

我在這個階段最大的感悟：如果你花 30 分鐘 review AI 生成的代碼，不如花 5 分鐘寫清楚需求。**投入產出比在需求端，不在審查端。**

## 階段三：AI 是"結對夥伴"（2026）

這是我目前在用的模式。核心轉變是：**人類和 AI 各自發揮優勢，而不是上下游關係。**

```markdown
## 我的結對工作流

### 人類負責（架構 + 決策）：
1. 定義組件的接口邊界（Props 類型、事件契約）
2. 決定狀態管理方案（放在哪、怎麼流）
3. 定義關鍵路徑的測試用例
4. 處理跨模塊的架構決策

### AI 負責（實現 + 驗證）：
1. 根據接口契約生成組件實現
2. 編寫所有測試用例
3. 生成 Storybook stories
4. 檢查邊界情況和可訪問性
```

實際操作中，我用這種方式：

```typescript
// 第一步：人類定義接口（這是最關鍵的一步）
// file: src/features/auth/components/RegisterForm.types.ts

export interface RegisterFormProps {
  onSuccess: (user: User) => void;
  onError: (error: AuthError) => void;
  initialEmail?: string;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: '極弱' | '弱' | '一般' | '強' | '極強';
  suggestions: string[];
}

// 然後對 AI 説：
// "根據上面的類型定義，生成 RegisterForm 組件
//  要求：使用 react-hook-form + zod
//  密碼強度用 PasswordStrength 類型
//  UI 用我們的 @company/ui 組件庫"
```

AI 生成實現後，我不逐行 review，而是**只檢查接口是否對齊**：

```typescript
// 我的 review checklist（只檢查這些）：
// □ Props 接口是否完全匹配定義
// □ 回調函數的參數類型是否正確
// □ 狀態管理是否在組件內部（沒有意外提升）
// □ 錯誤處理是否覆蓋了所有 AuthError 類型
```

## 關鍵技巧：給 AI 寫"設計文檔"而不是"需求描述"

我發現一個反直覺的事實：**給 AI 寫的技術設計文檔，比我給自己團隊寫的還要重要。**

```markdown
## 傳統寫法（給 AI 的 prompt）：
"幫我寫一個訂單列表頁面，支持分頁、篩選、排序"

## 更好的寫法（給 AI 的設計文檔）：
### 訂單列表頁面設計

#### 數據流
- 數據源：useOrderList hook（已有）
- 篩選狀態：URL search params（保持可分享）
- 排序狀態：本地 state（不需要持久化）

#### 組件結構
- OrderListPage（頁面級）
  - OrderFilters（篩選欄）
  - OrderTable（表格）
    - OrderRow（行）
      - StatusBadge（狀態標籤，已有）
  - Pagination（分頁，用 @company/ui）

#### 邊界情況
- 空狀態：顯示"暫無訂單" + 引導創建
- 加載中：表格骨架屏
- 篩選無結果：提示"調整篩選條件"
- 網絡錯誤：Toast 提示 + 重試按鈕
```

第二種方式生成的代碼質量高了一個量級。因為 AI 不需要"猜"你的架構決策。

## 小結

- 人機結對編程經歷了三個階段：補全 → 監工 → 協作
- 當前最優模式：人類做架構決策和接口定義，AI 做實現和驗證
- 關鍵心態轉變：從"審查代碼"到"審查接口契約"
- 給 AI 寫設計文檔比寫需求描述產出質量高 10 倍
- 人類的價值不在寫代碼，在做決策和定義邊界
