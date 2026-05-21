---
title: "Angular 18.1：Signal Inputs/Outputs/Queries 全面穩定"
date: 2024-08-02 10:00:00
tags:
  - Angular
  - 性能優化
readingTime: 2
description: "Angular 18.1 於 2024 年 7 月 10 日發佈，最重要的變化是將此前處於開發者預覽階段的 **Signal-based Inputs、Outputs 和 Queries 全部提升為穩定 API**。這意味着從 18.1 起，可以在生產環境中放心使用這套全新的組件 API，無需擔心 breaking c"
wordCount: 276
---

Angular 18.1 於 2024 年 7 月 10 日發佈，最重要的變化是將此前處於開發者預覽階段的 **Signal-based Inputs、Outputs 和 Queries 全部提升為穩定 API**。這意味着從 18.1 起，可以在生產環境中放心使用這套全新的組件 API，無需擔心 breaking change。

## 正式穩定的 Signal API 清單

```typescript
import {
  // 輸入（18.1 穩定）
  input,
  model,

  // 輸出（18.1 穩定）
  output,
  outputFromObservable,
  outputToObservable,

  // 視圖查詢（18.1 穩定）
  viewChild,
  viewChildren,

  // 內容查詢（18.1 穩定）
  contentChild,
  contentChildren,
} from "@angular/core";
```

## 完整的 Signal 組件示例

以下是一個使用全套新 API 的實際組件：

```typescript
import {
  Component,
  input,
  output,
  model,
  viewChild,
  contentChildren,
  computed,
  effect,
  ElementRef,
} from "@angular/core";

@Component({
  standalone: true,
  selector: "app-select",
  template: `
    <div class="select-container" #container>
      <button (click)="toggle()">
        {{ selectedLabel() }}
      </button>
      @if (isOpen()) {
        <div class="dropdown">
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class SelectComponent<T> {
  // 輸入
  placeholder = input("請選擇");
  disabled = input(false);

  // 雙向綁定（input + output 的組合）
  value = model<T | null>(null);

  // 輸出
  opened = output<void>();
  closed = output<void>();

  // 查詢
  container = viewChild.required<ElementRef>("container");
  options = contentChildren<OptionComponent<T>>(OptionComponent);

  // 派生狀態
  isOpen = signal(false);

  selectedLabel = computed(() => {
    const current = this.value();
    if (current === null) return this.placeholder();
    const matched = this.options().find((o) => o.value() === current);
    return matched?.label() ?? String(current);
  });

  toggle() {
    if (this.disabled()) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.opened.emit();
    } else {
      this.closed.emit();
    }
  }
}

@Component({
  standalone: true,
  selector: "app-option",
  template: `<div (click)="select()">{{ label() }}</div>`,
})
export class OptionComponent<T> {
  value = input.required<T>();
  label = input.required<string>();
}
```

父組件使用：

```html
<app-select [(value)]="selectedUser" placeholder="選擇用户">
  @for (user of users(); track user.id) {
  <app-option [value]="user" [label]="user.name" />
  }
</app-select>
```

## 遷移指南：從裝飾器到 Signal API

Angular 18.1 提供了自動遷移 schematic：

```bash
# 自動將裝飾器 API 遷移到 Signal API
ng generate @angular/core:signal-input-migration
ng generate @angular/core:signal-queries-migration
ng generate @angular/core:output-migration
```

手動遷移對照：

```typescript
// === 遷移前（裝飾器風格）===
@Component({ ... })
export class OldComponent {
  @Input() title: string = '';
  @Input({ required: true }) id!: string;
  @Output() clicked = new EventEmitter<void>();
  @ViewChild('el') el?: ElementRef;
  @ContentChildren(ItemComponent) items!: QueryList<ItemComponent>;
}

// === 遷移後（Signal 風格）===
@Component({ ... })
export class NewComponent {
  title = input('');
  id = input.required<string>();
  clicked = output<void>();
  el = viewChild<ElementRef>('el');
  items = contentChildren(ItemComponent);
}
```

## Signal API 的性能優勢

Signal API 對變更檢測更友好，特別是配合 `OnPush` 或未來的 Zoneless 模式：

```typescript
// Signal Inputs 自動參與 Signal 依賴追蹤
// Angular 無需通過 zone.js 髒檢查來發現 input 變化
// 而是精確知道哪些 input 變了，只更新受影響的組件

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ displayName() }}`,
})
export class UserCardComponent {
  user = input.required<User>();

  // 僅當 user() 變化時重新計算
  displayName = computed(
    () => `${this.user().firstName} ${this.user().lastName}`,
  );
}
```

## 總結

Angular 18.1 是新 Signal API 從"可以嚐鮮"到"可以放心用於生產"的分水嶺。對於正在開發的新項目，現在是全面切換到 Signal API 的好時機；對於維護中的老項目，可以用官方 migration schematic 逐步遷移。Angular 朝着更簡潔、更類型安全、更高性能的方向走得更堅定了。
