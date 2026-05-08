---
title: "Angular 16 Signals：响应式编程的新范式（开发者预览）"
date: 2023-05-24 14:31:50
tags:
  - Angular
---

Angular 16 于 2023 年 5 月 3 日发布，其中最令人兴奋的特性是 **Signals**——以开发者预览（Developer Preview）形式引入。Signals 不是对现有响应式系统（Zone.js + ChangeDetection）的修补，而是为 Angular 引入一套全新的细粒度响应式原语。

## 什么是 Signal

```typescript
import { signal, computed, effect } from "@angular/core";

// 创建可写的 Signal
const count = signal(0);
const name = signal("Angular");

// 读取：调用它（是个函数）
console.log(count()); // 0
console.log(name()); // 'Angular'

// 写入
count.set(5);
count.update((n) => n + 1); // 基于当前值更新

// computed：自动追踪依赖
const doubled = computed(() => count() * 2);
// 只有 count 变化时，doubled 才重新计算

// effect：副作用，自动追踪依赖并重新执行
effect(() => {
  console.log(`Count is now: ${count()}`); // 自动追踪 count
  // count 变化时，这个函数自动重新执行
});
```

## 在组件中使用

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

注意：模板中 `{{ count() }}` 用括号调用 Signal 是必须的。Angular 编译器会识别 Signal 调用并设置细粒度追踪，不再需要 Zone.js 触发变更检测。

## Signal 与 Zone.js 的关系

Angular 16 的 Signals 处于**过渡期**：

```typescript
// 当前（Angular 16）：Signals 与 Zone.js 共存
// Signal 变化 → 标记组件需要检查 → Zone.js 触发变更检测
// 不是真正的细粒度更新，但比全树遍历好

// 未来（Angular 17+）：Zone.js 可选
// Signal 变化 → 直接更新对应 DOM 节点
// 真正的细粒度响应式
```

## 实际应用：商品搜索

```typescript
@Component({
  selector: "app-product-search",
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, AsyncPipe],
  template: `
    <input [ngModel]="query()" (ngModelChange)="query.set($event)" />

    @if (isLoading()) {
      <p>搜索中...</p>
    }

    <ul>
      @for (product of filteredProducts(); track product.id) {
        <li>{{ product.name }} - ¥{{ product.price }}</li>
      }
    </ul>
    <p>共 {{ filteredProducts().length }} 个结果</p>
  `,
})
export class ProductSearchComponent {
  private productService = inject(ProductService);

  query = signal("");
  allProducts = signal<Product[]>([]);
  isLoading = signal(false);

  // computed 自动在 query 变化时重新计算
  filteredProducts = computed(() => {
    const q = this.query().toLowerCase();
    return this.allProducts().filter((p) => p.name.toLowerCase().includes(q));
  });

  constructor() {
    // effect 监听 query 变化，防抖请求
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

## toSignal 和 toObservable：与 RxJS 互操作

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

@Component({ standalone: true, ... })
export class UserComponent {
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  // Observable → Signal（自动取消订阅）
  userId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id')!))
  );

  user = toSignal(
    // 使用 userId Signal 作为数据源
    toObservable(this.userId).pipe(
      switchMap(id => id ? this.userService.getUser(id) : of(null))
    )
  );
}
```

## 与 Signals 配合的新输入装饰器预告

Angular 16 还引入了 `input()` 函数（开发者预览），将 `@Input` 变成 Signal：

```typescript
// 旧方式
@Component({ ... })
export class UserCardComponent {
  @Input() userId!: string;
}

// Angular 16 新方式（developer preview）
@Component({ ... })
export class UserCardComponent {
  userId = input<string>();           // 可选 Signal Input
  name = input.required<string>();    // 必填 Signal Input

  // 可以在 computed 中使用
  displayName = computed(() => `User: ${this.name()}`);
}
```

## 总结

Angular 16 的 Signals 是 Angular 历史上最重要的响应式系统变革。虽然当前是 Developer Preview，底层还依赖 Zone.js 实现更新，但 API 已经非常稳定。Angular 团队的目标是：Angular 17 中 Signals 趋于稳定，Angular 18 实现真正的 Zone-less 可选模式。现在开始熟悉 Signal API，是为未来做好准备的最佳时机。