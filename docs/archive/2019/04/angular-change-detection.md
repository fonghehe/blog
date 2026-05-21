---
title: "Angular 变更检测：OnPush 策略优化性能"
date: 2019-04-16 10:45:08
tags:
  - Angular
readingTime: 1
description: "Angular 默认的变更检测会检查所有组件，OnPush 策略能大幅减少不必要的检查。"
wordCount: 81
---

Angular 默认的变更检测会检查所有组件，OnPush 策略能大幅减少不必要的检查。

## Default vs OnPush

```typescript
// Default：任意事件触发时检查整棵树
@Component({ changeDetection: ChangeDetectionStrategy.Default })

// OnPush：仅当 Input 引用变化、事件触发、async pipe 发出值时检查
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
```

## 使用 OnPush 的条件

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>{{ user.name }}</div>
    <div>{{ count$ | async }}</div>
  `
})
export class UserCardComponent {
  @Input() user: User;            // 使用不可变数据
  count$ = this.store.select(selectCount);  // 使用 Observable
}
```

## 手动触发

当确实需要手动触发时：

```typescript
constructor(private cdr: ChangeDetectorRef) {}

refresh() {
  this.cdr.markForCheck();  // 标记当前组件到根路径需要检查
  // 或
  this.cdr.detectChanges(); // 立即检查当前子树
}
```

配合不可变数据（Immutable.js 或 Immer）使用 OnPush，可以让 Angular 应用的渲染性能接近 React。