---
title: "Angular 18.2 linkedSignal: New Primitive for Reactive Dependent Signals"
date: 2024-09-11 11:45:22
tags:
  - Angular
readingTime: 2
description: "Angular 18.2 于 2024 年 8 月 14 日发布，引入了 `linkedSignal()`——一个实验性的新 Signal 原语。它解决了 `computed()` 和可写 `signal()` 之间长期存在的一个痛点：**如何创建一个既能从外部源派生初始值，又允许本地修改的 Signal**。"
wordCount: 279
---

Angular 18.2 于 2024 年 8 月 14 日发布，引入了 `linkedSignal()`——一个实验性的新 Signal 原语。它解决了 `computed()` 和可写 `signal()` 之间长期存在的一个痛点：**如何创建一个既能从外部源派生初始值，又允许本地修改的 Signal**。

## Problem Background

在 Angular Signals 中，`computed()` 的值是只读的（不能 `.set()`），而普通 `signal()` 不能自动追踪依赖。两者之间有一个gap：

```typescript
// ❌ computed() 是只读的
const selectedId = computed(() => props.items()[0]?.id);
// selectedId.set(...) → 报错！

// ❌ signal() 不能跟随 props 变化自动更新
const selectedId = signal(props.items()[0]?.id);
// 当 props.items() 变化时，selectedId 不会自动更新

// 以前的变通方案：effect() 手动同步
effect(() => {
  selectedId.set(props.items()[0]?.id); // 繁琐，且 effect 有副作用语义
});
```

## linkedSignal() Solution

```typescript
import { Component, input, signal, linkedSignal } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-list-selector",
  template: `
    <ul>
      @for (item of items(); track item.id) {
        <li
          [class.selected]="selectedId() === item.id"
          (click)="selectedId.set(item.id)"
        >
          {{ item.name }}
        </li>
      }
    </ul>
  `,
})
export class ListSelectorComponent {
  items = input.required<{ id: string; name: string }[]>();

  // linkedSignal：当 items() 变化时，自动重置为第一个元素的 id
  // 但用户点击选择后，可以本地修改
  selectedId = linkedSignal(() => this.items()[0]?.id ?? null);

  // 用户可以修改：selectedId.set('other-id')
  // 当 items() 变化时，自动重置为新列表的第一个元素
}
```

## Advanced Usage: Derived with Previous Value

`linkedSignal()` 支持访问前一个值，实现更复杂的逻辑：

```typescript
@Component({ standalone: true, ... })
export class PaginatedListComponent {
  items = input.required<Item[]>();
  pageSize = input(10);

  // 当 items 变化时重置到第 1 页；当 pageSize 变化时，尝试保持在合理范围内
  currentPage = linkedSignal<number>({
    source: () => ({ items: this.items(), pageSize: this.pageSize() }),
    computation: (source, previous) => {
      const maxPage = Math.ceil(source.items.length / source.pageSize);
      if (!previous) return 1;  // 初始化
      // 保持当前页，但不超过最大页数
      return Math.min(previous.value, maxPage);
    }
  });

  totalPages = computed(() =>
    Math.ceil(this.items().length / this.pageSize())
  );
}
```

## linkedSignal vs computed vs signal

```
signal()
  + 可写（.set(), .update()）
  - 不追踪依赖，不会自动更新
  用途：独立的本地状态

computed()
  + 自动追踪依赖，响应式更新
  - 只读，不可手动修改
  用途：从其他 Signal 派生的只读值

linkedSignal()  ← 新增
  + 从 Signal 派生初始值（类似 computed）
  + 可写，允许本地修改（类似 signal）
  - 当源 Signal 变化时，本地修改会被重置
  用途：有"默认值来自外部，但用户可覆盖"语义的状态
```

## Common Use Cases

```typescript
// 场景 1：表单字段的默认值来自 props，用户可修改
editName = linkedSignal(() => this.user().name);

// 场景 2：多选时，外部列表变化时清空选中
selectedIds = linkedSignal<Set<string>>({
  source: this.items,
  computation: () => new Set(), // 列表变化时清空
});

// 场景 3：分页器，数据源变化时回到第 1 页
page = linkedSignal<number>({
  source: () => this.query(),
  computation: (_, prev) => (prev ? 1 : 1),
});
```

## Note: Experimental API

`linkedSignal()` 在 Angular 18.2 中仍是**实验性**（experimental）API，标记为 `@experimental`。不排除在未来版本中有 API 调整。预计 Angular 19 会进一步稳定它。

```typescript
// 当前导入路径中带有实验标记
import { linkedSignal } from "@angular/core";
// 使用时 IDE 会提示这是实验性 API，需自行判断是否在生产中使用
```

## Summary

`linkedSignal()` 填补了 Angular Signals 原语体系中的一个重要空缺——"可变的派生信号"。它让"选中项跟随列表变化重置，但用户操作优先"这类常见 UI 模式有了优雅的表达方式。配合 Angular 18.1 已稳定的 Signal API，Angular 的响应式模型正在变得越来越完整。
