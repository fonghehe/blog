---
title: "Angular 23 Zoneless Change Detection Deep Dive"
date: 2026-06-22 14:26:50
tags:
  - Angular
readingTime: 2
description: "Angular 23's Zoneless change detection completely removes Zone.js, improving app performance and debugging clarity. This article discusses Zoneless's working principles, migration strategies, and performance improvements."
wordCount: 262
---

Angular 23's Zoneless change detection is a major innovation in Angular architecture. It removes the dependency on Zone.js, making change detection more predictable and efficient.

## Zone.js's Historical Burden

Zone.js has been the core of change detection since Angular 2:

```javascript
// How Zone.js works
Zone.current.fork({
  onInvokeTask: (delegate, zone, target, task, ...args) => {
    // Automatically trigger change detection before and after async tasks
    const result = delegate.invokeTask(target, task, ...args);
    ngZone.runOutsideAngular(() => {
      ngZone.run(() => {});  // Trigger change detection
    });
    return result;
  }
});
```

Zone.js's problems:
1. **Performance overhead**: Every async operation may trigger change detection
2. **Debugging difficulty**: Error stacks are wrapped by Zone.js
3. **Unpredictable**: You never know when change detection will trigger
4. **Bundle bloat**: Zone.js itself is about 15KB

## How Zoneless Works

In Zoneless mode, change detection is explicitly controlled by developers:

```typescript
@Component({
  selector: 'app-counter',
  template: `
    <div>{{ count }}</div>
    <button (click)="increment()">+1</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CounterComponent {
  count = 0;
  
  increment() {
    this.count++;
    // Need to manually mark for check
    this.cdr.markForCheck();
  }
  
  constructor(private cdr: ChangeDetectorRef) {}
}
```

Or use Signals:

```typescript
@Component({
  selector: 'app-counter',
  template: `
    <div>{{ count() }}</div>
    <button (click)="increment()">+1</button>
  `
})
export class CounterComponent {
  count = signal(0);
  
  increment() {
    this.count.update(n => n + 1);
    // Signal automatically triggers change detection
  }
}
```

## Migrating from Zone.js

Migration is incremental:

**Step 1: Enable Zoneless mode**

```typescript
// main.ts
bootstrapApplication(AppComponent, {
  providers: [
    // Disable Zone.js
    provideZonelessChangeDetection()
  ]
});
```

**Step 2: Fix change detection**

```typescript
// Before: relying on Zone.js auto-detection
ngOnInit() {
  this.userService.getUsers().subscribe(users => {
    this.users = users;  // Zone.js auto-updates
  });
}

// After: explicitly mark for check
ngOnInit() {
  this.userService.getUsers().subscribe(users => {
    this.users = users;
    this.cdr.markForCheck();  // Manual mark
  });
}
```

**Step 3: Use Signals (recommended)**

```typescript
@Component({...})
export class UserListComponent {
  users = signal<User[]>([]);
  
  ngOnInit() {
    this.userService.getUsers().subscribe(users => {
      this.users.set(users);  // Signal auto-updates
    });
  }
}
```

## Zoneless Advantages

**Advantage 1: Performance improvement**

Benchmark results:
- Initial render: 20-30% improvement
- Interaction response: 15-25% improvement
- Memory usage: 10-20% reduction

**Advantage 2: Cleaner debugging**

Zone.js wraps error stacks:

```
// Zone.js mode
Error at ZoneDelegate.invokeTask (zone.js:402)
  at Zone.runTask (zone.js:175)
  at ZoneTask.invoke (zone.js:494)
  at timer (zone.js:2295)
  at Component.handleClick (component.ts:15)  // Actual error location

// Zoneless mode
Error at Component.handleClick (component.ts:15)  // Direct location
```

**Advantage 3: More predictable**

In Zoneless mode, change detection only triggers:
- After event handler execution
- After calling `markForCheck()`
- After Signal value changes
- After explicitly calling `detectChanges()`

## Signal and Zoneless Cooperation

Signals are the best partner for Zoneless mode:

```typescript
@Component({
  selector: 'app-product-list',
  template: `
    <div *ngFor="let product of filteredProducts()">
      {{ product.name }} - {{ product.price }}
    </div>
  `
})
export class ProductListComponent {
  products = signal<Product[]>([]);
  searchTerm = signal('');
  
  filteredProducts = computed(() => {
    const term = this.searchTerm();
    return this.products().filter(p => 
      p.name.toLowerCase().includes(term.toLowerCase())
    );
  });
  
  constructor() {
    // Auto-respond to data changes
    effect(() => {
      console.log('Product count:', this.filteredProducts().length);
    });
  }
}
```

Signal advantages:
- Automatically triggers change detection
- Used directly in templates, no getter/setter needed
- Computed automatically caches, avoiding redundant calculations

## Common Pitfalls

**Pitfall 1: Forgetting to mark for check**

```typescript
// Wrong: modify data but don't mark for check
this.items.push(newItem);  // UI won't update

// Correct: mark for check
this.items.push(newItem);
this.cdr.markForCheck();
```

**Pitfall 2: Overusing markForCheck**

```typescript
// Bad practice: mark every operation
updateName() {
  this.name = 'new name';
  this.cdr.markForCheck();
}

updateEmail() {
  this.email = 'new email';
  this.cdr.markForCheck();
}

// Good practice: combine operations
updateUser() {
  this.name = 'new name';
  this.email = 'new email';
  this.cdr.markForCheck();
}
```

**Pitfall 3: Ignoring Signal's auto-update**

```typescript
// Bad practice: mix Signal and manual marking
count = signal(0);
increment() {
  this.count.update(n => n + 1);
  this.cdr.markForCheck();  // Redundant, Signal already handles it
}

// Correct: only use Signal
count = signal(0);
increment() {
  this.count.update(n => n + 1);  // Auto-updates
}
```

## Summary

Angular 23's Zoneless change detection makes applications more efficient and predictable. Migration should be done incrementally, prioritizing Signals over manual marking. In 2026 Angular development, Zoneless is not optional but a recommended best practice. It brings performance improvements, debugging enhancements, and clearer architecture.
