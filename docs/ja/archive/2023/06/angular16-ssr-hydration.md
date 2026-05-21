---
title: "Angular 16 非破壊的 SSR ハイドレーション：完全再レンダリングからの卒業"
date: 2023-06-02 14:50:22
tags:
  - Angular
readingTime: 2
description: "Angular 16 带来了**非破坏性水合（Non-Destructive Hydration）**，这是 Angular Universal SSR 的一次重大进化。以前 Angular 的水合会先销毁服务端渲染的 HTML，再重新渲染客户端版本（\"破坏性\"水合），导致白屏闪烁和 CLS 指标恶化。新方式会直接复用"
wordCount: 426
---

Angular 16 带来了**非破坏性水合（Non-Destructive Hydration）**，这是 Angular Universal SSR 的一次重大进化。以前 Angular 的水合会先销毁服务端渲染的 HTML，再重新渲染客户端版本（"破坏性"水合），导致白屏闪烁和 CLS 指标恶化。新方式会直接复用服务端 DOM，客户端只绑定事件，不重建 DOM 结构。

## 非破壊的ハイドレーションの有効化

```typescript
// app.config.ts（Standalone 应用）
import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideClientHydration } from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(), // 一行代码启用非破坏性水合
  ],
};

// 服务端入口（server.ts 中 AppServerModule 不变）
```

## 破壊的 vs 非破壊的ハイドレーション比較

```
破坏性水合（Angular 15 及之前）：
1. 服务端渲染 HTML → 发送给浏览器
2. 浏览器展示 SSR HTML（用户可见）
3. Angular 下载、解析 JS bundle
4. Angular 销毁所有服务端 HTML ← 白屏！
5. Angular 重新渲染整个页面
6. 事件监听绑定完成

非破坏性水合（Angular 16）：
1. 服务端渲染 HTML → 发送给浏览器
2. 浏览器展示 SSR HTML（用户可见）
3. Angular 下载、解析 JS bundle
4. Angular 遍历现有 DOM，匹配 Component 树 ← 不销毁！
5. 仅绑定事件监听
6. 水合完成
```

## TTI（インタラクティブになるまでの時間）の改善

非破坏性水合的主要收益体现在：

```
典型中型应用（100 个组件，2000 个 DOM 节点）：
破坏性水合：重建 DOM 约 280ms
非破坏性水合：DOM 遍历约 45ms

CLS 改善：
破坏性：DOM 销毁重建 → CLS 波动 0.08~0.15
非破坏性：DOM 复用 → CLS ≈ 0
```

## provideClientHydration のオプション

```typescript
import {
  provideClientHydration,
  withNoHttpTransferCache,
} from "@angular/platform-browser";

// 默认（推荐）：启用 HTTP Transfer State
// 服务端的 HTTP 请求结果会传递给客户端，避免重复请求
provideClientHydration();

// 如果不需要 HTTP Transfer State
provideClientHydration(withNoHttpTransferCache());
```

## HTTP Transfer State 統合

Angular 16 的水合默认与 `HttpClient` 集成——服务端已经完成的 HTTP 请求结果会通过内嵌 JSON 传给客户端，客户端不需要重复请求：

```typescript
// 这个 API 请求在服务端执行
// 水合后，客户端的同一请求会直接从 Transfer State 获取，不发 HTTP
@Injectable({ providedIn: "root" })
export class ProductService {
  private http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    // SSR：发起真实 HTTP 请求
    // 客户端水合阶段：从 Transfer State 获取，不重复请求
    return this.http.get<Product[]>("/api/products");
  }
}
```

## 注意事項：ハイドレーションと互換性のないパターン

某些操作无法水合，需要标记跳过：

```typescript
// 使用 ngSkipHydration 跳过水合的组件/元素
@Component({
  selector: 'app-chart',
  template: `
    <div ngSkipHydration>
      <!-- 图表组件：依赖客户端 DOM API，不能水合 -->
      <canvas id="myChart"></canvas>
    </div>
  `
})
export class ChartComponent implements AfterViewInit {
  ngAfterViewInit() {
    // 这里依赖 document/window，服务端没有
    new Chart(document.getElementById('myChart')!, { ... });
  }
}
```

常见需要跳过水合的场景：

- 使用 `document`、`window`、`localStorage` 的组件
- 依赖客户端测量（getBoundingClientRect）的组件
- 画布/WebGL 组件

## Angular 16 にアップグレードしてハイドレーションを有効化

```bash
ng update @angular/core@16 @angular/cli@16 @angular/ssr@16

# 对于现有 Universal 项目，迁移工具会：
# 1. 将 AppServerModule 迁移到 bootstrapApplication（如需）
# 2. 添加 provideClientHydration()
# 3. 更新 server.ts
```

## まとめ

非破坏性水合是 Angular Universal 从"可用"变成"高性能"的关键一步。一行 `provideClientHydration()` 就能消除 SSR 应用最让人头疼的 DOM 重建白屏问题。结合 HTTP Transfer State，服务端完成的工作不会在客户端重做。对于已有 Angular Universal 项目，升级到 16 并启用新水合是投入产出比最高的优化项。