---
title: "Angular Signal Architecture 2026: From State Modeling to Large-App Governance"
date: 2026-06-01 09:27:36
tags:
  - Angular
  - Architecture
readingTime: 5
description: "Signals are now central to Angular architecture. This article covers local state, derived state, cross-module data flow, and governance patterns for large Angular applications."
wordCount: 724
---

Angular Signals have moved from a new feature to a core part of application architecture. They change more than state update syntax—they make data dependencies between components, services, and templates easier to see. In large applications, the value of Signals is reducing implicit subscriptions and making state changes traceable.

## Start with Local State

Not every state belongs in a global store. The 2026 best practice is to choose state containers based on lifecycle and scope:

**Component Signals**
For form inputs, dialog visibility, current tab, local filter conditions. Their lifecycle is short and dependency scope is clear—they're easier to maintain inside the component:

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
    <p>Current filter results: {{ filteredCount() }} items</p>
  `
})
export class ProductFilterComponent {
  // Local state, auto-cleaned on component destruction
  searchTerm = signal('');
  selectedCategory = signal<string | null>(null);

  // Derived state
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

The criterion is clear: **when a state is only used by the current component and its direct children, it belongs in the component.**

## Service-Layer Signals: Managing Domain State

When state needs to span multiple components, promote it to the service layer. But be deliberate about how you expose service-layer Signals:

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  // Internally writable
  private items = signal<CartItem[]>([]);

  // Externally read-only—prevent direct external mutation
  readonly itemCount = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0)
  );
  readonly totalPrice = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  readonly isEmpty = computed(() => this.items().length === 0);

  // Command methods—the only mutation entry points
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

Key design decisions in this pattern:
- **Private Signal + public computed**: External code can only read derived data
- **Command methods as mutation entry points**: Every mutation has a clear call origin, making tracing and debugging easier
- **Immutable updates**: Using `update()` with immutable operations ensures Angular change detection works correctly

## Keep Derived State Pure

`computed` is one of the most easily abused features in the Signal system. An important principle:

**computed should describe "what the data is," not "what to do when data changes."**

```typescript
// ✅ Correct: computed describes derivation
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

// ❌ Wrong: side effects in computed
readonly _badExample = computed(() => {
  analytics.track('price_changed', { price: this.price() }); // Side effect!
  localStorage.setItem('last_price', String(this.price()));   // Side effect!
  return this.price() * 1.1;
});
```

Side effects (network requests, analytics, persistence, DOM operations) belong in `effect()` or explicit service methods:

```typescript
constructor() {
  // effect is for side effects—clearly marks "something to do"
  effect(() => {
    const price = this.price();
    if (price > 0) {
      analytics.track('price_updated', { price });
    }
  });
}
```

## linkedSignal: A 2026 Power Tool

Angular introduced `linkedSignal` in 2026 to solve the common pattern of "auto-reset a derived Signal when its source Signal changes." A typical scenario:

```typescript
@Component({...})
export class ProductListComponent {
  categoryId = input.required<string>();

  // linkedSignal: when categoryId changes, auto-reset page to 1
  currentPage = linkedSignal({
    source: this.categoryId,
    computation: () => 1  // categoryId changed → back to page 1
  });

  constructor() {
    effect(() => {
      console.log(`Current category: ${this.categoryId()}, Page: ${this.currentPage()}`);
    });
  }

  goToPage(page: number) {
    this.currentPage.set(page);
  }
}
```

Before `linkedSignal`, this pattern required manually watching `categoryId` in an `effect` to reset the page number—easy to miss and hard to maintain. `linkedSignal` makes the "A changes → B resets" relationship explicit, making code intent much clearer.

## Signal and RxJS Collaboration

A common misconception is "if we use Signals, we don't need RxJS." The actual 2026 best practice: **Signals and RxJS each have their roles—using them together is optimal.**

| Scenario | Recommended Tool | Reason |
|----------|-----------------|--------|
| Synchronous state management | Signal | Concise syntax, template-friendly, auto-cleanup |
| Form state | Signal | Angular Forms now natively supports Signal |
| Complex async streams | RxJS | Operators like debounce, switchMap, combineLatest are irreplaceable |
| WebSocket real-time data | RxJS → Signal | RxJS handles the stream, `toSignal()` converts for component consumption |
| Multi-source data aggregation | RxJS | `combineLatest` offers more flexible dependency tracking |
| Simple HTTP requests | `httpResource` | New API in Angular 21+, native Signal support |

Two key interop APIs:

```typescript
// RxJS Observable → Signal
const data = toSignal(this.dataService.getData$(), { initialValue: [] });

// Signal → RxJS Observable
const data$ = toObservable(this.mySignal);
```

Recommended architecture pattern: **Service layer uses RxJS for complex async orchestration; component layer consumes via Signal—with `toSignal()` as the bridge.** This isn't philosophical preference; it's pure engineering pragmatism: each layer uses the most appropriate tool.

## Signal Governance in Large Applications

When projects grow large, ungoverned Signals become a new source of chaos. Several practical governance principles:

**Principle 1: Clear Ownership**
- Components own UI state Signals (form values, expand/collapse, current selection)
- Domain services own business state Signals (shopping cart, user permissions, current order)
- Infrastructure services own no state—they expose only methods and Observables

**Principle 2: Control Write Entry Points**
Don't let any component directly mutate shared Signals. Follow CQRS thinking:
- Expose reads through `computed` or read-only Signals
- Expose mutations through explicitly named methods (`addItem`, `removeItem`, `updateQuantity`)
- Centralize logging and analytics in those methods

**Principle 3: Signal Debugging Strategy**
Tracing Signal dependency chains in large applications is challenging. Recommended debugging approaches:
- Use Angular DevTools' Signal debugging panel with `computed` and `effect`
- Add `effect` logging for critical Signals (development environment only)
- Use Angular ESLint plugin to prohibit side effects in `computed`

**Principle 4: Avoid Signal Hell**
Don't turn everything into a Signal just because Signals are convenient. Static configuration data (country lists, province/city data) is better as plain constants. Derived data used in only one place may be simpler as a plain function rather than `computed`.

## Summary

Angular Signal Architecture is not about replacing all RxJS usage. Signals handle clear synchronous state and simple derivations; RxJS continues handling complex async streams and real-time data orchestration. `linkedSignal` makes the "source-target reset" pattern safer. For large applications, Signal governance centers on: clear ownership, controlled write entry points, and pure derivations—principles that align perfectly with fundamental software engineering practices. The 2026 Angular developer needs mastery of both Signal and RxJS, knowing which to use in each scenario—that's true engineering maturity.
