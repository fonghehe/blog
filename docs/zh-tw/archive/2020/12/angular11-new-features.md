---
title: "Angular 11 新特性：HMR 支援與字型內聯最佳化"
date: 2020-12-05 10:59:50
tags:
  - Angular
readingTime: 2
description: "Angular 11 於 2020 年 11 月 11 日正式釋出。相比 Angular 10 的\"質量版本\"，Angular 11 帶來了更多開發體驗方面的實質改進，其中 HMR 支援和字型內聯是最值得關注的兩個特性。"
wordCount: 335
---

Angular 11 於 2020 年 11 月 11 日正式釋出。相比 Angular 10 的"質量版本"，Angular 11 帶來了更多開發體驗方面的實質改進，其中 HMR 支援和字型內聯是最值得關注的兩個特性。

## 開箱即用的 HMR

Angular 11 之前，開啟 HMR 需要手動修改 `main.ts`，配置繁瑣。現在只需一個 CLI 引數：

```bash
# Angular 11 之前的 HMR 配置（繁瑣）
# 1. 修改 angular.json
# 2. 修改 main.ts 新增 module.hot 判斷
# 3. 安裝 @angularclass/hmr

# Angular 11：一行命令
ng serve --hmr

# 或在 angular.json 中永久開啟
```

```json
// angular.json
{
  "serve": {
    "configurations": {
      "development": {
        "hmr": true
      }
    }
  }
}
```

HMR 開啟後，修改元件的模板或樣式只會更新該元件，而不是重新整理整個頁面，開發體驗大幅提升。

## 字型內聯最佳化

Angular 11 CLI 預設會將 Google Fonts 的 CSS 內聯到 HTML 中，避免額外的網路請求：

```html
<!-- 之前：需要一次額外的 HTTP 請求 -->
<link
  href="https://fonts.googleapis.com/css2?family=Roboto&display=swap"
  rel="stylesheet"
/>

<!-- Angular 11 構建後自動內聯（僅 CSS，字型檔案本身仍 CDN 載入）-->
<style>
  /* 內聯字型 CSS，省去一次 DNS 解析 + HTTP 請求 */
  @font-face {
    font-family: "Roboto";
    src: url("https://fonts.gstatic.com/s/roboto/...") format("woff2");
  }
</style>
```

這個最佳化對 Lighthouse 的 LCP（最大內容繪製）分數有正向影響。

## 更嚴格的 NgModule 型別檢查

```typescript
// Angular 11 對 NgModule 的 declarations 進行更嚴格的型別檢查
@NgModule({
  declarations: [
    AppComponent,
    // ❌ 在 Angular 11 之前，把 Service 錯誤放在 declarations 裡不會立即報錯
    // UserService  // 現在會明確報錯：UserService is not a component/directive/pipe
  ]
})
```

## 路由改進：更嚴格的型別

```typescript
// Angular 11 的 Router 提供了更好的型別推導
const routes: Routes = [
  {
    path: "users/:id",
    component: UserDetailComponent,
    resolve: {
      user: UserResolver, // TypeScript 現在能更好地推導 resolve 的型別
    },
  },
];
```

## 升級到 Angular 11

```bash
ng update @angular/core@11 @angular/cli@11

# 主要遷移點：
# 1. Webpack 5（實驗性）替換了 Webpack 4
# 2. TypeScript 4.0 支援（Angular 10 是 3.9）
# 3. IE 9/10 支援正式移除
```

**Webpack 5 實驗性支援**（Angular 11 中仍是實驗性）：

```javascript
// angular.json（開啟 Webpack 5 實驗性支援）
{
  "cli": {
    "packageManager": "yarn"
  }
}
// package.json
{
  "resolutions": {
    "webpack": "^5.0.0"
  }
}
```

## TypeScript 4.0 新特性支援

Angular 11 完整支援 TypeScript 4.0，可以使用新的可變元組型別：

```typescript
// TypeScript 4.0 可變元組型別
type Concat<T extends unknown[], U extends unknown[]> = [...T, ...U];
type Strings = Concat<[string, string], [string]>;
// type Strings = [string, string, string]

// 在 Angular 服務中的實際應用（引數型別推導更準確）
function concat<T extends unknown[], U extends unknown[]>(
  arr1: T,
  arr2: U,
): [...T, ...U] {
  return [...arr1, ...arr2];
}
```

## 總結

Angular 11 的 HMR 改進是每天都能感受到的開發體驗提升，而字型內聯則是零配置的效能最佳化。對現有 Angular 10 專案來說，這次升級幾乎沒有 breaking changes，升級成本極低，推薦儘快跟進。
