---
title: "GitHub Copilot 半年使用報告：AI 編程的真實體驗"
date: 2023-03-15 16:44:36
tags:
  - Git
readingTime: 2
description: "用 GitHub Copilot 已經半年了，説説真實感受。不是廣告，也不是恐慌文，就是真實體驗。"
wordCount: 554
---

用 GitHub Copilot 已經半年了，説説真實感受。不是廣告，也不是恐慌文，就是真實體驗。

## 什麼情況下 Copilot 幫我省時間

**寫模板代碼（最有用）**

```typescript
// 我輸入註釋或函數名，Copilot 補全
// 比如我寫：// 把對象數組按 key 分組
function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  // Copilot 直接給出正確實現
  return arr.reduce(
    (groups, item) => {
      const group = String(item[key]);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}
```

這類純邏輯函數，Copilot 往往一次就對，不需要改。

**寫測試用例**

```typescript
// 寫完函數後，寫 describe() 註釋
// Copilot 會把各種測試用例都補全出來
describe('groupBy', () => {
  it('按字符串 key 分組', () => { ... })
  it('空數組返回空對象', () => { ... })
  it('所有元素相同 key 時分在同一組', () => { ... })
})
```

**CSS 和 Tailwind**

輸入組件名和功能描述，Copilot 直接給出 Tailwind 類名組合，大部分時候直接能用。

## 什麼情況下 Copilot 幫不了

**業務邏輯**

```typescript
// Copilot 不知道你的業務規則
// 這種代碼還是得自己寫
async function processOrder(order: Order) {
  // VIP 用户免運費，訂單滿 200 打 9 折，
  // 但不和滿減券同用，節假日翻倍積分...
}
```

**複雜 Bug 定位**

Copilot 給的建議有時候是"看起來合理但解決不了問題的代碼"，反而浪費時間。

**架構決策**

選哪個庫、用什麼模式、怎麼設計接口——這些 Copilot 給不出好答案。

## 我的使用方式

**用，但不盲信**

Copilot 的建議是參考，不是答案。每一行生成的代碼都要審查：

- 邏輯是否正確
- 有沒有安全隱患（SQL 注入、XSS 等）
- 是否符合項目規範

**把它當"有記憶的 StackOverflow"**

查 API 用法、看常用模式，比 Google 快。但重要的業務代碼不能直接用。

**注意版權和隱私**

不要把敏感代碼粘貼給 Copilot（雖然 GitHub 説不會存儲，但習慣要養成）。

## AI 對前端工作的影響

老實説，Copilot 讓我的"寫代碼"速度提升了大約 20-30%。但 coding 本身在工作中佔的比例沒那麼高——設計方案、Code Review、和產品溝通、解 Bug 這些，AI 現在幫不了多少。

不過變化的速度很快。ChatGPT 出來後，Copilot Chat 也來了，可以直接對話解釋代碼、生成測試、重構建議。

未來 2-3 年，能更好地和 AI 協作的工程師會有明顯優勢。不是"AI 會替代工程師"，而是"會用 AI 的工程師會比不用的更高效"。

## 小結

- Copilot 在模板代碼、測試、CSS 上幫助顯著
- 業務邏輯、架構決策、Bug 定位還是得靠自己
- 生成的代碼必須審查，不能無腦接受
- AI 工具是效率倍增器，不是替代品
- 開始認真學如何和 AI 工具高效協作