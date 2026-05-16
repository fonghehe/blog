---
title: "Angular 18 Zoneless Change Detection: Experimental but Revolutionary"
date: 2024-05-29 15:09:49
tags:
  - Angular
readingTime: 2
description: "Angular 18 was officially released on May 22, 2024. The most anticipated feature is **Zoneless change detection** (experimental). This means Angular application"
---

Angular 18 was officially released on May 22, 2024. The most anticipated feature is **Zoneless change detection** (experimental). This means Angular applications can run entirely without relying on `zone.js`, reducing bundle size, improving performance, and solving various compatibility issues that zone.js has caused over the years.

## Why Remove zone.js

`zone.js` has been a core dependency of the Angular framework for a long time. It detects asynchronous operations by monkey-patching browser APIs (`setTimeout`, Promise, DOM events, etc.) and then triggers change detection.

```
zone.js 带来的问题：
- 包大小：压缩后约 33KB
- 性能开销：所有异步操作都被拦截，引发不必要的变更检测
- 调试困难：stack trace 中充满 zone 相关帧
- 兼容问题：与某些第三方库（如 Monaco Editor）冲突
- 不兼容 Native Async/Await（需要 Babel 降级）
```

## Enabling Zoneless Mode

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

You also need to remove `zone.js` from `polyfills`:

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

## Change Detection Mechanism in Zoneless Mode

Without zone.js, how does Angular know when to update the UI? The answer is to rely on Signals and explicit notifications:

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

Signal changes automatically schedule component re-renders without zone.js monitoring.

## Handling Non-Signal State

For traditional non-Signal state, you need to manually notify Angular:

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

Or use `AsyncPipe` (which internally calls `markForCheck()`):

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

## Zoneless in Testing

Zoneless component tests no longer need to wait for `fixture.detectChanges()`:

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

## Other Angular 18 New Features

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

## Conclusion

Angular 18's Zoneless mode is still experimental and is not recommended for direct use in production. However, it marks Angular officially beginning the "remove zone.js" process. Combined with the Signals system, Angular is evolving toward a simpler and more predictable reactive model. Angular 19 is expected to further stabilize Zoneless.