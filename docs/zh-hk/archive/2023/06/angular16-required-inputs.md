---
title: "Angular 16 Required Inputs 與 Input Transforms：類型安全的組件介面"
date: 2023-06-30 10:56:23
tags:
  - Angular
readingTime: 2
description: "Angular 16 對 `@Input()` 裝飾器進行了兩項重要增強：**Required Inputs**（必填輸入）和 **Input Transforms**（輸入轉換）。這兩個特性讓組件的輸入介面更接近 TypeScript 的原生類型安全，減少了運行時錯誤。"
wordCount: 372
---

Angular 16 對 `@Input()` 裝飾器進行了兩項重要增強：**Required Inputs**（必填輸入）和 **Input Transforms**（輸入轉換）。這兩個特性讓組件的輸入接口更接近 TypeScript 的原生類型安全，減少了運行時錯誤。

## Required Inputs：必填輸入

以前要表達"這個 @Input 是必須的"，隻能用類型斷言加註釋，沒有真正的編譯時檢查：

```typescript
// 舊方式：看起來必須，但不是真正的編譯時檢查
@Component({ selector: 'app-user-card', ... })
export class UserCardComponent {
  @Input() userId!: string;  // ! 隻是告訴 TS "我保證它不是 null"
  // 但調用方可以不傳，不會編譯報錯
}

// 調用方：Angular 不會報錯
<app-user-card />  // ← 沒傳 userId，運行時才出錯
```

Angular 16 的 `required: true` 選項：

```typescript
@Component({ selector: 'app-user-card', standalone: true, ... })
export class UserCardComponent {
  @Input({ required: true }) userId!: string;
  @Input({ required: true }) userName!: string;
  @Input() role = 'viewer';  // 可選，有默認值
}
```

調用方不傳必填 Input 時，**編譯時報錯**：

```html
<!-- 編譯時報錯：Required input 'userId' from component UserCardComponent must be specified -->
<app-user-card [userName]="user.name" />

<!-- 正確 -->
<app-user-card [userId]="user.id" [userName]="user.name" />
```

## Input Transforms：輸入值自動轉換

`transform` 選項允許在值到達組件之前進行轉換，解決了一個經典問題——HTML 屬性傳入的值類型問題：

```typescript
// 以前的麻煩：傳入字符串 "true" 被當成非空字符串（truthy）
// <app-button disabled="false" /> 中 disabled 仍然是 true！
@Component({ selector: 'app-button', ... })
export class ButtonComponent {
  @Input() disabled = false;
  // 調用方傳入的是字符串 "false"，不是 boolean false
}
```

Angular 16 內置的 booleanAttribute transform：

```typescript
import { booleanAttribute, numberAttribute } from "@angular/core";

@Component({
  selector: "app-button",
  standalone: true,
  template: `
    <button [disabled]="disabled" [attr.tabindex]="tabIndex">
      <ng-content></ng-content>
    </button>
  `,
})
export class ButtonComponent {
  // booleanAttribute：將字符串 "true"/"false"/"" 轉換為 boolean
  @Input({ transform: booleanAttribute }) disabled = false;

  // numberAttribute：將字符串 "42" 轉換為 number 42
  @Input({ transform: numberAttribute }) tabIndex = 0;
}
```

現在可以直接在模板中使用 HTML 風格的屬性：

```html
<!-- 這些都正確工作 -->
<app-button disabled>確認</app-button>
<app-button disabled="true">確認</app-button>
<app-button [disabled]="isDisabled">確認</app-button>

<app-button tabindex="5">跳過</app-button>
```

## 自定義 Transform 函數

```typescript
// 自定義 transform：將傳入的 userId 轉換為 User 對象
@Component({
  selector: "app-user-avatar",
  standalone: true,
  template: `<img [src]="user?.avatar" [alt]="user?.name" />`,
})
export class UserAvatarComponent {
  user: User | null = null;

  // transform 接收原始值，返回處理後的值
  @Input({
    transform: (id: string | null) =>
      id ? { id, name: `User ${id}`, avatar: `/avatars/${id}.jpg` } : null,
  })
  set userId(user: User | null) {
    this.user = user;
  }
}
```

## 與 Signal Inputs 的關係

Angular 16 還引入了 Signal-based Input（Developer Preview），提供了類似但基於 Signal 的方式：

```typescript
import { input, InputSignal } from '@angular/core';

@Component({ ... })
export class UserCardComponent {
  // Signal Input：值是一個 Signal，可以用於 computed
  userId = input.required<string>();           // 必填 Signal Input
  role = input<string>('viewer');              // 可選，默認值 'viewer'

  // 可以直接用於 computed
  displayName = computed(() => `User: ${this.userId()}`);
}
```

`@Input({ required: true })` 和 `input.required()` 的選擇：

- 現有項目遷移：用 `@Input({ required: true })` 成本低
- 新代碼/Signals 項目：用 `input.required()` 獲得完整 Signal 好處

## 總結

Required Inputs 消除了"必填屬性沒傳但運行時才報錯"的問題，Input Transforms 解決了 HTML 屬性字符串類型轉換的痛點。這兩個特性讓 Angular 組件的接口定義更精準，也更容易在模板中發現錯誤。對於維護組件庫的團隊來説，Required Inputs 是防止使用方誤用的有效工具。