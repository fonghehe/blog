---
title: "Angular 16 Signals：響應式程式設計的新範式（開發者預覽）"
date: 2023-05-24 14:31:50
tags:
  - Angular
readingTime: 2
description: "Angular 16 於 2023 年 5 月 3 日釋出，其中最令人興奮的特性是 **Signals**——以開發者預覽（Developer Preview）形式引入。Signals 不是對現有響應式系統（Zone.js + ChangeDetection）的修補，而是為 Angular 引入一套全新的細粒度響應式原"
---

Angular 16 於 2023 年 5 月 3 日釋出，其中最令人興奮的特性是 **Signals**——以開發者預覽（Developer Preview）形式引入。Signals 不是對現有響應式系統（Zone.js + ChangeDetection）的修補，而是為 Angular 引入一套全新的細粒度響應式原語。

## 什麼是 Signal

```typescript
import { signal, computed, effect } from "@angular/core";

// 建立可寫的 Signal
const count = signal(0);
const name = signal("Angular");

// 讀取：呼叫它（是個函式）
console.log(count()); // 0
console.log(name()); // 'Angular'

// 寫入
count.set(5);
count.update((n) => n + 1); // 基於當前值更新

// computed：自動追蹤依賴
const doubled = computed(() => count() * 2);
// 只有 count 變化時，doubled 才重新計算

// effect：副作用，自動追蹤依賴並重新執行
effect(() => {
  console.log(`Count is now: ${count()}`); // 自動追蹤 count
  // count 變化時，這個函式自動重新執行
});
```

## 在元件中使用

```typescript
@Component({
  selector: "app-counter",
  standalone: true,
  template: `
    <div>
      <p>Count: {{ count() }}</p>
      <p>Doubled: {{ doubled() }}</p>
      <button (click)="increment()">+1</button>
      <button (click)="reset()">Reset</button>
    </div>
  `,
})
export class CounterComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  increment() {
    this.count.update((n) => n + 1);
  }
  reset() {
    this.count.set(0);
  }
}
```

注意：模板中 `{{ count() }}` 用括號呼叫 Signal 是必須的。Angular 編譯器會識別 Signal 呼叫並設定細粒度追蹤，不再需要 Zone.js 觸發變更檢測。

## Signal 與 Zone.js 的關係

Angular 16 的 Signals 處於**過渡期**：

```typescript
// 當前（Angular 16）：Signals 與 Zone.js 共存
// Signal 變化 → 標記元件需要檢查 → Zone.js 觸發變更檢測
// 不是真正的細粒度更新，但比全樹遍歷好

// 未來（Angular 17+）：Zone.js 可選
// Signal 變化 → 直接更新對應 DOM 節點
// 真正的細粒度響應式
```

## 實際應用：商品搜尋

```typescript
@Component({
  selector: "app-product-search",
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, AsyncPipe],
  template: `
    <input [ngModel]="query()" (ngModelChange)="query.set($event)" />

    @if (isLoading()) {
      <p>搜尋中...</p>
    }

    <ul>
      @for (product of filteredProducts(); track product.id) {
        <li>{{ product.name }} - ¥{{ product.price }}</li>
      }
    </ul>
    <p>共 {{ filteredProducts().length }} 個結果</p>
  `,
})
export class ProductSearchComponent {
  private productService = inject(ProductService);

  query = signal("");
  allProducts = signal<Product[]>([]);
  isLoading = signal(false);

  // computed 自動在 query 變化時重新計算
  filteredProducts = computed(() => {
    const q = this.query().toLowerCase();
    return this.allProducts().filter((p) => p.name.toLowerCase().includes(q));
  });

  constructor() {
    // effect 監聽 query 變化，防抖請求
    effect(() => {
      const q = this.query();
      if (q.length < 2) return;
      this.isLoading.set(true);
      this.productService.search(q).subscribe((products) => {
        this.allProducts.set(products);
        this.isLoading.set(false);
      });
    });
  }
}
```

## toSignal 和 toObservable：與 RxJS 互操作

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class UserComponent {
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  // Observable → Signal（自動取消訂閱）
  userId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id')!))
  );

  user = toSignal(
    // 使用 userId Signal 作為資料來源
    toObservable(this.userId).pipe(
      switchMap(id => id ? this.userService.getUser(id) : of(null))
    )
  );
}
```

## 與 Signals 配合的新輸入裝飾器預告

Angular 16 還引入了 `input()` 函式（開發者預覽），將 `@Input` 變成 Signal：

```typescript
// 舊方式
@Component({ ... })
export class UserCardComponent {
  @Input() userId!: string;
}

// Angular 16 新方式（developer preview）
@Component({ ... })
export class UserCardComponent {
  userId = input<string>();           // 可選 Signal Input
  name = input.required<string>();    // 必填 Signal Input

  // 可以在 computed 中使用
  displayName = computed(() => `User: ${this.name()}`);
}
```

## 總結

Angular 16 的 Signals 是 Angular 歷史上最重要的響應式系統變革。雖然當前是 Developer Preview，底層還依賴 Zone.js 實現更新，但 API 已經非常穩定。Angular 團隊的目標是：Angular 17 中 Signals 趨於穩定，Angular 18 實現真正的 Zone-less 可選模式。現在開始熟悉 Signal API，是為未來做好準備的最佳時機。