---
title: "Angular 17 RC プレビュー：新しい制御フローと Deferrable Views がテンプレート構文を変える"
date: 2023-10-25 10:22:36
tags:
  - Angular
readingTime: 3
description: "Angular 17 Release Candidate が2023年10月4日に公開され、正式版は11月8日にリリース予定です。RC段階の API はすでに安定しており、非本番環境で先行体験できます。最も重要な2つの特性——**組み込み制御フロー**と **Deferrable Views**——が Angular "
wordCount: 597
---

Angular 17 Release Candidate が2023年10月4日に公開され、正式版は11月8日にリリース予定です。RC段階の API はすでに安定しており、非本番環境で先行体験できます。最も重要な2つの特性——**組み込み制御フロー**と **Deferrable Views**——が Angular テンプレートの書き方を根本的に変えます。

> **注意**：本記事は Angular 17 RC をベースにしており、正式版の API と若干異なる場合があります。

## 組み込み制御フロー：@if / @for / @switch

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

Angular 17 の `@for` は `track` 式を**必須**とします（`*ngFor` の `trackBy` はオプションでした）。これは重要な改善点です：

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

これは Angular 17 で最もエキサイティングな機能です。`@defer` によりコンポーネント/テンプレートブロックが**遅延ロード**できます——ルートの遅延ロードだけでなく、テンプレート内の任意のコンテンツブロックを細粒度で制御できます：

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

## Angular 17 で Signals が安定化

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

## 新しいデフォルトビルドシステム：esbuild

Angular 17 は esbuild（`@angular-devkit/build-angular:application` 経由）をデフォルトビルダーとして設定します：

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

## Angular 17 へのアップグレード

```bash
ng update @angular/core@17 @angular/cli@17

# 自动迁移（可选）：
# 将 *ngIf、*ngFor、*ngSwitch 转换为新控制流语法
ng generate @angular/core:control-flow
```

## まとめ

Angular 17 は近年でテンプレート構文に最も大きな変更をもたらしたバージョンです。新しい制御フロー構文はより直感的で、必須の `track` によりリストレンダリングのパフォーマンス落とし穴が減ります；`@defer` はフロントエンド遅延ロードの新しいパラダイムです——「ルート遅延ロード」から「コンテンツブロック遅延ロード」へのアップグレード。正式版は11月8日リリース予定で、RC段階からプロジェクトへの移行テストを始めることができます。