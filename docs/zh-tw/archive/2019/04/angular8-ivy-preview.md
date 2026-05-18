---
title: "Angular 8 RC 預覽：Ivy 編譯器與惰性載入新語法"
date: 2019-04-11 16:09:56
tags:
  - Angular
readingTime: 2
description: "Angular 8 第一個 RC 版本已釋出，帶來了兩個備受期待的特性：可選的 Ivy 編譯器預覽和 `import()` 想式載入語法。"
---

Angular 8 第一個 RC 版本已釋出，帶來了兩個備受期待的特性：可選的 Ivy 編譯器預覽和 `import()` 想式載入語法。

## Ivy 是什麼

Ivy 是 Angular 的下一代渲染引擎。它重寫了編譯器和執行時，目標是：

- **更小的包體積**：tree-shaking 友好，只打包實際使用的框架功能
- **更快的重新構建**：增量編譯，修改一個檔案不需重新編譯全專案
- **更好的除錯體驗**：渲染器程式碼可讀性更強
- **未來支撐**：Server-Side Rendering、Higher-order components 等高階功能

## 開啟 Ivy 預覽

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

注意：Angular 8 中 Ivy 僅是 **opt-in** 預覽，不推薦生產測試。完全預設開啟要等 Angular 9。

## 想性載入語法變化

這是 Angular 8 **非常實用**的變化。之前用字串載入模組路徑沒有型別檢查，現在用原生 ES `import()` 語法，編譯器可以檢查路徑正確性：

```typescript
// Angular 7 及之前：字串路徑
const routes: Routes = [
  {
    path: "users",
    loadChildren: "./users/users.module#UsersModule", // 舊語法
  },
];

// Angular 8+：動態 import()
const routes: Routes = [
  {
    path: "users",
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
];
```

新語法的優勢：

1. IDE 跟蹤路徑，重新命名自動更新
2. TypeScript 編譯時檢查路徑是否存在
3. 更建議人讀——清楚地看到對應關係

## Web Worker 支援

Angular 8 CLI 支援一鍵生成 Web Worker：

```bash
ng generate web-worker app
```

```typescript
// src/app/app.worker.ts
onmessage = ({ data }) => {
  const result = heavyComputation(data);
  postMessage(result);
};

// 在元件中使用
if (typeof Worker !== "undefined") {
  const worker = new Worker("./app.worker", { type: "module" });
  worker.postMessage({ input: largeData });
  worker.onmessage = ({ data }) => {
    this.result = data;
  };
}
```

## Differential Loading（差異化載入）

Angular 8 預設開啟：現代瀏覽器載入 ES2015+ 包，老瀏覽器載入 ES5 包。

```html
<!-- 構建後自動生成 -->
<script type="module" src="main-es2015.js"></script>
<!-- 現代瀏覽器 -->
<script nomodule src="main-es5.js"></script>
<!-- 老瀏覽器備用 -->
```

現代瀏覽器使用者可獲得 **20-30% 體積減少**（無需 polyfill 和 ES5 transpile 開銷）。

## 總結

Angular 8 最值得升級的地方是惰性載入語法和差異化載入，這兩個功能小成本大收益。Ivy 預覽即便不上生產，也很值得在開發環境嚐鮮。
