---
title: "Angular 18 Zoneless 变更检测：实验性但革命性"
date: 2024-05-29 15:09:49
tags:
  - Angular
---

Angular 18 于 2024 年 5 月 22 日正式发布，最受期待的特性是 **Zoneless 变更检测**（实验性）。这意味着 Angular 应用可以完全不依赖 `zone.js` 运行，从而减小包体积、提升性能，并解决多年来 zone.js 带来的各种兼容性问题。

## 为什么要去掉 zone.js

`zone.js` 是 Angular 框架长期以来的核心依赖，通过 monkey-patching 浏览器 API（`setTimeout`、Promise、DOM 事件等）来检测异步操作，然后触发变更检测。

```
zone.js 带来的问题：
- 包大小：压缩后约 33KB
- 性能开销：所有异步操作都被拦截，引发不必要的变更检测
- 调试困难：stack trace 中充满 zone 相关帧
- 兼容问题：与某些第三方库（如 Monaco Editor）冲突
- 不兼容 Native Async/Await（需要 Babel 降级）
```

## 开启 Zoneless 模式

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

同时需要从 `polyfills` 中移除 `zone.js`：

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

## Zoneless 下的变更检测机制

没有 zone.js，Angular 如何知道何时需要更新 UI？答案是依赖 Signals 和显式通知：

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

Signal 的变更会自动调度组件重新渲染，无需 zone.js 监听。

## 非 Signal 状态如何处理

对于非 Signal 的传统状态，需要手动告知 Angular：

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

或者使用 `AsyncPipe`（它内部会调用 `markForCheck()`）：

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

## 测试中的 Zoneless

Zoneless 组件测试不需要等待 `fixture.detectChanges()`：

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

## Angular 18 其他新特性

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

## 总结

Angular 18 的 Zoneless 模式目前仍是实验性的，不建议直接用于生产。但它标志着 Angular 正式开始"去 zone.js"的进程。配合 Signals 体系，Angular 正在向更简单、更可预测的响应式模型演进。预计 Angular 19 会让 Zoneless 进一步稳定。