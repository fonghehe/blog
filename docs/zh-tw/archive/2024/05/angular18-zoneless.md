---
title: "Angular 18 Zoneless 變更檢測：實驗性但革命性"
date: 2024-05-29 15:09:49
tags:
  - Angular
readingTime: 2
description: "Angular 18 於 2024 年 5 月 22 日正式釋出，最受期待的特性是 **Zoneless 變更檢測**（實驗性）。這意味著 Angular 應用可以完全不依賴 `zone.js` 執行，從而減小包體積、提升效能，並解決多年來 zone.js 帶來的各種相容性問題。"
wordCount: 394
---

Angular 18 於 2024 年 5 月 22 日正式釋出，最受期待的特性是 **Zoneless 變更檢測**（實驗性）。這意味著 Angular 應用可以完全不依賴 `zone.js` 執行，從而減小包體積、提升效能，並解決多年來 zone.js 帶來的各種相容性問題。

## 為什麼要去掉 zone.js

`zone.js` 是 Angular 框架長期以來的核心依賴，通過 monkey-patching 瀏覽器 API（`setTimeout`、Promise、DOM 事件等）來檢測非同步操作，然後觸發變更檢測。

```
zone.js 帶來的問題：
- 包大小：壓縮後約 33KB
- 效能開銷：所有非同步操作都被攔截，引發不必要的變更檢測
- 除錯困難：stack trace 中充滿 zone 相關幀
- 相容問題：與某些第三方庫（如 Monaco Editor）衝突
- 不相容 Native Async/Await（需要 Babel 降級）
```

## 開啟 Zoneless 模式

```typescript
// main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { provideExperimentalZonelessChangeDetection } from "@angular/core";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(), // 開啟實驗性 Zoneless
    // 不再需要 provideZoneChangeDetection()
  ],
});
```

同時需要從 `polyfills` 中移除 `zone.js`：

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

## Zoneless 下的變更檢測機製

沒有 zone.js，Angular 如何知道何時需要更新 UI？答案是依賴 Signals 和顯式通知：

```typescript
@Component({
  standalone: true,
  selector: "app-counter",
  template: `<p>Count: {{ count() }}</p>
    <button (click)="inc()">+</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush, // Zoneless 推薦配合 OnPush
})
export class CounterComponent {
  count = signal(0); // Signal 變更自動觸發 UI 更新

  inc() {
    this.count.update((c) => c + 1); // Signal 變更，Angular 知道需要更新
  }
}
```

Signal 的變更會自動排程元件重新渲染，無需 zone.js 監聽。

## 非 Signal 狀態如何處理

對於非 Signal 的傳統狀態，需要手動告知 Angular：

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
        this.cdr.markForCheck(); // 手動通知變更（Zoneless 下必須）
      });
  }
}
```

或者使用 `AsyncPipe`（它內部會呼叫 `markForCheck()`）：

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

## 測試中的 Zoneless

Zoneless 元件測試不需要等待 `fixture.detectChanges()`：

```typescript
// 舊的 Zone 模式測試
it("should update counter", async () => {
  fixture.detectChanges(); // 需要手動觸發
  button.click();
  await fixture.whenStable(); // 需要等待
  fixture.detectChanges(); // 再次觸發
  expect(display.textContent).toBe("1");
});

// Zoneless 測試（更簡潔）
it("should update counter", async () => {
  button.click();
  await fixture.whenStable(); // 等待排程完成
  expect(display.textContent).toBe("1");
});
```

## Angular 18 其他新特性

- **Material 3 穩定版**：Angular Material 完成 Material Design 3 遷移
- **i18n hydration**：服務端渲染的國際化內容支援水合
- **Route-level render mode**（路由級渲染模式，開發預覽）：每條路由可獨立選擇 SSR/SSG/CSR

```typescript
// app.routes.ts（Angular 18 路由級渲染模式預覽）
import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  { path: "/", renderMode: RenderMode.Prerender }, // 靜態預渲染
  { path: "/dashboard", renderMode: RenderMode.Server }, // 動態 SSR
  { path: "/profile", renderMode: RenderMode.Client }, // 純客戶端
];
```

## 總結

Angular 18 的 Zoneless 模式目前仍是實驗性的，不建議直接用於生產。但它標誌著 Angular 正式開始"去 zone.js"的程序。配合 Signals 體系，Angular 正在向更簡單、更可預測的響應式模型演進。預計 Angular 19 會讓 Zoneless 進一步穩定。