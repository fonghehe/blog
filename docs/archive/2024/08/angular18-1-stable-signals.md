---
title: "Angular 18.1：Signal Inputs/Outputs/Queries 全面稳定"
date: 2024-08-02 10:00:00
tags:
  - Angular
  - 性能优化
---

Angular 18.1 于 2024 年 7 月 10 日发布，最重要的变化是将此前处于开发者预览阶段的 **Signal-based Inputs、Outputs 和 Queries 全部提升为稳定 API**。这意味着从 18.1 起，可以在生产环境中放心使用这套全新的组件 API，无需担心 breaking change。

## 正式稳定的 Signal API 清单

```typescript
import {
  // 输入（18.1 稳定）
  input,
  model,

  // 输出（18.1 稳定）
  output,
  outputFromObservable,
  outputToObservable,

  // 视图查询（18.1 稳定）
  viewChild,
  viewChildren,

  // 内容查询（18.1 稳定）
  contentChild,
  contentChildren,
} from "@angular/core";
```

## 完整的 Signal 组件示例

以下是一个使用全套新 API 的实际组件：

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
  // 输入
  placeholder = input("请选择");
  disabled = input(false);

  // 双向绑定（input + output 的组合）
  value = model<T | null>(null);

  // 输出
  opened = output<void>();
  closed = output<void>();

  // 查询
  container = viewChild.required<ElementRef>("container");
  options = contentChildren<OptionComponent<T>>(OptionComponent);

  // 派生状态
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

父组件使用：

```html
<app-select [(value)]="selectedUser" placeholder="选择用户">
  @for (user of users(); track user.id) {
  <app-option [value]="user" [label]="user.name" />
  }
</app-select>
```

## 迁移指南：从装饰器到 Signal API

Angular 18.1 提供了自动迁移 schematic：

```bash
# 自动将装饰器 API 迁移到 Signal API
ng generate @angular/core:signal-input-migration
ng generate @angular/core:signal-queries-migration
ng generate @angular/core:output-migration
```

手动迁移对照：

```typescript
// === 迁移前（装饰器风格）===
@Component({ ... })
export class OldComponent {
  @Input() title: string = '';
  @Input({ required: true }) id!: string;
  @Output() clicked = new EventEmitter<void>();
  @ViewChild('el') el?: ElementRef;
  @ContentChildren(ItemComponent) items!: QueryList<ItemComponent>;
}

// === 迁移后（Signal 风格）===
@Component({ ... })
export class NewComponent {
  title = input('');
  id = input.required<string>();
  clicked = output<void>();
  el = viewChild<ElementRef>('el');
  items = contentChildren(ItemComponent);
}
```

## Signal API 的性能优势

Signal API 对变更检测更友好，特别是配合 `OnPush` 或未来的 Zoneless 模式：

```typescript
// Signal Inputs 自动参与 Signal 依赖追踪
// Angular 无需通过 zone.js 脏检查来发现 input 变化
// 而是精确知道哪些 input 变了，只更新受影响的组件

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ displayName() }}`,
})
export class UserCardComponent {
  user = input.required<User>();

  // 仅当 user() 变化时重新计算
  displayName = computed(
    () => `${this.user().firstName} ${this.user().lastName}`,
  );
}
```

## 总结

Angular 18.1 是新 Signal API 从"可以尝鲜"到"可以放心用于生产"的分水岭。对于正在开发的新项目，现在是全面切换到 Signal API 的好时机；对于维护中的老项目，可以用官方 migration schematic 逐步迁移。Angular 朝着更简洁、更类型安全、更高性能的方向走得更坚定了。
