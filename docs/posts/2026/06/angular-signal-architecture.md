---
title: "Angular Signal 架构 2026：从状态建模到大型应用治理"
date: 2026-06-01 09:27:36
tags:
  - Angular
  - 架构
readingTime: 6
description: "Signal 已经成为 Angular 新架构的关键能力。本文讨论如何用 Signal 建模局部状态、派生状态和跨模块数据流，并给出大型应用中的治理建议。"
wordCount: 1303
---

Angular 的 Signal 体系已经从新特性变成架构设计的一部分。它改变的不只是状态更新语法，更重要的是让组件、服务和模板之间的数据依赖变得更清晰。对于大型应用来说，Signal 的价值在于减少隐式订阅，让状态变化更可追踪。

## 从局部状态开始

不是所有状态都需要进入全局 store。2026 年的最佳实践是按状态的生命周期和作用域来选择容器：

**组件内 Signal（Component Signals）**
适用于表单输入、弹窗开关、当前 tab、局部筛选条件等。它们生命周期短、依赖范围明确，放在组件内部反而更容易维护：

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
    <p>当前筛选结果：{{ filteredCount() }} 条</p>
  `
})
export class ProductFilterComponent {
  // 局部状态，组件销毁时自动清理
  searchTerm = signal('');
  selectedCategory = signal<string | null>(null);

  // 派生状态
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

判断标准很明确：**当一个状态只被当前组件及其直接子组件使用时，它就应该留在组件里。**

## 服务层 Signal：领域状态的管理

当状态需要跨越多个组件时，提升到服务层。但要注意服务层 Signal 的暴露方式：

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  // 内部可写
  private items = signal<CartItem[]>([]);

  // 外部只读——防止外部直接修改
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

这个模式的关键设计决策：
- **私有 Signal + 公开 computed**：外部只能读取派生数据
- **命令方法作为修改入口**：所有修改都有明确的调用来源，方便追踪和调试
- **不可变更新**：使用 `update()` 配合不可变操作，确保 Angular 变更检测正确工作

## 派生状态要保持纯粹

`computed` 是 Signal 体系中最容易被滥用的特性之一。一个重要的原则：

**computed 应该用于描述"数据是什么"，而不是"在数据变化时要做什么"。**

```typescript
// ✅ 正确：computed 描述派生关系
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

// ❌ 错误：computed 里做副作用
readonly _badExample = computed(() => {
  analytics.track('price_changed', { price: this.price() }); // 副作用！
  localStorage.setItem('last_price', String(this.price()));   // 副作用！
  return this.price() * 1.1;
});
```

副作用（网络请求、埋点、持久化、DOM 操作）应该放在 `effect()` 或显式的服务方法里：

```typescript
constructor() {
  // effect 用于副作用——明确标注这是"要做的事"
  effect(() => {
    const price = this.price();
    if (price > 0) {
      analytics.track('price_updated', { price });
    }
  });
}
```

## linkedSignal：2026 年的新利器

Angular 在 2026 年引入了 `linkedSignal`，用于解决"当源 Signal 变化时自动重置派生 Signal"的常见需求。一个典型场景：

```typescript
@Component({...})
export class ProductListComponent {
  categoryId = input.required<string>();

  // linkedSignal: 当 categoryId 变化时，自动重置页码为 1
  currentPage = linkedSignal({
    source: this.categoryId,
    computation: () => 1  // categoryId 变了 → 回到第一页
  });

  constructor() {
    // 用户手动翻页时更新
    effect(() => {
      console.log(`当前分类: ${this.categoryId()}, 页码: ${this.currentPage()}`);
    });
  }

  goToPage(page: number) {
    this.currentPage.set(page);
  }
}
```

在 `linkedSignal` 出现之前，这种模式需要手动在 `effect` 里监听 `categoryId` 的变化来重置页码——容易遗漏且难以维护。`linkedSignal` 把"A 变化则 B 重置"这个关系显式化，代码意图清晰得多。

## Signal 与 RxJS 的协作

一个常见的误解是"用了 Signal 就不需要 RxJS 了"。2026 年的实际最佳实践是：**Signal 和 RxJS 各有分工，配合使用才是最优解。**

| 场景 | 推荐工具 | 原因 |
|------|---------|------|
| 同步状态管理 | Signal | 语法简洁、模板友好、自动清理 |
| 表单状态 | Signal | Angular Forms 已原生支持 Signal |
| 复杂异步流 | RxJS | debounce、switchMap、combineLatest 等操作符不可替代 |
| WebSocket 实时数据 | RxJS → Signal | RxJS 处理流，`toSignal()` 转换后给组件消费 |
| 多源数据聚合 | RxJS | `combineLatest` 依赖追踪更灵活 |
| 简单的 HTTP 请求 | `httpResource` | Angular 21+ 的新 API，Signal 原生支持 |

互转的两个关键 API：

```typescript
// RxJS Observable → Signal
const data = toSignal(this.dataService.getData$(), { initialValue: [] });

// Signal → RxJS Observable
const data$ = toObservable(this.mySignal);
```

推荐的架构模式：**服务层用 RxJS 处理复杂异步编排，组件层用 Signal 消费——`toSignal()` 作为两者之间的桥。** 这不是什么哲学偏好，而是纯粹的工程合理性：每个层使用最适合的工具。

## 大型应用中的 Signal 治理

当项目变得庞大后，没有规则约束的 Signal 会变成新的混乱来源。几个实用的治理原则：

**原则 1：明确所有权**
- 组件拥有 UI 状态 Signal（表单值、展开/折叠、当前选中项）
- 领域服务拥有业务状态 Signal（购物车、用户权限、当前订单）
- 基础设施服务不拥有状态，只暴露方法和 Observable

**原则 2：控制写入入口**
不要让任何组件都能直接修改共享 Signal。遵循 CQRS 思想：
- 读取通过 `computed` 或只读 Signal 暴露
- 修改通过明确命名的方法（`addItem`、`removeItem`、`updateQuantity`）
- 日志和埋点在方法里集中处理

**原则 3：Signal 调试策略**
在大型应用中追踪 Signal 的依赖链是挑战。推荐的调试方法：
- 在 `computed` 和 `effect` 里使用 Angular DevTools 的 Signal 调试面板
- 为关键 Signal 添加 `effect` 日志（仅开发环境）
- 使用 Angular ESLint 插件禁止在 computed 里执行副作用

**原则 4：避免 Signal 地狱**
不要因为 Signal 好用就把所有数据都变成 Signal。静态配置数据（如国家列表、省市区数据）用普通常量更好。只会在一个地方用到的派生数据，直接用函数计算可能比 computed 更简单。

## 小结

Angular Signal 架构的关键不是把 RxJS 全部替换掉，而是把不同类型的响应式问题放到合适的位置。Signal 负责清晰的同步状态和简单的派生关系，RxJS 继续处理复杂异步流和实时数据编排。`linkedSignal` 让"源-目标重置"模式变得更安全。对于大型应用来说，Signal 治理的核心是：明确所有权、控制写入入口、保持派生纯粹——这些原则和大规模软件工程的基本原则完全一致。2026 年的 Angular 开发者需要同时掌握 Signal 和 RxJS，知道在什么场景下用哪个，才是真正的工程成熟度。
