---
title: "Angular 17.3 Output API：@Output() デコレーターとの決別"
date: 2024-03-20 11:47:04
tags:
  - Angular
readingTime: 3
description: "Angular 17.3 は2024年3月13日にリリースされ、Output API の開発者プレビューがもたらされました——output() 関数です。これまでの input() や viewChild() などの Signal API と合わせて、次世代 Angular コンポーネント API の完全な全体像を構成します。"
wordCount: 410
---

Angular 17.3 は 2024 年 3 月 13 日にリリースされ、Output API の開発者プレビューである `output()` 関数が導入されました。これまでの `input()`、`viewChild()` などの Signal API と合わせて、次世代の Angular コンポーネント API の完全な全体像を構成します。

## 旧 @Output() + EventEmitter

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
    this.countChange.emit(this.count); // 手動で emit
  }
}
```

`EventEmitter` は RxJS の `Subject` を継承しており、実際には非常に重い抽象化ですが、Angular の `@Output()` はその `emit()` メソッドしか使用しておらず、Observable の機能全体が無駄になっています。

## 新しい output() API（Angular 17.3）

```typescript
import { Component, output } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-counter",
  template: `<button (click)="increment()">+</button>`,
})
export class CounterComponent {
  // output() は OutputEmitter<T> を返し、より軽量
  countChange = output<number>();
  private count = 0;

  increment() {
    this.count++;
    this.countChange.emit(this.count); // 用法相同
  }
}
```

テンプレートでの使用方法は完全に同じです：

```html
<app-counter (countChange)="onCountChange($event)" />
```

## output() と RxJS の相互運用

`output()` は RxJS との相互運用の橋渡しを提供します：

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
  // Observable から output を作成（毎秒1回発行）
  tick = outputFromObservable(interval(1000).pipe(map((n) => n + 1)));

  // 通常の output
  stopped = output<void>();
}

// 親コンポーネントで、output を Observable に変換
@Component({
  standalone: true,
  template: `<app-timer #timer (tick)="onTick($event)" />`,
})
export class ParentComponent {
  timerRef = viewChild.required(TimerComponent);

  constructor() {
    effect(() => {
      // output を Observable に変換（RxJS エコシステムとの統合用）
      const tick$ = outputToObservable(this.timerRef().tick);
      tick$.subscribe((n) => console.log(`Tick: ${n}`));
    });
  }
}
```

## Signal API の完全比較

```typescript
@Component({ standalone: true, selector: "app-full", template: "..." })
export class FullComponent {
  // === 入力 ===
  name = input<string>(); // オプション、Signal<string | undefined>
  title = input.required<string>(); // 必須、Signal<string>
  label = input("デフォルト値"); // デフォルト値あり、Signal<string>

  // 変換付き input
  count = input(0, { transform: numberAttribute }); // 文字列属性 → 数値

  // === 出力 ===
  nameChange = output<string>(); // OutputEmitter<string>
  clicked = output<void>(); // 引数なしイベント

  // === ビュー問い合わせ ===
  container = viewChild<ElementRef>("container"); // Signal<ElementRef | undefined>
  requiredEl = viewChild.required<ElementRef>("el"); // Signal<ElementRef>
  allItems = viewChildren<ItemComponent>(ItemComponent); // Signal<readonly ItemComponent[]>

  // === コンテンツ問い合わせ ===
  slotHeader = contentChild<HeaderComponent>(HeaderComponent);
  slotItems = contentChildren<ItemComponent>(ItemComponent);

  // === 派生値 ===
  displayName = computed(() => this.name()?.toUpperCase() ?? "匿名");
}
```

## なぜ Signal を双方向バインディングに使わないのか？

よくある質問：`input()` Signal があるなら、同じ Signal で入力と出力（双方向バインディング）を同時にできるのでは？

答えは `model()` API（Angular 17.3 で同時に導入）です：

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

## まとめ

Angular 17.3 はコンポーネント API の Signal 化のパズルを完成させました：`input()`（17.1）、Signal Queries（17.2）、`output()` と `model()`（17.3）。新しい API はデコレーターよりも簡潔で、型安全性が高く、tree-shaking にもより適しています（`EventEmitter` が不要）。現在はまだ開発者プレビュー段階であり、Angular 18 でこれらの API が正式に安定化される予定です。