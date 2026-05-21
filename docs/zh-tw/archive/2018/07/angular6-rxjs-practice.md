---
title: "Angular 與 RxJS：響應式程式設計在元件通訊中的實踐"
date: 2018-07-26 17:32:04
tags:
  - Angular
readingTime: 2
description: "Angular 從誕生起就深度整合 RxJS，HttpClient、EventEmitter、Router 全都基於 Observable。掌握 RxJS 運算子，能讓你的 Angular 程式碼更優雅地處理非同步和元件通訊。"
wordCount: 253
---

Angular 從誕生起就深度整合 RxJS，HttpClient、EventEmitter、Router 全都基於 Observable。掌握 RxJS 運算子，能讓你的 Angular 程式碼更優雅地處理非同步和元件通訊。

## 為什麼 Angular 選擇 RxJS

- 統一非同步模型：HTTP、定時器、DOM 事件都是流
- 強大的組合能力：`switchMap`、`combineLatest` 等運算子
- 內建取消（unsubscribe）避免記憶體洩漏

## 常用運算子實戰

### switchMap：搜尋防抖

```typescript
{% raw %}
@Component({
  template: `<input [formControl]="searchCtrl" placeholder="搜尋" />
    <div *ngFor="let result of results$ | async">{{ result.name }}</div>`,
})
export class SearchComponent implements OnInit {
  searchCtrl = new FormControl("");
  results$: Observable<SearchResult[]>;

  constructor(private searchService: SearchService) {}

  ngOnInit() {
    this.results$ = this.searchCtrl.valueChanges.pipe(
      debounceTime(300), // 停止輸入 300ms 後再發請求
      distinctUntilChanged(), // 值未變化不發請求
      switchMap(
        (
          query, // 新請求自動取消上一次
        ) => (query ? this.searchService.search(query) : of([])),
      ),
    );
  }
}
{% endraw %}
```

### combineLatest：多個數據流合併

```typescript
export class DashboardComponent implements OnInit {
  vm$: Observable<ViewModel>;

  constructor(
    private userService: UserService,
    private statsService: StatsService,
  ) {}

  ngOnInit() {
    this.vm$ = combineLatest([
      this.userService.currentUser$,
      this.statsService.stats$,
    ]).pipe(map(([user, stats]) => ({ user, stats })));
  }
}
```

## Subject 做跨元件通訊

用 `BehaviorSubject` 封裝一個共享狀態服務，替代簡單場景下的 NgRx：

```typescript
@Injectable({ providedIn: "root" })
export class CartService {
  private itemsSubject = new BehaviorSubject<CartItem[]>([]);
  items$ = this.itemsSubject.asObservable();

  get count$() {
    return this.items$.pipe(map((items) => items.length));
  }

  addItem(item: CartItem) {
    const current = this.itemsSubject.getValue();
    this.itemsSubject.next([...current, item]);
  }

  removeItem(id: string) {
    const current = this.itemsSubject.getValue();
    this.itemsSubject.next(current.filter((i) => i.id !== id));
  }
}
```

## 記憶體洩漏防範

元件銷燬時必須取消訂閱，推薦用 `takeUntil` 統一管理：

```typescript
export class MyComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    interval(1000)
      .pipe(
        takeUntil(this.destroy$), // 元件銷燬時自動完成
      )
      .subscribe((n) => console.log(n));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## async pipe 是首選

在模板裡用 `async` pipe 讓 Angular 自動管理訂閱和取消訂閱，比手動 subscribe 更安全：

```html
{% raw %}
<!-- ✅ async pipe 自動取消訂閱 -->
<div *ngIf="user$ | async as user">{{ user.name }}</div>

<!-- ❌ 手動訂閱容易忘記取消 -->
{% endraw %}
```

## 總結

RxJS 是 Angular 開發的核心技能。`switchMap` 處理搜尋、`combineLatest` 聚合資料、`BehaviorSubject` 共享狀態——掌握這三個場景，日常 80% 的響應式需求都能應對。
