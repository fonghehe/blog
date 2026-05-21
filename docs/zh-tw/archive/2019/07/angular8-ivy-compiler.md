---
title: "Angular 8 Ivy 渲染引擎：差異化載入與 Web Worker 支援"
date: 2019-07-31 15:52:46
tags:
  - Angular
readingTime: 1
description: "Angular 8 於 2019 年 5 月 28 日正式釋出。Ivy 以 opt-in 方式進入預覽，差異化載入預設開啟。實際體驗了一個月，來講講升級經驗和各項功能的實際效果。"
wordCount: 299
---

Angular 8 於 2019 年 5 月 28 日正式釋出。Ivy 以 opt-in 方式進入預覽，差異化載入預設開啟。實際體驗了一個月，來講講升級經驗和各項功能的實際效果。

## 差異化載入：預設開啟

**構建後的產物變化**

```
# Angular 7 （老）
dist/
  main.js          # 所有瀏覽器的 ES5 包

# Angular 8 （新）
dist/
  main-es2015.js   # 現代瀏覽器（Chrome 61+, Firefox 60+）
  main-es5.js      # 老瀏覽器（IE11 備用）
```

自動生成的 HTML：

```html
<script type="module" src="main-es2015.js"></script>
<script nomodule src="main-es5.js"></script>
```

實測資料（操箇中等規模 Angular 專案）：

- 現代瀏覽器下 main bundle **減小 20%+**
- 執行時解析速度明顯提升

## Ivy opt-in 使用過程

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

開啟 Ivy 後的變化：

**構建輸出**：元件的 factory 和 渲染程式碼直接生成到元件檔案旁邊，而不是單獨的 `ngfactory` 檔案。

```typescript
// 之前：會生成 user.component.ngfactory.ts
// Ivy 之後：部署圖 (instructions) 內嵌在元件類裡
static ɵcmp = defineComponent({...}); // 編譯器生成
```

## ngcc 相容編譯器

Ivy 需要所有依賴也是 Ivy 格式。對於還沒用 Ivy 編譯的第三方庫，Angular 提供了 `ngcc`（Angular Compatibility Compiler）在安裝時自動轉換：

```bash
# 安裝依賴後自動執行 ngcc
# 也可手動執行
node_modules/.bin/ngcc
```

## Web Worker CLI 支援

```bash
ng generate web-worker heavy-task
# 生成 src/app/heavy-task.worker.ts
```

```typescript
// heavy-task.worker.ts
onmessage = ({ data }) => {
  // 這裡的計算不會阻塞主執行緒
  const result = data.reduce((sum: number, n: number) => sum + n * n, 0);
  postMessage(result);
};

// component.ts 中使用
export class AppComponent {
  compute(data: number[]) {
    const worker = new Worker("./heavy-task.worker", { type: "module" });
    worker.onmessage = ({ data: result }) => {
      this.result = result;
    };
    worker.postMessage(data);
  }
}
```

## 升級建議

```bash
# 升級命令
 ng update @angular/cli @angular/core

# CLI 會自動將字串 loadChildren 轉成 import() 語法
# 如果用了 ViewChild(‘...’)，提示需要加 { static: true/false }
```

## 總結

Angular 8 的差異化載入是對現有專案影響最大的執行時改進。Ivy 還在預覽階段，但已可以開始梳理自己專案的 `ViewChild` 靜態查詢和惰性載入寫法，為 Angular 9 的 Ivy 預設開啟做好準備。
