---
title: "Angular 變更檢測：OnPush 策略最佳化效能"
date: 2019-04-16 10:45:08
tags:
  - Angular
readingTime: 1
description: "Angular 預設的變更檢測會檢查所有元件，OnPush 策略能大幅減少不必要的檢查。"
---

Angular 預設的變更檢測會檢查所有元件，OnPush 策略能大幅減少不必要的檢查。

## Default vs OnPush

```typescript
// Default：任意事件觸發時檢查整棵樹
@Component({ changeDetection: ChangeDetectionStrategy.Default })

// OnPush：僅當 Input 引用變化、事件觸發、async pipe 發出值時檢查
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
```

## 使用 OnPush 的條件

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>{{ user.name }}</div>
    <div>{{ count$ | async }}</div>
  `
})
export class UserCardComponent {
  @Input() user: User;            // 使用不可變資料
  count$ = this.store.select(selectCount);  // 使用 Observable
}
```

## 手動觸發

當確實需要手動觸發時：

```typescript
constructor(private cdr: ChangeDetectorRef) {}

refresh() {
  this.cdr.markForCheck();  // 標記當前元件到根路徑需要檢查
  // 或
  this.cdr.detectChanges(); // 立即檢查當前子樹
}
```

配合不可變資料（Immutable.js 或 Immer）使用 OnPush，可以讓 Angular 應用的渲染效能接近 React。