---
title: "Angular 17 RC Preview: New Control Flow and Deferrable Views Transform Template Syntax"
date: 2023-10-25 10:22:36
tags:
  - Angular
readingTime: 2
description: "Angular 17 Release Candidate was published on October 4, 2023, with the official release expected on November 8. The RC-stage API is already stable and can be e"
---

Angular 17 Release Candidate was published on October 4, 2023, with the official release expected on November 8. The RC-stage API is already stable and can be experienced in non-production environments. The two most significant features — **built-in control flow** and **Deferrable Views** — completely transform how Angular templates are written.

> **Note**: This article is based on Angular 17 RC; the official release API may differ slightly.

## Built-in Control Flow: @if / @for / @switch

Angular 的结构指令（`*ngIf`、`*ngFor`）是历史遗留设计，需要 `CommonModule` 或单独导入，语法也不直观。Angular 17 引入了语言级别的控制流语法：

```html
<!-- 旧方式：需要导入 NgIf、NgFor、NgSwitch -->
<div *ngIf="user; else loading">{{ user.name }}</div>
<ng-template #loading><p>Loading...</p></ng-template>

<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>

<!-- Angular 17 新控制流：内置语言特性，无需导入 -->
@if (user) {
<div>{{ user.name }}</div>
} @else if (user === null) {
<p>用户不存在</p>
} @else {
<p>Loading...</p>
} @for (item of items; track item.id) {
<li>{{ item.name }}</li>
} @empty {
<li>暂无数据</li>
} @switch (status) { @case ('loading') { <spinner /> } @case ('error') {
<error-message /> } @default { <content /> } }
```

### @for 的 track 是必须的

Angular 17's `@for` **requires** a `track` expression (whereas `*ngFor`'s `trackBy` was optional), which is an important improvement:

```html
<!-- 错误：缺少 track -->
@for (item of items) {
<!-- 编译报错！ -->
<div>{{ item }}</div>
}

<!-- 正确 -->
@for (item of items; track item.id) {
<div>{{ item.name }}</div>
}

<!-- 对于无 id 的基本类型数组 -->
@for (name of names; track $index) {
<span>{{ name }}</span>
}
```

## Deferrable Views: @defer

This is the most exciting feature of Angular 17. `@defer` enables components/template blocks to **lazy-load** — not just lazy-loading routes, but fine-grained lazy loading of any content block in the template:

```html
<!-- 简单的 @defer：组件代码按需懒加载 -->
@defer {
<heavy-chart-component [data]="chartData" />
} @placeholder {
<div class="chart-skeleton">图表加载中...</div>
} @loading {
<spinner />
} @error {
<p>图表加载失败</p>
}
```

### @defer 触发条件

```html
<!-- 默认：空闲时懒加载（requestIdleCallback） -->
@defer {
<comments-section />
}

<!-- 视口内可见时加载（IntersectionObserver） -->
@defer (on viewport) {
<below-fold-content />
}

<!-- 鼠标悬停时加载 -->
@defer (on hover) {
<tooltip-content />
}

<!-- 用户交互时加载 -->
@defer (on interaction) {
<rich-text-editor />
}

<!-- 定时加载 -->
@defer (on timer(3000)) {
<late-content />
}

<!-- 条件加载 -->
@defer (when isAdmin()) {
<admin-panel />
}

<!-- 预加载：满足条件时预取，但不立即渲染 -->
@defer (on viewport; prefetch on idle) {
<expensive-widget />
}
```

## Signals Stabilize in Angular 17

```typescript
// Angular 17：signal()、computed()、effect() 正式稳定（不再是 developer preview）
import { signal, computed, effect } from '@angular/core';

@Component({ standalone: true, ... })
export class ShoppingCartComponent {
  items = signal<CartItem[]>([]);

  total = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.qty, 0)
  );

  itemCount = computed(() => this.items().length);
}
```

## New Default Build System: esbuild

Angular 17 sets esbuild (via `@angular-devkit/build-angular:application`) as the default builder:

```
构建速度对比（中型项目，50个组件）：
旧构建器（webpack）：首次构建 ~45s，热更新 ~3s
新构建器（esbuild）：首次构建 ~12s，热更新 ~400ms
```

```json
// angular.json（Angular 17 新项目默认）
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application"
    }
  }
}
```

## Upgrading to Angular 17

```bash
ng update @angular/core@17 @angular/cli@17

# 自动迁移（可选）：
# 将 *ngIf、*ngFor、*ngSwitch 转换为新控制流语法
ng generate @angular/core:control-flow
```

## Summary

Angular 17 is the version with the most significant template syntax changes in recent years. The new control flow syntax is more intuitive; mandatory `track` reduces list-rendering performance traps; `@defer` is a new paradigm for frontend lazy loading — upgrading from "route lazy loading" to "content block lazy loading". The official release is expected on November 8; the RC phase is the right time to start testing migration in your projects.