---
title: "Angular 18.2 linkedSignal：響應式依賴訊號的新原語"
date: 2024-09-11 10:00:00
tags:
  - Angular
readingTime: 2
description: "Angular 18.2 於 2024 年 8 月 14 日釋出，引入了 `linkedSignal()`——一個實驗性的新 Signal 原語。它解決了 `computed()` 和可寫 `signal()` 之間長期存在的一個痛點：**如何建立一個既能從外部源派生初始值，又允許本地修改的 Signal**。"
wordCount: 298
---

Angular 18.2 於 2024 年 8 月 14 日釋出，引入了 `linkedSignal()`——一個實驗性的新 Signal 原語。它解決了 `computed()` 和可寫 `signal()` 之間長期存在的一個痛點：**如何建立一個既能從外部源派生初始值，又允許本地修改的 Signal**。

## 問題背景

在 Angular Signals 中，`computed()` 的值是隻讀的（不能 `.set()`），而普通 `signal()` 不能自動追蹤依賴。兩者之間有一個gap：

```typescript
// ❌ computed() 是隻讀的
const selectedId = computed(() => props.items()[0]?.id);
// selectedId.set(...) → 報錯！

// ❌ signal() 不能跟隨 props 變化自動更新
const selectedId = signal(props.items()[0]?.id);
// 當 props.items() 變化時，selectedId 不會自動更新

// 以前的變通方案：effect() 手動同步
effect(() => {
  selectedId.set(props.items()[0]?.id); // 繁瑣，且 effect 有副作用語義
});
```

## linkedSignal() 解決方案

```typescript
import { Component, input, signal, linkedSignal } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-list-selector",
  template: `
    <ul>
      @for (item of items(); track item.id) {
        <li
          [class.selected]="selectedId() === item.id"
          (click)="selectedId.set(item.id)"
        >
          {{ item.name }}
        </li>
      }
    </ul>
  `,
})
export class ListSelectorComponent {
  items = input.required<{ id: string; name: string }[]>();

  // linkedSignal：當 items() 變化時，自動重置為第一個元素的 id
  // 但使用者點選選擇後，可以本地修改
  selectedId = linkedSignal(() => this.items()[0]?.id ?? null);

  // 使用者可以修改：selectedId.set('other-id')
  // 當 items() 變化時，自動重置為新列表的第一個元素
}
```

## 高階用法：帶前值的派生

`linkedSignal()` 支援訪問前一個值，實現更復雜的邏輯：

```typescript
@Component({ standalone: true, ... })
export class PaginatedListComponent {
  items = input.required<Item[]>();
  pageSize = input(10);

  // 當 items 變化時重置到第 1 頁；當 pageSize 變化時，嘗試保持在合理範圍內
  currentPage = linkedSignal<number>({
    source: () => ({ items: this.items(), pageSize: this.pageSize() }),
    computation: (source, previous) => {
      const maxPage = Math.ceil(source.items.length / source.pageSize);
      if (!previous) return 1;  // 初始化
      // 保持當前頁，但不超過最大頁數
      return Math.min(previous.value, maxPage);
    }
  });

  totalPages = computed(() =>
    Math.ceil(this.items().length / this.pageSize())
  );
}
```

## linkedSignal vs computed vs signal

```
signal()
  + 可寫（.set(), .update()）
  - 不追蹤依賴，不會自動更新
  用途：獨立的本地狀態

computed()
  + 自動追蹤依賴，響應式更新
  - 只讀，不可手動修改
  用途：從其他 Signal 派生的只讀值

linkedSignal()  ← 新增
  + 從 Signal 派生初始值（類似 computed）
  + 可寫，允許本地修改（類似 signal）
  - 當源 Signal 變化時，本地修改會被重置
  用途：有"預設值來自外部，但使用者可覆蓋"語義的狀態
```

## 常見應用場景

```typescript
// 場景 1：表單欄位的預設值來自 props，使用者可修改
editName = linkedSignal(() => this.user().name);

// 場景 2：多選時，外部列表變化時清空選中
selectedIds = linkedSignal<Set<string>>({
  source: this.items,
  computation: () => new Set(), // 列表變化時清空
});

// 場景 3：分頁器，資料來源變化時回到第 1 頁
page = linkedSignal<number>({
  source: () => this.query(),
  computation: (_, prev) => (prev ? 1 : 1),
});
```

## 注意：實驗性 API

`linkedSignal()` 在 Angular 18.2 中仍是**實驗性**（experimental）API，標記為 `@experimental`。不排除在未來版本中有 API 調整。預計 Angular 19 會進一步穩定它。

```typescript
// 當前匯入路徑中帶有實驗標記
import { linkedSignal } from "@angular/core";
// 使用時 IDE 會提示這是實驗性 API，需自行判斷是否在生產中使用
```

## 總結

`linkedSignal()` 填補了 Angular Signals 原語體系中的一個重要空缺——"可變的派生訊號"。它讓"選中項跟隨列表變化重置，但使用者操作優先"這類常見 UI 模式有了優雅的表達方式。配合 Angular 18.1 已穩定的 Signal API，Angular 的響應式模型正在變得越來越完整。
