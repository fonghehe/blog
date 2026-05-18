---
title: "Angular 17.2：Signal-based Queries 開發者預覽"
date: 2024-02-14 11:13:38
tags:
  - Angular
readingTime: 2
description: "Angular 17.2 於 2024 年 2 月 14 日發佈，帶來了 Signal-based Queries 的開發者預覽。繼 Angular 17.1 引入 Signal Inputs（`input()` 函數）之後，17.2 將 Signal 化範圍擴展到了模板查詢：`viewChild()`、`viewCh"
---

Angular 17.2 於 2024 年 2 月 14 日發佈，帶來了 Signal-based Queries 的開發者預覽。繼 Angular 17.1 引入 Signal Inputs（`input()` 函數）之後，17.2 將 Signal 化範圍擴展到了模板查詢：`viewChild()`、`viewChildren()`、`contentChild()`、`contentChildren()`。

這是 Angular 團隊將整個組件 API 遷移到 Signal 體系的重要一步。

## 舊的裝飾器查詢

```typescript
import {
  Component,
  ViewChild,
  ContentChild,
  ElementRef,
  AfterViewInit,
} from "@angular/core";

@Component({
  selector: "app-demo",
  template: `<div #container>...</div>`,
})
export class OldDemoComponent implements AfterViewInit {
  @ViewChild("container") container!: ElementRef; // 初始為 undefined，AfterViewInit 後才有值
  @ContentChild("slot") slot?: ElementRef;

  ngAfterViewInit() {
    // 必須等 AfterViewInit 才能訪問
    console.log(this.container.nativeElement);
  }
}
```

這種方式有個痛點：查詢結果不是響應式的，在 `ngAfterViewInit` 之前訪問會得到 `undefined`，並且無法被 `computed()` 或 `effect()` 追蹤到。

## Signal-based Queries（Angular 17.2）

```typescript
import {
  Component,
  viewChild,
  viewChildren,
  contentChild,
  ElementRef,
  signal,
} from "@angular/core";

@Component({
  standalone: true,
  selector: "app-demo",
  template: `
    <div #container>...</div>
    <button #btn *ngFor="let b of buttons()">{{ b }}</button>
  `,
})
export class NewDemoComponent {
  // viewChild 返回 Signal<ElementRef | undefined>
  container = viewChild<ElementRef>("container");

  // required：如果元素不存在會拋出錯誤，返回 Signal<ElementRef>（非 undefined）
  containerRequired = viewChild.required<ElementRef>("container");

  // viewChildren 返回 Signal<readonly ElementRef[]>
  buttons = viewChildren<ElementRef>("btn");

  // 可以在 constructor 中直接使用（不需要等 AfterViewInit）
  // 但注意：在組件掛載前，viewChild() 值是 undefined
  constructor() {
    // effect 中自動追蹤
    effect(() => {
      const el = this.container();
      if (el) {
        console.log("container mounted:", el.nativeElement);
      }
    });
  }
}
```

## contentChild 和 contentChildren

```typescript
@Component({
  standalone: true,
  selector: "app-panel",
  template: `<ng-content></ng-content>`,
})
export class PanelComponent {
  // 查詢投影進來的內容
  header = contentChild<HeaderComponent>(HeaderComponent);
  items = contentChildren<ItemComponent>(ItemComponent);

  constructor() {
    // 當 items 變化時自動響應
    effect(() => {
      console.log(`Panel has ${this.items().length} items`);
    });
  }
}

// 使用 PanelComponent
@Component({
  template: `
    <app-panel>
      <app-header>Title</app-header>
      <app-item *ngFor="let i of list">{{ i }}</app-item>
    </app-panel>
  `,
})
export class AppComponent {}
```

## Signal Queries 與 computed() 組合

這是 Signal-based Queries 最大的優勢——可以派生計算值：

```typescript
@Component({
  standalone: true,
  selector: "app-form",
  template: `
    <input #nameInput type="text" />
    <input #emailInput type="email" />
    <button [disabled]="!isFormValid()">提交</button>
  `,
})
export class FormComponent {
  nameInput = viewChild.required<ElementRef<HTMLInputElement>>("nameInput");
  emailInput = viewChild.required<ElementRef<HTMLInputElement>>("emailInput");

  // 基於 DOM 查詢派生計算值
  isFormValid = computed(() => {
    const name = this.nameInput().nativeElement.value;
    const email = this.emailInput().nativeElement.value;
    return name.length > 0 && email.includes("@");
  });
}
```

## Angular 17.x Signal 化路線圖

```
Angular 17.0 (2023-11)  Signals 開發者預覽 → 穩定
                         signal(), computed(), effect()

Angular 17.1 (2024-01)  Signal Inputs
                         input(), input.required()

Angular 17.2 (2024-02)  Signal Queries  ← 本文
                         viewChild(), viewChildren(), contentChild(), contentChildren()

Angular 17.3 (預計 03)  Output API
                         output(), output.required()

Angular 18.0 (預計 05)  Zoneless 變更檢測（實驗性）
                         全面 Signal 化組件
```

## 與舊裝飾器的兼容性

Angular 17.2 的 Signal Queries 是**開發者預覽**階段，API 可能在正式版中有調整。舊的 `@ViewChild`、`@ContentChild` 等裝飾器繼續工作，不會被廢棄（至少在 Angular 18 之前）。可以在新組件中逐步採用 Signal Queries，無需全量遷移。

## 總結

Angular 17.2 的 Signal Queries 讓模板查詢也融入了響應式體系，消除了 `ngAfterViewInit` 生命週期鈎子的依賴，並讓查詢結果可以直接參與 `computed()` 推導鏈。配合 Signal Inputs，Angular 組件的數據流正在變得更像純函數：輸入 → 信號 → 模板，大幅降低心智負擔。