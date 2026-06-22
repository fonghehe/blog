---
title: "Angular 23 Zoneless 變更偵測深度解析"
date: 2026-06-22 14:26:50
tags:
  - Angular
readingTime: 2
description: "Angular 23 的 Zoneless 變更偵測徹底移除了 Zone.js，讓應用性能更好、除錯更清晰。本文討論 Zoneless 的工作原理、遷移策略和性能提升。"
wordCount: 321
---

Angular 23 的 Zoneless 變更偵測是 Angular 架構的一次重大革新。它移除了對 Zone.js 的依賴，讓變更偵測變得更可預測、更高效。

## Zone.js 的歷史包袱

Zone.js 從 Angular 2 開始就是變更偵測的核心：

```javascript
// Zone.js 的工作原理
Zone.current.fork({
  onInvokeTask: (delegate, zone, target, task, ...args) => {
    const result = delegate.invokeTask(target, task, ...args);
    ngZone.runOutsideAngular(() => {
      ngZone.run(() => {});
    });
    return result;
  }
});
```

Zone.js 的問題：
1. **性能開銷**：每個異步操作都可能觸發變更偵測
2. **除錯困難**：錯誤堆疊被 Zone.js 包裝
3. **不可預測**：不知道什麼時候會觸發變更偵測
4. **體積膨脹**：Zone.js 本身約 15KB

## Zoneless 工作原理

Zoneless 模式下，變更偵測由開發者明確控制：

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
    this.cdr.markForCheck();
  }
  
  constructor(private cdr: ChangeDetectorRef) {}
}
```

或使用 Signal：

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
    // Signal 自動觸發變更偵測
  }
}
```

## 從 Zone.js 遷移

遷移是漸進式的：

**步驟 1：啟用 Zoneless 模式**

```typescript
// main.ts
bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection()
  ]
});
```

**步驟 2：修復變更偵測**

```typescript
// 之前：依賴 Zone.js 自動偵測
ngOnInit() {
  this.userService.getUsers().subscribe(users => {
    this.users = users;
  });
}

// 之後：明確標記變更
ngOnInit() {
  this.userService.getUsers().subscribe(users => {
    this.users = users;
    this.cdr.markForCheck();
  });
}
```

## Zoneless 的優勢

**優勢 1：性能提升**

基準測試結果：
- 初始渲染：提升 20-30%
- 互動回應：提升 15-25%
- 內存佔用：減少 10-20%

**優勢 2：除錯更清晰**

```
// Zone.js 模式
Error at ZoneDelegate.invokeTask (zone.js:402)
  at Zone.runTask (zone.js:175)
  at Component.handleClick (component.ts:15)  // 真正的錯誤位置

// Zoneless 模式
Error at Component.handleClick (component.ts:15)  // 直接定位
```

## Signal 與 Zoneless 的配合

Signal 是 Zoneless 模式的最佳搭檔：

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
}
```

## 總結

Angular 23 的 Zoneless 變更偵測讓應用更高效、更可預測。遷移需要漸進式進行，優先使用 Signal 替代手動標記。2026 年的 Angular 開發，Zoneless 不是可選項，而是推薦的最佳實踐。
