---
title: "Angular 16 RxJS Interop：toSignal 與 toObservable 實戰"
date: 2023-08-04 10:05:11
tags:
  - Angular
  - RxJS
readingTime: 2
description: "Angular 16 的 `@angular/core/rxjs-interop` 包提供了 `toSignal` 和 `toObservable` 兩個工具函式，讓 Signal 和 RxJS Observable 能無縫互操作。這解決了 Angular 生態中長期存在的\"兩套響應式系統\"問題——現有的 RxJS 程"
wordCount: 241
---

Angular 16 的 `@angular/core/rxjs-interop` 包提供了 `toSignal` 和 `toObservable` 兩個工具函式，讓 Signal 和 RxJS Observable 能無縫互操作。這解決了 Angular 生態中長期存在的"兩套響應式系統"問題——現有的 RxJS 程式碼不需要重寫，可以逐步向 Signals 遷移。

## toSignal：將 Observable 包裝成 Signal

```typescript
import { toSignal } from "@angular/core/rxjs-interop";
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: "app-user-list",
  standalone: true,
  template: `
    @if (users()) {
      <ul>
        @for (user of users(); track user.id) {
          <li>{{ user.name }}</li>
        }
      </ul>
    } @else {
      <p>載入中...</p>
    }
  `,
})
export class UserListComponent {
  private http = inject(HttpClient);

  // Observable → Signal，自動在元件銷燬時取消訂閱
  users = toSignal(
    this.http.get<User[]>("/api/users"),
    { initialValue: null }, // Signal 的初始值（在 Observable 發出前）
  );
}
```

## toSignal 的各種配置

```typescript
// requireSync：Observable 必須同步發出初始值（否則報錯）
// 適合 BehaviorSubject 等同步 Observable
const subject = new BehaviorSubject(0);
const count = toSignal(subject, { requireSync: true });
// count() 永遠不會是 undefined

// 不設定 initialValue 時，Signal 型別是 T | undefined
const users = toSignal(this.http.get<User[]>("/api/users"));
users(); // User[] | undefined

// 設定 initialValue
const users = toSignal(this.http.get<User[]>("/api/users"), {
  initialValue: [],
});
users(); // User[]（不包含 undefined）

// rejectErrors：Observable 報錯時，Signal 丟擲錯誤
const data = toSignal(this.http.get<Data>("/api/data"), {
  initialValue: null,
  rejectErrors: false,
});
```

## toObservable：將 Signal 轉換為 Observable

```typescript
import { toObservable } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class SearchComponent {
  query = signal('');

  // Signal → Observable（每次 Signal 變化時發出新值）
  private query$ = toObservable(this.query);

  // 使用 RxJS 運算子（防抖 + switchMap）
  results = toSignal(
    this.query$.pipe(
      debounceTime(300),
      filter(q => q.length >= 2),
      switchMap(q => this.searchService.search(q)),
      catchError(() => of([]))
    ),
    { initialValue: [] }
  );

  constructor(private searchService: SearchService) {}
}
```

## 路由引數與 HTTP 請求的組合

```typescript
@Component({ standalone: true, ... })
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);

  // Route params → Signal
  productId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id')!)),
    { requireSync: true }
  );

  // 基於 productId Signal 的 HTTP 請求
  product = toSignal(
    toObservable(this.productId).pipe(
      switchMap(id => this.productService.getProduct(id)),
      catchError(() => of(null))
    ),
    { initialValue: null }
  );

  // computed：無需任何非同步訂閱
  pageTitle = computed(() =>
    this.product()?.name ?? '載入中...'
  );
}
```

## 與現有 Service 的整合

```typescript
// 漸進遷移：不需要改寫 Service
@Injectable({ providedIn: 'root' })
export class CartService {
  private items$ = new BehaviorSubject<CartItem[]>([]);

  // 保留 Observable 介面（相容現有程式碼）
  get cartItems$() { return this.items$.asObservable(); }

  addItem(item: CartItem) {
    const current = this.items$.value;
    this.items$.next([...current, item]);
  }
}

// 元件中：用 toSignal 橋接
@Component({ standalone: true, ... })
export class CartComponent {
  private cartService = inject(CartService);

  // 用 toSignal 獲得 Signal 語義
  items = toSignal(this.cartService.cartItems$, { initialValue: [] });
  total = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.qty, 0)
  );
}
```

## takeUntilDestroyed：自動清理

`toSignal` 內部已處理自動取消訂閱，但對於手動訂閱的場景，Angular 16 提供了 `takeUntilDestroyed`：

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class DataComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // 不需要 ngOnDestroy + Subject.complete() 的模板程式碼
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(n => console.log(n));
  }
}
```

## 總結

`toSignal` 和 `toObservable` 是 Angular 響應式系統遷移的關鍵橋樑。它們讓你可以在不重寫現有 RxJS 程式碼的前提下，逐步享受 Signal 的簡潔語法和細粒度追蹤優勢。在新程式碼中優先用 Signal，對 HTTP 請求等天然非同步場景，`toSignal(observable$)` 是目前最簡潔的處理方式。