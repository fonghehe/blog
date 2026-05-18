---
title: "Angular 8 Ivy 渲染引擎：差異化加載與 Web Worker 支持"
date: 2019-07-31 15:52:46
tags:
  - Angular
readingTime: 1
description: "Angular 8 於 2019 年 5 月 28 日正式發佈。Ivy 以 opt-in 方式進入預覽，差異化加載默認開啓。實際體驗了一個月，來講講升級經驗和各項功能的實際效果。"
---

Angular 8 於 2019 年 5 月 28 日正式發佈。Ivy 以 opt-in 方式進入預覽，差異化加載默認開啓。實際體驗了一個月，來講講升級經驗和各項功能的實際效果。

## 差異化加載：默認開啓

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

實測數據（操箇中等規模 Angular 項目）：

- 現代瀏覽器下 main bundle **減小 20%+**
- 運行時解析速度明顯提升

## Ivy opt-in 使用過程

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

開啓 Ivy 後的變化：

**構建輸出**：組件的 factory 和 渲染代碼直接生成到組件文件旁邊，而不是單獨的 `ngfactory` 文件。

```typescript
// 之前：會生成 user.component.ngfactory.ts
// Ivy 之後：部署圖 (instructions) 內嵌在組件類裏
static ɵcmp = defineComponent({...}); // 編譯器生成
```

## ngcc 兼容編譯器

Ivy 需要所有依賴也是 Ivy 格式。對於還沒用 Ivy 編譯的第三方庫，Angular 提供了 `ngcc`（Angular Compatibility Compiler）在安裝時自動轉換：

```bash
# 安裝依賴後自動運行 ngcc
# 也可手動執行
node_modules/.bin/ngcc
```

## Web Worker CLI 支持

```bash
ng generate web-worker heavy-task
# 生成 src/app/heavy-task.worker.ts
```

```typescript
// heavy-task.worker.ts
onmessage = ({ data }) => {
  // 這裏的計算不會阻塞主線程
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

# CLI 會自動將字符串 loadChildren 轉成 import() 語法
# 如果用了 ViewChild(‘...’)，提示需要加 { static: true/false }
```

## 總結

Angular 8 的差異化加載是對現有項目影響最大的運行時改進。Ivy 還在預覽階段，但已可以開始梳理自己項目的 `ViewChild` 靜態查詢和惰性加載寫法，為 Angular 9 的 Ivy 默認開啓做好準備。
