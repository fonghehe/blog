---
title: "Angular 18 Zoneless 変更検知：実験的だが革命的"
date: 2024-05-29 15:09:49
tags:
  - Angular
readingTime: 3
description: "Angular 18 は 2024 年 5 月 22 日に正式リリースされました。最も待望されている機能は **Zoneless 変更検知**（実験的）です。これは Angular アプリケーションが `zone.js` に全く依存せずに動作できることを意味し、バンドルサイズの削減、パフォーマンスの向上、そして zon"
---

Angular 18 は 2024 年 5 月 22 日に正式リリースされました。最も待望されている機能は **Zoneless 変更検知**（実験的）です。これは Angular アプリケーションが `zone.js` に全く依存せずに動作できることを意味し、バンドルサイズの削減、パフォーマンスの向上、そして zone.js が長年引き起こしてきた様々な互換性の問題を解決します。

## なぜ zone.js を削除するのか

`zone.js` は Angular フレームワークの長年にわたるコア依存関係です。ブラウザ API（`setTimeout`、Promise、DOM イベントなど）を monkey-patching することで非同期操作を検知し、変更検知をトリガーします。

```
zone.js 带来的问题：
- 包大小：压缩后约 33KB
- 性能开销：所有异步操作都被拦截，引发不必要的变更检测
- 调试困难：stack trace 中充满 zone 相关帧
- 兼容问题：与某些第三方库（如 Monaco Editor）冲突
- 不兼容 Native Async/Await（需要 Babel 降级）
```

## Zoneless モードの有効化

```typescript
// main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { provideExperimentalZonelessChangeDetection } from "@angular/core";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(), // 开启实验性 Zoneless
    // 不再需要 provideZoneChangeDetection()
  ],
});
```

同時に `polyfills` から `zone.js` を削除する必要があります：

```json
// angular.json
{
  "build": {
    "options": {
      "polyfills": [] // 移除 "zone.js"
    }
  }
}
```

## Zoneless モードの変更検知メカニズム

zone.js なしで、Angular はいつ UI を更新すべきかをどのように知るのでしょうか？答えは Signals と明示的な通知に依存することです：

```typescript
@Component({
  standalone: true,
  selector: "app-counter",
  template: `<p>Count: {{ count() }}</p>
    <button (click)="inc()">+</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush, // Zoneless 推荐配合 OnPush
})
export class CounterComponent {
  count = signal(0); // Signal 变更自动触发 UI 更新

  inc() {
    this.count.update((c) => c + 1); // Signal 变更，Angular 知道需要更新
  }
}
```

Signal の変更は zone.js の監視なしに、自動的にコンポーネントの再レンダリングをスケジュールします。

## 非 Signal 状態の処理方法

非 Signal の従来の状態については、Angular に手動で通知する必要があります：

```typescript
import { Component, ChangeDetectorRef, inject } from "@angular/core";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ data }}</p>`,
})
export class AsyncDataComponent {
  private cdr = inject(ChangeDetectorRef);
  data = "";

  loadData() {
    fetch("/api/data")
      .then((res) => res.json())
      .then((result) => {
        this.data = result.value;
        this.cdr.markForCheck(); // 手动通知变更（Zoneless 下必须）
      });
  }
}
```

または `AsyncPipe` を使用することもできます（内部で `markForCheck()` を呼び出します）：

```typescript
@Component({
  standalone: true,
  imports: [AsyncPipe],
  template: `<p>{{ data$ | async }}</p>`,
})
export class AsyncPipeComponent {
  data$ = from(fetch("/api/data").then((r) => r.json()));
}
```

## テストでの Zoneless

Zoneless コンポーネントのテストでは `fixture.detectChanges()` を待つ必要がありません：

```typescript
// 旧的 Zone 模式测试
it("should update counter", async () => {
  fixture.detectChanges(); // 需要手动触发
  button.click();
  await fixture.whenStable(); // 需要等待
  fixture.detectChanges(); // 再次触发
  expect(display.textContent).toBe("1");
});

// Zoneless 测试（更简洁）
it("should update counter", async () => {
  button.click();
  await fixture.whenStable(); // 等待调度完成
  expect(display.textContent).toBe("1");
});
```

## Angular 18 のその他の新機能

- **Material 3 稳定版**：Angular Material 完成 Material Design 3 迁移
- **i18n hydration**：服务端渲染的国际化内容支持水合
- **Route-level render mode**（路由级渲染模式，开发预览）：每条路由可独立选择 SSR/SSG/CSR

```typescript
// app.routes.ts（Angular 18 路由级渲染模式预览）
import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  { path: "/", renderMode: RenderMode.Prerender }, // 静态预渲染
  { path: "/dashboard", renderMode: RenderMode.Server }, // 动态 SSR
  { path: "/profile", renderMode: RenderMode.Client }, // 纯客户端
];
```

## 結論

Angular 18 の Zoneless モードは現在も実験的であり、本番環境での直接使用は推奨されません。しかし、Angular が正式に「zone.js 廃止」プロセスを開始したことを示しています。Signals システムと組み合わせて、Angular はよりシンプルで予測可能なリアクティブモデルへと進化しています。Angular 19 では Zoneless がさらに安定することが期待されています。