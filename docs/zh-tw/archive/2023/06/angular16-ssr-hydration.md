---
title: "Angular 16 非破壞性 SSR 水合：告別全量重渲染"
date: 2023-06-02 14:50:22
tags:
  - Angular
readingTime: 2
description: "Angular 16 帶來了**非破壞性水合（Non-Destructive Hydration）**，這是 Angular Universal SSR 的一次重大進化。以前 Angular 的水合會先銷燬服務端渲染的 HTML，再重新渲染客戶端版本（\"破壞性\"水合），導致白屏閃爍和 CLS 指標惡化。新方式會直接複用"
wordCount: 372
---

Angular 16 帶來了**非破壞性水合（Non-Destructive Hydration）**，這是 Angular Universal SSR 的一次重大進化。以前 Angular 的水合會先銷燬服務端渲染的 HTML，再重新渲染客戶端版本（"破壞性"水合），導致白屏閃爍和 CLS 指標惡化。新方式會直接複用服務端 DOM，客戶端隻繫結事件，不重建 DOM 結構。

## 啟用非破壞性水合

```typescript
// app.config.ts（Standalone 應用）
import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideClientHydration } from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(), // 一行程式碼啟用非破壞性水合
  ],
};

// 服務端入口（server.ts 中 AppServerModule 不變）
```

## 破壞性 vs 非破壞性水合對比

```
破壞性水合（Angular 15 及之前）：
1. 服務端渲染 HTML → 傳送給瀏覽器
2. 瀏覽器展示 SSR HTML（使用者可見）
3. Angular 下載、解析 JS bundle
4. Angular 銷燬所有服務端 HTML ← 白屏！
5. Angular 重新渲染整個頁面
6. 事件監聽繫結完成

非破壞性水合（Angular 16）：
1. 服務端渲染 HTML → 傳送給瀏覽器
2. 瀏覽器展示 SSR HTML（使用者可見）
3. Angular 下載、解析 JS bundle
4. Angular 遍歷現有 DOM，匹配 Component 樹 ← 不銷燬！
5. 僅繫結事件監聽
6. 水合完成
```

## 時間到可互動（TTI）提升

非破壞性水合的主要收益體現在：

```
典型中型應用（100 個元件，2000 個 DOM 節點）：
破壞性水合：重建 DOM 約 280ms
非破壞性水合：DOM 遍歷約 45ms

CLS 改善：
破壞性：DOM 銷燬重建 → CLS 波動 0.08~0.15
非破壞性：DOM 複用 → CLS ≈ 0
```

## provideClientHydration 的選項

```typescript
import {
  provideClientHydration,
  withNoHttpTransferCache,
} from "@angular/platform-browser";

// 預設（推薦）：啟用 HTTP Transfer State
// 服務端的 HTTP 請求結果會傳遞給客戶端，避免重複請求
provideClientHydration();

// 如果不需要 HTTP Transfer State
provideClientHydration(withNoHttpTransferCache());
```

## HTTP Transfer State 整合

Angular 16 的水合預設與 `HttpClient` 整合——服務端已經完成的 HTTP 請求結果會通過內嵌 JSON 傳給客戶端，客戶端不需要重複請求：

```typescript
// 這個 API 請求在服務端執行
// 水合後，客戶端的同一請求會直接從 Transfer State 獲取，不發 HTTP
@Injectable({ providedIn: "root" })
export class ProductService {
  private http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    // SSR：發起真實 HTTP 請求
    // 客戶端水合階段：從 Transfer State 獲取，不重複請求
    return this.http.get<Product[]>("/api/products");
  }
}
```

## 注意事項：不相容水合的模式

某些操作無法水合，需要標記跳過：

```typescript
// 使用 ngSkipHydration 跳過水合的元件/元素
@Component({
  selector: 'app-chart',
  template: `
    <div ngSkipHydration>
      <!-- 圖表元件：依賴客戶端 DOM API，不能水合 -->
      <canvas id="myChart"></canvas>
    </div>
  `
})
export class ChartComponent implements AfterViewInit {
  ngAfterViewInit() {
    // 這裡依賴 document/window，服務端沒有
    new Chart(document.getElementById('myChart')!, { ... });
  }
}
```

常見需要跳過水合的場景：

- 使用 `document`、`window`、`localStorage` 的元件
- 依賴客戶端測量（getBoundingClientRect）的元件
- 畫布/WebGL 元件

## 升級到 Angular 16 啟用水合

```bash
ng update @angular/core@16 @angular/cli@16 @angular/ssr@16

# 對於現有 Universal 專案，遷移工具會：
# 1. 將 AppServerModule 遷移到 bootstrapApplication（如需）
# 2. 新增 provideClientHydration()
# 3. 更新 server.ts
```

## 總結

非破壞性水合是 Angular Universal 從"可用"變成"高效能"的關鍵一步。一行 `provideClientHydration()` 就能消除 SSR 應用最讓人頭疼的 DOM 重建白屏問題。結合 HTTP Transfer State，服務端完成的工作不會在客戶端重做。對於已有 Angular Universal 專案，升級到 16 並啟用新水合是投入產出比最高的最佳化項。