---
title: "Angular 16 Required Inputs と Input Transforms：型安全なコンポーネントインターフェース"
date: 2023-06-30 10:56:23
tags:
  - Angular
readingTime: 2
description: "Angular 16 对 `@Input()` 装饰器进行了两项重要增强：**Required Inputs**（必填输入）和 **Input Transforms**（输入转换）。这两个特性让组件的输入接口更接近 TypeScript 的原生类型安全，减少了运行时错误。"
---

Angular 16 对 `@Input()` 装饰器进行了两项重要增强：**Required Inputs**（必填输入）和 **Input Transforms**（输入转换）。这两个特性让组件的输入接口更接近 TypeScript 的原生类型安全，减少了运行时错误。

## Required Inputs：必須入力

以前要表达"这个 @Input 是必须的"，只能用类型断言加注释，没有真正的编译时检查：

```typescript
// 旧方式：看起来必须，但不是真正的编译时检查
@Component({ selector: 'app-user-card', ... })
export class UserCardComponent {
  @Input() userId!: string;  // ! 只是告诉 TS "我保证它不是 null"
  // 但调用方可以不传，不会编译报错
}

// 调用方：Angular 不会报错
<app-user-card />  // ← 没传 userId，运行时才出错
```

Angular 16 的 `required: true` 选项：

```typescript
@Component({ selector: 'app-user-card', standalone: true, ... })
export class UserCardComponent {
  @Input({ required: true }) userId!: string;
  @Input({ required: true }) userName!: string;
  @Input() role = 'viewer';  // 可选，有默认值
}
```

调用方不传必填 Input 时，**编译时报错**：

```html
<!-- 编译时报错：Required input 'userId' from component UserCardComponent must be specified -->
<app-user-card [userName]="user.name" />

<!-- 正确 -->
<app-user-card [userId]="user.id" [userName]="user.name" />
```

## Input Transforms：入力値の自動変換

`transform` 选项允许在值到达组件之前进行转换，解决了一个经典问题——HTML 属性传入的值类型问题：

```typescript
// 以前的麻烦：传入字符串 "true" 被当成非空字符串（truthy）
// <app-button disabled="false" /> 中 disabled 仍然是 true！
@Component({ selector: 'app-button', ... })
export class ButtonComponent {
  @Input() disabled = false;
  // 调用方传入的是字符串 "false"，不是 boolean false
}
```

Angular 16 内置的 booleanAttribute transform：

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
  // booleanAttribute：将字符串 "true"/"false"/"" 转换为 boolean
  @Input({ transform: booleanAttribute }) disabled = false;

  // numberAttribute：将字符串 "42" 转换为 number 42
  @Input({ transform: numberAttribute }) tabIndex = 0;
}
```

现在可以直接在模板中使用 HTML 风格的属性：

```html
<!-- 这些都正确工作 -->
<app-button disabled>确认</app-button>
<app-button disabled="true">确认</app-button>
<app-button [disabled]="isDisabled">确认</app-button>

<app-button tabindex="5">跳过</app-button>
```

## カスタム Transform 関数

```typescript
// 自定义 transform：将传入的 userId 转换为 User 对象
@Component({
  selector: "app-user-avatar",
  standalone: true,
  template: `<img [src]="user?.avatar" [alt]="user?.name" />`,
})
export class UserAvatarComponent {
  user: User | null = null;

  // transform 接收原始值，返回处理后的值
  @Input({
    transform: (id: string | null) =>
      id ? { id, name: `User ${id}`, avatar: `/avatars/${id}.jpg` } : null,
  })
  set userId(user: User | null) {
    this.user = user;
  }
}
```

## Signal Inputs との関係

Angular 16 还引入了 Signal-based Input（Developer Preview），提供了类似但基于 Signal 的方式：

```typescript
import { input, InputSignal } from '@angular/core';

@Component({ ... })
export class UserCardComponent {
  // Signal Input：值是一个 Signal，可以用于 computed
  userId = input.required<string>();           // 必填 Signal Input
  role = input<string>('viewer');              // 可选，默认值 'viewer'

  // 可以直接用于 computed
  displayName = computed(() => `User: ${this.userId()}`);
}
```

`@Input({ required: true })` 和 `input.required()` 的选择：

- 现有项目迁移：用 `@Input({ required: true })` 成本低
- 新代码/Signals 项目：用 `input.required()` 获得完整 Signal 好处

## まとめ

Required Inputs 消除了"必填属性没传但运行时才报错"的问题，Input Transforms 解决了 HTML 属性字符串类型转换的痛点。这两个特性让 Angular 组件的接口定义更精准，也更容易在模板中发现错误。对于维护组件库的团队来说，Required Inputs 是防止使用方误用的有效工具。