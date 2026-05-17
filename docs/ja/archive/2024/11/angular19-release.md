---
title: "Angular 19 正式リリース：インクリメンタルハイドレーション、ルートレベルレンダリング、Zoneless開発者プレビュー"
date: 2024-11-20 10:00:00
tags:
  - Angular
  - CSS
readingTime: 3
description: "Angular 19 が2024年11月19日に正式リリースされました。これは近年の Angular において SSR 能力とリアクティブモデルで最も大きな変化をもたらしたバージョンの一つです。主なハイライト：インクリメンタルハイドレーション（Incremental Hydration）が正式に利用可能、ルートレベルレ"
---

Angular 19 が2024年11月19日に正式リリースされました。これは近年の Angular において SSR 能力とリアクティブモデルで最も大きな変化をもたらしたバージョンの一つです。主なハイライト：インクリメンタルハイドレーション（Incremental Hydration）が正式に利用可能、ルートレベルレンダリングモードが安定化、Zoneless が開発者プレビューに昇格、テンプレート HMR が正式サポート。

## インクリメンタルハイドレーション：SSRパフォーマンスの新段階

全量ハイドレーションはページ読み込み時にすべてのコンポーネントを活性化しますが、ユーザーが見ていないか必要のないものも含まれます。インクリメンタルハイドレーションにより、各 `@defer` ブロックがいつハイドレーションするかを独立して制御できます：

```typescript
// 1. 开启增量水合
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
};
```

```html
<!-- 2. 在模板中声明水合策略 -->
<!-- 进入视口时水合（低优先级内容推荐） -->
@defer (hydrate on viewport) {
<comments-section />
}

<!-- 用户交互时水合（富交互组件） -->
@defer (hydrate on interaction) {
<rich-text-editor [(content)]="articleBody" />
}

<!-- 立即水合（关键内容） -->
@defer (hydrate immediately) {
<product-hero [product]="featured" />
}

<!-- 永不水合：服务端渲染后作为静态 HTML 保留 -->
@defer (hydrate never) {
<legal-footer />
}
```

**パフォーマンス比較（典型的なコンテンツページ、40コンポーネント）**：

```
全量水合（Angular 17/18）：
  服务端 HTML → 全部 40 个组件同时激活
  TTI: ~1.8s, TBT: ~320ms

增量水合（Angular 19）：
  服务端 HTML → 仅激活视口内 6 个组件
  其余组件在用户滚动/交互时按需激活
  TTI: ~0.6s, TBT: ~80ms
```

## ルートレベルレンダリングモード（正式安定化）

每条路由可以独立选择 SSR、预渲染或 CSR：

```typescript
// app.routes.server.ts（Angular 19 稳定 API）
import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  { path: "", renderMode: RenderMode.Prerender },
  { path: "products", renderMode: RenderMode.Prerender },
  { path: "products/:id", renderMode: RenderMode.Server }, // 动态 SSR
  { path: "checkout", renderMode: RenderMode.Client }, // 纯 CSR（无需 SEO）
  { path: "**", renderMode: RenderMode.Server },
];
```

## Zoneless：実験的から開発者プレビューへ

```typescript
// Angular 18：provideExperimentalZonelessChangeDetection()
// Angular 19：API 更名，去掉 Experimental
import { provideZonelessChangeDetection } from "@angular/core";

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // 开发者预览，可用于生产评估
  ],
});
```

`angular.json` の `polyfills` から `zone.js` も削除することで、バンドルサイズが約33KB削減されます。

## テンプレート HMR（ホットモジュールリプレースメント）

```bash
ng serve
# 修改 .component.html → 仅更新对应组件的视图，应用状态保留
# 修改 .component.css  → 样式即时注入，无刷新
# 修改 .component.ts   → 全量刷新（逻辑变更需重置状态）
```

フォームが多いアプリケーションで最も効果的です：フォームレイアウトを調整する際、HMR によって入力済みの内容が失われることがなくなりました。

## linkedSignal() 安定化

```typescript
import { linkedSignal, input, Component } from '@angular/core';

@Component({ standalone: true, ... })
export class ListWithSelectionComponent {
  items = input.required<Item[]>();

  // 当 items 变化时重置选中项；用户可以手动修改选中项
  selectedItem = linkedSignal(() => this.items()[0] ?? null);
}
```

## Signalベースコンポーネント：OnPushがデフォルトに

Angular 19 发布了 RFC，计划在未来版本将 `OnPush` 作为新项目的默认变更检测策略（配合 Signals 使用）。现在可以在新组件中主动采用：

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // 现在推荐明确声明
  template: `{{ user().name }}`,
})
export class UserComponent {
  user = input.required<User>();
}
```

## Angular 19 へのアップグレード

```bash
ng update @angular/core@19 @angular/cli@19

# 查看自动迁移选项
ng update @angular/core@19 --from=18 --dry-run
```

## まとめ

Angular 19 在 SSR 方向迈出了重要一步：增量水合解决了全量激活的性能开销，路由级渲染模式让架构决策更细粒度。Zoneless 开发者预览标志着 Angular 正式进入"去 zone.js"的稳定阶段。如果你的 Angular 应用有 SSR 需求，Angular 19 是值得认真规划升级的版本。
