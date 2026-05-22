---
title: "Angular 16 非破壊的 SSR ハイドレーション：完全再レンダリングからの卒業"
date: 2023-06-02 14:50:22
tags:
  - Angular
readingTime: 3
description: "Angular 16 は非破壊的水和（Non-Destructive Hydration）をもたらしました。これは Angular Universal SSR の大きな進化です。以前の Angular の水和は、サーバーサイドでレンダリングされた HTML を一度破棄してからクライアントバージョンを再レンダリングしていました（破壊的水和）。その結果、白画面のフリッカリングや CLS 指標の悪化を引き起こしていました。新しい方式ではサーバーサイドの HTML を直接再利用します。"
wordCount: 704
---

Angular 16 は**非破壊的水和（Non-Destructive Hydration）**をもたらしました。これは Angular Universal SSR の大きな進化です。以前の Angular の水和は、サーバーサイドでレンダリングされた HTML を一度破棄してからクライアントバージョンを再レンダリングしていました（破壊的水和）。その結果、白画面のフリッカリングや CLS 指標の悪化を引き起こしていました。新しい方式ではサーバーサイドの HTML を直接再利用し、クライアントはイベントのバインドのみを行い、DOM 構造を再構築しません。

## 非破壊的ハイドレーションの有効化

```typescript
// app.config.ts（Standalone 应用）
import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideClientHydration } from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(), // 一行コードで非破壊的水和を有効化
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

非破壊的水和の主な利点は以下の通りです：

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

// デフォルト（推奨）：HTTP Transfer State を有効化
// サーバーサイドの HTTP リクエスト結果がクライアントに渡され、重複リクエストを回避
provideClientHydration();

// HTTP Transfer State が不要な場合
provideClientHydration(withNoHttpTransferCache());
```

## HTTP Transfer State 統合

Angular 16 の水和はデフォルトで `HttpClient` と統合されています。サーバーサイドで完了した HTTP リクエストの結果は、インライン JSON を介してクライアントに渡されるため、クライアントは重複してリクエストする必要がありません。

```typescript
// この API リクエストはサーバーサイドで実行
// 水和後、クライアントの同じリクエストは Transfer State から直接取得され、HTTP リクエストは発生しない
@Injectable({ providedIn: "root" })
export class ProductService {
  private http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    // SSR：実際の HTTP リクエストを送信
    // クライアント水和段階：Transfer State から取得し、重複リクエストを行わない
    return this.http.get<Product[]>("/api/products");
  }
}
```

## 注意事項：ハイドレーションと互換性のないパターン

一部の操作は水和できません。スキップするためのマークが必要です：

```typescript
// ngSkipHydration を使用して水和をスキップするコンポーネント/要素
@Component({
  selector: 'app-chart',
  template: `
    <div ngSkipHydration>
      <!-- チャートコンポーネント：クライアント DOM API に依存するため、水和不可 -->
      <canvas id="myChart"></canvas>
    </div>
  `
})
export class ChartComponent implements AfterViewInit {
  ngAfterViewInit() {
    // document/window に依存しており、サーバーサイドには存在しない
    new Chart(document.getElementById('myChart')!, { ... });
  }
}
```

水和をスキップする必要がある一般的なシナリオ：

- `document`、`window`、`localStorage` を使用するコンポーネント
- クライアント側の測定（getBoundingClientRect）に依存するコンポーネント
- Canvas/WebGL コンポーネント

## Angular 16 にアップグレードしてハイドレーションを有効化

```bash
ng update @angular/core@16 @angular/cli@16 @angular/ssr@16

# 既存の Universal プロジェクトでは、移行ツールが以下を実行：
# 1. AppServerModule を bootstrapApplication に移行（必要な場合）
# 2. provideClientHydration() を追加
# 3. server.ts を更新
```

## まとめ

非破壊的水和は、Angular Universal が「使える」から「高性能」へと変わる重要な一歩です。一行の `provideClientHydration()` で、SSR アプリケーションで最も悩ましい DOM 再構築による白画面の問題を解消できます。HTTP Transfer State と組み合わせることで、サーバーサイドで完了した作業がクライアントで再実行されることはありません。既存の Angular Universal プロジェクトでは、バージョン 16 にアップグレードして新しい水和を有効にすることが、最も投資対効果の高い最適化です。
