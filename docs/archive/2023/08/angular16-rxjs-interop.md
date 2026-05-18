---
title: "Angular 16 RxJS Interop：toSignal 与 toObservable 实战"
date: 2023-08-04 10:05:11
tags:
  - Angular
  - RxJS
readingTime: 2
description: "Angular 16 的 `@angular/core/rxjs-interop` 包提供了 `toSignal` 和 `toObservable` 两个工具函数，让 Signal 和 RxJS Observable 能无缝互操作。这解决了 Angular 生态中长期存在的\"两套响应式系统\"问题——现有的 RxJS 代"
---

Angular 16 的 `@angular/core/rxjs-interop` 包提供了 `toSignal` 和 `toObservable` 两个工具函数，让 Signal 和 RxJS Observable 能无缝互操作。这解决了 Angular 生态中长期存在的"两套响应式系统"问题——现有的 RxJS 代码不需要重写，可以逐步向 Signals 迁移。

## toSignal：将 Observable 包装成 Signal

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
      <p>加载中...</p>
    }
  `,
})
export class UserListComponent {
  private http = inject(HttpClient);

  // Observable → Signal，自动在组件销毁时取消订阅
  users = toSignal(
    this.http.get<User[]>("/api/users"),
    { initialValue: null }, // Signal 的初始值（在 Observable 发出前）
  );
}
```

## toSignal 的各种配置

```typescript
// requireSync：Observable 必须同步发出初始值（否则报错）
// 适合 BehaviorSubject 等同步 Observable
const subject = new BehaviorSubject(0);
const count = toSignal(subject, { requireSync: true });
// count() 永远不会是 undefined

// 不设置 initialValue 时，Signal 类型是 T | undefined
const users = toSignal(this.http.get<User[]>("/api/users"));
users(); // User[] | undefined

// 设置 initialValue
const users = toSignal(this.http.get<User[]>("/api/users"), {
  initialValue: [],
});
users(); // User[]（不包含 undefined）

// rejectErrors：Observable 报错时，Signal 抛出错误
const data = toSignal(this.http.get<Data>("/api/data"), {
  initialValue: null,
  rejectErrors: false,
});
```

## toObservable：将 Signal 转换为 Observable

```typescript
import { toObservable } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class SearchComponent {
  query = signal('');

  // Signal → Observable（每次 Signal 变化时发出新值）
  private query$ = toObservable(this.query);

  // 使用 RxJS 操作符（防抖 + switchMap）
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

## 路由参数与 HTTP 请求的组合

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

  // 基于 productId Signal 的 HTTP 请求
  product = toSignal(
    toObservable(this.productId).pipe(
      switchMap(id => this.productService.getProduct(id)),
      catchError(() => of(null))
    ),
    { initialValue: null }
  );

  // computed：无需任何异步订阅
  pageTitle = computed(() =>
    this.product()?.name ?? '加载中...'
  );
}
```

## 与现有 Service 的集成

```typescript
// 渐进迁移：不需要改写 Service
@Injectable({ providedIn: 'root' })
export class CartService {
  private items$ = new BehaviorSubject<CartItem[]>([]);

  // 保留 Observable 接口（兼容现有代码）
  get cartItems$() { return this.items$.asObservable(); }

  addItem(item: CartItem) {
    const current = this.items$.value;
    this.items$.next([...current, item]);
  }
}

// 组件中：用 toSignal 桥接
@Component({ standalone: true, ... })
export class CartComponent {
  private cartService = inject(CartService);

  // 用 toSignal 获得 Signal 语义
  items = toSignal(this.cartService.cartItems$, { initialValue: [] });
  total = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.qty, 0)
  );
}
```

## takeUntilDestroyed：自动清理

`toSignal` 内部已处理自动取消订阅，但对于手动订阅的场景，Angular 16 提供了 `takeUntilDestroyed`：

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class DataComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // 不需要 ngOnDestroy + Subject.complete() 的模板代码
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(n => console.log(n));
  }
}
```

## 总结

`toSignal` 和 `toObservable` 是 Angular 响应式系统迁移的关键桥梁。它们让你可以在不重写现有 RxJS 代码的前提下，逐步享受 Signal 的简洁语法和细粒度追踪优势。在新代码中优先用 Signal，对 HTTP 请求等天然异步场景，`toSignal(observable$)` 是目前最简洁的处理方式。