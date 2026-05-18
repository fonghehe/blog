---
title: "Angular 17 RC 预览：新控制流与 Deferrable Views 改变模板写法"
date: 2023-10-25 10:22:36
tags:
  - Angular
readingTime: 2
description: "Angular 17 Release Candidate 于 2023 年 10 月 4 日发布，正式版预计 11 月 8 日发布。RC 阶段的 API 已经稳定，可以在非生产环境中提前体验。两个最重磅的特性——**内置控制流**和 **Deferrable Views**——彻底改变了 Angular 模板的写法。"
---

Angular 17 Release Candidate 于 2023 年 10 月 4 日发布，正式版预计 11 月 8 日发布。RC 阶段的 API 已经稳定，可以在非生产环境中提前体验。两个最重磅的特性——**内置控制流**和 **Deferrable Views**——彻底改变了 Angular 模板的写法。

> **注意**：本文基于 Angular 17 RC，正式版 API 可能有细微差异。

## 内置控制流：@if / @for / @switch

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

Angular 17 的 `@for` **强制要求** `track` 表达式（而 `*ngFor` 的 `trackBy` 是可选的），这是一个重要改进：

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

## Deferrable Views：@defer

这是 Angular 17 最激动人心的特性。`@defer` 让组件/模板块可以**懒加载**——不只是懒加载路由，而是细粒度到模板中任意一块内容：

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

## Signals 在 Angular 17 中趋于稳定

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

## 新的默认构建系统：esbuild

Angular 17 将 esbuild（通过 `@angular-devkit/build-angular:application`）设为默认构建器：

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

## 升级到 Angular 17

```bash
ng update @angular/core@17 @angular/cli@17

# 自动迁移（可选）：
# 将 *ngIf、*ngFor、*ngSwitch 转换为新控制流语法
ng generate @angular/core:control-flow
```

## 总结

Angular 17 是近年来对模板语法改动最大的版本。新控制流语法更直观，强制 `track` 减少了列表渲染的性能陷阱；`@defer` 是前端懒加载的新范式——从"路由懒加载"升级到"内容块懒加载"。正式版预计 11 月 8 日发布，RC 阶段可以开始在项目中测试迁移。