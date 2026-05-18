---
title: "Angular 17.3 Output API：告別 @Output() 裝飾器"
date: 2024-03-20 11:47:04
tags:
  - Angular
readingTime: 2
description: "Angular 17.3 於 2024 年 3 月 13 日發佈，帶來了 Output API 的開發者預覽——`output()` 函數，與之前的 `input()`、`viewChild()` 等 Signal API 一起，構成了新一代 Angular 組件 API 的完整圖譜。"
---

Angular 17.3 於 2024 年 3 月 13 日發佈，帶來了 Output API 的開發者預覽——`output()` 函數，與之前的 `input()`、`viewChild()` 等 Signal API 一起，構成了新一代 Angular 組件 API 的完整圖譜。

## 舊的 @Output() + EventEmitter

```typescript
import { Component, Output, EventEmitter } from "@angular/core";

@Component({
  selector: "app-counter",
  template: `<button (click)="increment()">+</button>`,
})
export class CounterComponent {
  @Output() countChange = new EventEmitter<number>();
  private count = 0;

  increment() {
    this.count++;
    this.countChange.emit(this.count); // 手動 emit
  }
}
```

`EventEmitter` 繼承自 RxJS `Subject`，實際上是一個很重的抽象——但 Angular 的 `@Output()` 只用到了它的 `emit()` 方法，整個 Observable 能力都被浪費了。

## 新的 output() API（Angular 17.3）

```typescript
import { Component, output } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-counter",
  template: `<button (click)="increment()">+</button>`,
})
export class CounterComponent {
  // output() 返回 OutputEmitter<T>，更輕量
  countChange = output<number>();
  private count = 0;

  increment() {
    this.count++;
    this.countChange.emit(this.count); // 用法相同
  }
}
```

模板中使用方式完全相同：

```html
<app-counter (countChange)="onCountChange($event)" />
```

## output() 與 RxJS 互操作

`output()` 提供了與 RxJS 的互操作橋樑：

```typescript
import {
  Component,
  output,
  outputFromObservable,
  outputToObservable,
} from "@angular/core";
import { interval, Subject } from "rxjs";
import { map } from "rxjs/operators";

@Component({ standalone: true, selector: "app-timer", template: "" })
export class TimerComponent {
  // 從 Observable 創建 output（每秒發射一次）
  tick = outputFromObservable(interval(1000).pipe(map((n) => n + 1)));

  // 普通 output
  stopped = output<void>();
}

// 在父組件中，將 output 轉為 Observable
@Component({
  standalone: true,
  template: `<app-timer #timer (tick)="onTick($event)" />`,
})
export class ParentComponent {
  timerRef = viewChild.required(TimerComponent);

  constructor() {
    effect(() => {
      // 將 output 轉為 Observable（用於與 RxJS 生態集成）
      const tick$ = outputToObservable(this.timerRef().tick);
      tick$.subscribe((n) => console.log(`Tick: ${n}`));
    });
  }
}
```

## 完整的 Signal API 對比

```typescript
@Component({ standalone: true, selector: "app-full", template: "..." })
export class FullComponent {
  // === 輸入 ===
  name = input<string>(); // 可選，Signal<string | undefined>
  title = input.required<string>(); // 必選，Signal<string>
  label = input("默認值"); // 帶默認值，Signal<string>

  // 帶轉換的 input
  count = input(0, { transform: numberAttribute }); // 字符串屬性 → 數字

  // === 輸出 ===
  nameChange = output<string>(); // OutputEmitter<string>
  clicked = output<void>(); // 無參數事件

  // === 視圖查詢 ===
  container = viewChild<ElementRef>("container"); // Signal<ElementRef | undefined>
  requiredEl = viewChild.required<ElementRef>("el"); // Signal<ElementRef>
  allItems = viewChildren<ItemComponent>(ItemComponent); // Signal<readonly ItemComponent[]>

  // === 內容查詢 ===
  slotHeader = contentChild<HeaderComponent>(HeaderComponent);
  slotItems = contentChildren<ItemComponent>(ItemComponent);

  // === 派生值 ===
  displayName = computed(() => this.name()?.toUpperCase() ?? "匿名");
}
```

## 為什麼不直接用 Signal 做雙向綁定？

一個常見問題：既然有了 `input()` Signal，能否用同一個 Signal 同時做輸入和輸出（雙向綁定）？

答案是 `model()` API（Angular 17.3 同步引入）：

```typescript
import { Component, model } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-checkbox",
  template: `<input
    type="checkbox"
    [checked]="checked()"
    (change)="checked.set($event.target.checked)"
  />`,
})
export class CheckboxComponent {
  // model() 同時充當 input 和 output
  checked = model(false); // 等價於 input() + output('checkedChange')
}

// 父組件使用
@Component({
  standalone: true,
  template: `<app-checkbox [(checked)]="isChecked" />`,
})
export class ParentComponent {
  isChecked = signal(false);
}
```

## 總結

Angular 17.3 完成了組件 API 的 Signal 化拼圖：`input()`（17.1）、Signal Queries（17.2）、`output()` 和 `model()`（17.3）。新的 API 比裝飾器更簡潔、類型更安全，而且對 tree-shaking 更友好（不需要 `EventEmitter`）。目前仍是開發者預覽階段，Angular 18 預計將這些 API 正式穩定化。