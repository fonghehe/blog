---
title: "Angular Signal 架構 2026：從狀態建模到大型應用治理"
date: 2026-06-01 09:27:36
tags:
  - Angular
  - 架構
readingTime: 6
description: "Signal 已經成為 Angular 新架構的關鍵能力。本文討論如何用 Signal 建模局部狀態、派生狀態和跨模塊數據流，並給出大型應用中的治理建議。"
wordCount: 1307
---

Angular 的 Signal 體系已經從新特性變成架構設計的一部分。它改變的不隻是狀態更新語法，更重要的是讓組件、服務和範本之間的數據依賴變得更清晰。對於大型應用來說，Signal 的價值在於減少隱式訂閱，讓狀態變化更可追蹤。

## 從局部狀態開始

不是所有狀態都需要進入全局 store。2026 年的最佳實踐是按狀態的生命週期和作用域來選擇容器：

**組件內 Signal（Component Signals）**
適用於表單輸入、彈窗開關、當前 tab、局部篩選條件等。它們生命週期短、依賴範圍明確，放在組件內部反而更容易維護：

```typescript
@Component({
  selector: 'app-product-filter',
  template: `
    <input [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" />
    <select [ngModel]="selectedCategory()" (ngModelChange)="selectedCategory.set($event)">
      @for (cat of categories(); track cat.id) {
        <option [value]="cat.id">{{ cat.name }}</option>
      }
    </select>
    <p>當前篩選結果：{{ filteredCount() }} 條</p>
  `
})
export class ProductFilterComponent {
  // 局部狀態，組件銷毀時自動清理
  searchTerm = signal('');
  selectedCategory = signal<string | null>(null);

  // 派生狀態
  filteredCount = computed(() => {
    let items = this.products();
    const term = this.searchTerm();
    if (term) items = items.filter(p => p.name.includes(term));
    const cat = this.selectedCategory();
    if (cat) items = items.filter(p => p.categoryId === cat);
    return items.length;
  });
}
```

判斷標準很明確：**當一個狀態隻被當前組件及其直接子組件使用時，它就應該留在組件裡。**

## 服務層 Signal：領域狀態的管理

當狀態需要跨越多個組件時，提升到服務層。但要注意服務層 Signal 的暴露方式：

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  // 內部可寫
  private items = signal<CartItem[]>([]);

  // 外部隻讀——防止外部直接修改
  readonly itemCount = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0)
  );
  readonly totalPrice = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  readonly isEmpty = computed(() => this.items().length === 0);

  // 命令方法——唯一的修改入口
  addItem(product: Product, quantity = 1): void {
    this.items.update(items => {
      const existing = items.find(i => i.productId === product.id);
      if (existing) {
        return items.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...items, { productId: product.id, quantity, price: product.price }];
    });
  }

  removeItem(productId: string): void {
    this.items.update(items => items.filter(i => i.productId !== productId));
  }

  clearCart(): void {
    this.items.set([]);
  }
}
```

這個模式的關鍵設計決策：
- **私有 Signal + 公開 computed**：外部隻能讀取派生數據
- **命令方法作為修改入口**：所有修改都有明確的調用來源，方便追蹤和除錯
- **不可變更新**：使用 `update()` 配合不可變操作，確保 Angular 變更檢測正確工作

## 派生狀態要保持純粹

`computed` 是 Signal 體系中最容易被濫用的特性之一。一個重要的原則：

**computed 應該用於描述「數據是甚麼」，而不是「在數據變化時要做甚麼」。**

```typescript
// ✅ 正確：computed 描述派生關係
readonly canSubmit = computed(() =>
  this.form().valid && !this.submitting() && this.hasChanges()
);

readonly displayPrice = computed(() =>
  this.currency() === 'CNY'
    ? `¥${this.price().toFixed(2)}`
    : `$${(this.price() / this.exchangeRate()).toFixed(2)}`
);

readonly activeFilters = computed(() =>
  Object.entries(this.filters())
    .filter(([_, value]) => value !== null)
    .map(([key]) => key)
);

// ❌ 錯誤：computed 裡做副作用
readonly _badExample = computed(() => {
  analytics.track('price_changed', { price: this.price() }); // 副作用！
  localStorage.setItem('last_price', String(this.price()));   // 副作用！
  return this.price() * 1.1;
});
```

副作用（網絡請求、埋點、持久化、DOM 操作）應該放在 `effect()` 或顯式的服務方法裡：

```typescript
constructor() {
  // effect 用於副作用——明確標註這是「要做的事」
  effect(() => {
    const price = this.price();
    if (price > 0) {
      analytics.track('price_updated', { price });
    }
  });
}
```

## linkedSignal：2026 年的新利器

Angular 在 2026 年引入了 `linkedSignal`，用於解決「當源 Signal 變化時自動重置派生 Signal」的常見需求。一個典型場景：

```typescript
@Component({...})
export class ProductListComponent {
  categoryId = input.required<string>();

  // linkedSignal: 當 categoryId 變化時，自動重置頁碼為 1
  currentPage = linkedSignal({
    source: this.categoryId,
    computation: () => 1  // categoryId 變了 → 回到第一頁
  });

  constructor() {
    // 用戶手動翻頁時更新
    effect(() => {
      console.log(`當前分類: ${this.categoryId()}, 頁碼: ${this.currentPage()}`);
    });
  }

  goToPage(page: number) {
    this.currentPage.set(page);
  }
}
```

在 `linkedSignal` 出現之前，這種模式需要手動在 `effect` 裡監聽 `categoryId` 的變化來重置頁碼——容易遺漏且難以維護。`linkedSignal` 把「A 變化則 B 重置」這個關係顯式化，程式碼意圖清晰得多。

## Signal 與 RxJS 的協作

一個常見的誤解是「用了 Signal 就不需要 RxJS 了」。2026 年的實際最佳實踐是：**Signal 和 RxJS 各有分工，配合使用才是最優解。**

| 場景 | 推薦工具 | 原因 |
|------|---------|------|
| 同步狀態管理 | Signal | 語法簡潔、模板友好、自動清理 |
| 表單狀態 | Signal | Angular Forms 已原生支援 Signal |
| 複雜非同步流 | RxJS | debounce、switchMap、combineLatest 等操作符不可替代 |
| WebSocket 即時數據 | RxJS → Signal | RxJS 處理流，`toSignal()` 轉換後給組件消費 |
| 多源數據聚合 | RxJS | `combineLatest` 依賴追蹤更靈活 |
| 簡單的 HTTP 請求 | `httpResource` | Angular 21+ 的新 API，Signal 原生支援 |

互轉的兩個關鍵 API：

```typescript
// RxJS Observable → Signal
const data = toSignal(this.dataService.getData$(), { initialValue: [] });

// Signal → RxJS Observable
const data$ = toObservable(this.mySignal);
```

推薦的架構模式：**服務層用 RxJS 處理複雜非同步編排，組件層用 Signal 消費——`toSignal()` 作為兩者之間的橋。** 這不是甚麼哲學偏好，而是純粹的工程合理性：每個層使用最適合的工具。

## 大型應用中的 Signal 治理

當項目變得龐大後，沒有規則約束的 Signal 會變成新的混亂來源。幾個實用的治理原則：

**原則 1：明確所有權**
- 組件擁有 UI 狀態 Signal（表單值、展開/折疊、當前選中項）
- 領域服務擁有業務狀態 Signal（購物車、用戶權限、當前訂單）
- 基礎設施服務不擁有狀態，隻暴露方法和 Observable

**原則 2：控製寫入入口**
不要讓任何組件都能直接修改共享 Signal。遵循 CQRS 思想：
- 讀取通過 `computed` 或隻讀 Signal 暴露
- 修改通過明確命名的方法（`addItem`、`removeItem`、`updateQuantity`）
- 日誌和埋點在方法裡集中處理

**原則 3：Signal 除錯策略**
在大型應用中追蹤 Signal 的依賴鏈是挑戰。推薦的除錯方法：
- 在 `computed` 和 `effect` 裡使用 Angular DevTools 的 Signal 除錯面板
- 為關鍵 Signal 新增 `effect` 日誌（僅開發環境）
- 使用 Angular ESLint 外掛禁止在 computed 裡執行副作用

**原則 4：避免 Signal 地獄**
不要因為 Signal 好用就把所有數據都變成 Signal。靜態設定數據（如國家列表、省市區數據）用普通常數更好。隻會在一個地方用到的派生數據，直接用函式計算可能比 computed 更簡單。

## 小結

Angular Signal 架構的關鍵不是把 RxJS 全部替換掉，而是把不同類型的響應式問題放到合適的位置。Signal 負責清晰的同步狀態和簡單的派生關係，RxJS 繼續處理複雜非同步流和即時數據編排。`linkedSignal` 讓「源-目標重置」模式變得更安全。對於大型應用來說，Signal 治理的核心是：明確所有權、控製寫入入口、保持派生純粹——這些原則和大規模軟件工程的基本原則完全一致。2026 年的 Angular 開發者需要同時掌握 Signal 和 RxJS，知道在甚麼場景下用哪個，才是真正的工程成熟度。
