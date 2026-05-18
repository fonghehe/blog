---
title: "Angular 17.2：Signal-based Queries 开发者预览"
date: 2024-02-14 11:13:38
tags:
  - Angular
readingTime: 2
description: "Angular 17.2 于 2024 年 2 月 14 日发布，带来了 Signal-based Queries 的开发者预览。继 Angular 17.1 引入 Signal Inputs（`input()` 函数）之后，17.2 将 Signal 化范围扩展到了模板查询：`viewChild()`、`viewCh"
---

Angular 17.2 于 2024 年 2 月 14 日发布，带来了 Signal-based Queries 的开发者预览。继 Angular 17.1 引入 Signal Inputs（`input()` 函数）之后，17.2 将 Signal 化范围扩展到了模板查询：`viewChild()`、`viewChildren()`、`contentChild()`、`contentChildren()`。

这是 Angular 团队将整个组件 API 迁移到 Signal 体系的重要一步。

## 旧的装饰器查询

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
  @ViewChild("container") container!: ElementRef; // 初始为 undefined，AfterViewInit 后才有值
  @ContentChild("slot") slot?: ElementRef;

  ngAfterViewInit() {
    // 必须等 AfterViewInit 才能访问
    console.log(this.container.nativeElement);
  }
}
```

这种方式有个痛点：查询结果不是响应式的，在 `ngAfterViewInit` 之前访问会得到 `undefined`，并且无法被 `computed()` 或 `effect()` 追踪到。

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

  // required：如果元素不存在会抛出错误，返回 Signal<ElementRef>（非 undefined）
  containerRequired = viewChild.required<ElementRef>("container");

  // viewChildren 返回 Signal<readonly ElementRef[]>
  buttons = viewChildren<ElementRef>("btn");

  // 可以在 constructor 中直接使用（不需要等 AfterViewInit）
  // 但注意：在组件挂载前，viewChild() 值是 undefined
  constructor() {
    // effect 中自动追踪
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
  // 查询投影进来的内容
  header = contentChild<HeaderComponent>(HeaderComponent);
  items = contentChildren<ItemComponent>(ItemComponent);

  constructor() {
    // 当 items 变化时自动响应
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

## Signal Queries 与 computed() 组合

这是 Signal-based Queries 最大的优势——可以派生计算值：

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

  // 基于 DOM 查询派生计算值
  isFormValid = computed(() => {
    const name = this.nameInput().nativeElement.value;
    const email = this.emailInput().nativeElement.value;
    return name.length > 0 && email.includes("@");
  });
}
```

## Angular 17.x Signal 化路线图

```
Angular 17.0 (2023-11)  Signals 开发者预览 → 稳定
                         signal(), computed(), effect()

Angular 17.1 (2024-01)  Signal Inputs
                         input(), input.required()

Angular 17.2 (2024-02)  Signal Queries  ← 本文
                         viewChild(), viewChildren(), contentChild(), contentChildren()

Angular 17.3 (预计 03)  Output API
                         output(), output.required()

Angular 18.0 (预计 05)  Zoneless 变更检测（实验性）
                         全面 Signal 化组件
```

## 与旧装饰器的兼容性

Angular 17.2 的 Signal Queries 是**开发者预览**阶段，API 可能在正式版中有调整。旧的 `@ViewChild`、`@ContentChild` 等装饰器继续工作，不会被废弃（至少在 Angular 18 之前）。可以在新组件中逐步采用 Signal Queries，无需全量迁移。

## 总结

Angular 17.2 的 Signal Queries 让模板查询也融入了响应式体系，消除了 `ngAfterViewInit` 生命周期钩子的依赖，并让查询结果可以直接参与 `computed()` 推导链。配合 Signal Inputs，Angular 组件的数据流正在变得更像纯函数：输入 → 信号 → 模板，大幅降低心智负担。