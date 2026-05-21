---
title: "Angular 17.3 Output API：告别 @Output() 装饰器"
date: 2024-03-20 11:47:04
tags:
  - Angular
readingTime: 2
description: "Angular 17.3 于 2024 年 3 月 13 日发布，带来了 Output API 的开发者预览——`output()` 函数，与之前的 `input()`、`viewChild()` 等 Signal API 一起，构成了新一代 Angular 组件 API 的完整图谱。"
wordCount: 273
---

Angular 17.3 于 2024 年 3 月 13 日发布，带来了 Output API 的开发者预览——`output()` 函数，与之前的 `input()`、`viewChild()` 等 Signal API 一起，构成了新一代 Angular 组件 API 的完整图谱。

## 旧的 @Output() + EventEmitter

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
    this.countChange.emit(this.count); // 手动 emit
  }
}
```

`EventEmitter` 继承自 RxJS `Subject`，实际上是一个很重的抽象——但 Angular 的 `@Output()` 只用到了它的 `emit()` 方法，整个 Observable 能力都被浪费了。

## 新的 output() API（Angular 17.3）

```typescript
import { Component, output } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-counter",
  template: `<button (click)="increment()">+</button>`,
})
export class CounterComponent {
  // output() 返回 OutputEmitter<T>，更轻量
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

## output() 与 RxJS 互操作

`output()` 提供了与 RxJS 的互操作桥梁：

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
  // 从 Observable 创建 output（每秒发射一次）
  tick = outputFromObservable(interval(1000).pipe(map((n) => n + 1)));

  // 普通 output
  stopped = output<void>();
}

// 在父组件中，将 output 转为 Observable
@Component({
  standalone: true,
  template: `<app-timer #timer (tick)="onTick($event)" />`,
})
export class ParentComponent {
  timerRef = viewChild.required(TimerComponent);

  constructor() {
    effect(() => {
      // 将 output 转为 Observable（用于与 RxJS 生态集成）
      const tick$ = outputToObservable(this.timerRef().tick);
      tick$.subscribe((n) => console.log(`Tick: ${n}`));
    });
  }
}
```

## 完整的 Signal API 对比

```typescript
@Component({ standalone: true, selector: "app-full", template: "..." })
export class FullComponent {
  // === 输入 ===
  name = input<string>(); // 可选，Signal<string | undefined>
  title = input.required<string>(); // 必选，Signal<string>
  label = input("默认值"); // 带默认值，Signal<string>

  // 带转换的 input
  count = input(0, { transform: numberAttribute }); // 字符串属性 → 数字

  // === 输出 ===
  nameChange = output<string>(); // OutputEmitter<string>
  clicked = output<void>(); // 无参数事件

  // === 视图查询 ===
  container = viewChild<ElementRef>("container"); // Signal<ElementRef | undefined>
  requiredEl = viewChild.required<ElementRef>("el"); // Signal<ElementRef>
  allItems = viewChildren<ItemComponent>(ItemComponent); // Signal<readonly ItemComponent[]>

  // === 内容查询 ===
  slotHeader = contentChild<HeaderComponent>(HeaderComponent);
  slotItems = contentChildren<ItemComponent>(ItemComponent);

  // === 派生值 ===
  displayName = computed(() => this.name()?.toUpperCase() ?? "匿名");
}
```

## 为什么不直接用 Signal 做双向绑定？

一个常见问题：既然有了 `input()` Signal，能否用同一个 Signal 同时做输入和输出（双向绑定）？

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
  // model() 同时充当 input 和 output
  checked = model(false); // 等价于 input() + output('checkedChange')
}

// 父组件使用
@Component({
  standalone: true,
  template: `<app-checkbox [(checked)]="isChecked" />`,
})
export class ParentComponent {
  isChecked = signal(false);
}
```

## 总结

Angular 17.3 完成了组件 API 的 Signal 化拼图：`input()`（17.1）、Signal Queries（17.2）、`output()` 和 `model()`（17.3）。新的 API 比装饰器更简洁、类型更安全，而且对 tree-shaking 更友好（不需要 `EventEmitter`）。目前仍是开发者预览阶段，Angular 18 预计将这些 API 正式稳定化。