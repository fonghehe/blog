---
title: "Angular 与 RxJS：响应式编程在组件通信中的实践"
date: 2018-07-26 17:32:04
tags:
  - Angular
readingTime: 2
description: "Angular 从诞生起就深度集成 RxJS，HttpClient、EventEmitter、Router 全都基于 Observable。掌握 RxJS 操作符，能让你的 Angular 代码更优雅地处理异步和组件通信。"
wordCount: 248
---

Angular 从诞生起就深度集成 RxJS，HttpClient、EventEmitter、Router 全都基于 Observable。掌握 RxJS 操作符，能让你的 Angular 代码更优雅地处理异步和组件通信。

## 为什么 Angular 选择 RxJS

- 统一异步模型：HTTP、定时器、DOM 事件都是流
- 强大的组合能力：`switchMap`、`combineLatest` 等操作符
- 内置取消（unsubscribe）避免内存泄漏

## 常用操作符实战

### switchMap：搜索防抖

```typescript
{% raw %}
@Component({
  template: `<input [formControl]="searchCtrl" placeholder="搜索" />
    <div *ngFor="let result of results$ | async">{{ result.name }}</div>`,
})
export class SearchComponent implements OnInit {
  searchCtrl = new FormControl("");
  results$: Observable<SearchResult[]>;

  constructor(private searchService: SearchService) {}

  ngOnInit() {
    this.results$ = this.searchCtrl.valueChanges.pipe(
      debounceTime(300), // 停止输入 300ms 后再发请求
      distinctUntilChanged(), // 值未变化不发请求
      switchMap(
        (
          query, // 新请求自动取消上一次
        ) => (query ? this.searchService.search(query) : of([])),
      ),
    );
  }
}
{% endraw %}
```

### combineLatest：多个数据流合并

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

## Subject 做跨组件通信

用 `BehaviorSubject` 封装一个共享状态服务，替代简单场景下的 NgRx：

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

## 内存泄漏防范

组件销毁时必须取消订阅，推荐用 `takeUntil` 统一管理：

```typescript
export class MyComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    interval(1000)
      .pipe(
        takeUntil(this.destroy$), // 组件销毁时自动完成
      )
      .subscribe((n) => console.log(n));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## async pipe 是首选

在模板里用 `async` pipe 让 Angular 自动管理订阅和取消订阅，比手动 subscribe 更安全：

```html
{% raw %}
<!-- ✅ async pipe 自动取消订阅 -->
<div *ngIf="user$ | async as user">{{ user.name }}</div>

<!-- ❌ 手动订阅容易忘记取消 -->
{% endraw %}
```

## 总结

RxJS 是 Angular 开发的核心技能。`switchMap` 处理搜索、`combineLatest` 聚合数据、`BehaviorSubject` 共享状态——掌握这三个场景，日常 80% 的响应式需求都能应对。
