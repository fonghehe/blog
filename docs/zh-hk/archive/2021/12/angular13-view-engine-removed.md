---
title: "Angular 13 發佈：移除 View Engine 殘餘與 APF 重設計"
date: 2021-12-17 16:44:32
tags:
  - Angular
  - TypeScript
readingTime: 2
description: "Angular 13 於 2021 年 11 月 3 日正式發佈。這個版本最大的意義是**徹底清理歷史包袱**：完全移除 View Engine 相關代碼、廢棄 IE 11 支持、重新設計 Angular Package Format（APF）。對於已經在 Ivy 上穩定運行的項目，這次升級帶來了更小的依賴體積和更快的"
wordCount: 457
---

Angular 13 於 2021 年 11 月 3 日正式發佈。這個版本最大的意義是**徹底清理歷史包袱**：完全移除 View Engine 相關代碼、廢棄 IE 11 支持、重新設計 Angular Package Format（APF）。對於已經在 Ivy 上穩定運行的項目，這次升級帶來了更小的依賴體積和更快的編譯速度。

## 徹底移除 View Engine

Angular 12 標記了 View Engine 為廢棄，Angular 13 **完全刪除**了相關代碼：

- 移除 `@angular/compiler` 中的 View Engine 編譯邏輯
- 不再生成 `ngfactory` 和 `ngsummary` 文件
- `TestBed` 不再調用 `compileComponents()`（異步編譯）：

```typescript
// Angular 13 之前：TestBed 需要 async compileComponents
beforeEach(async () => {
  await TestBed.configureTestingModule({
    declarations: [MyComponent],
  }).compileComponents(); // 需要等待編譯
});

// Angular 13：不再需要 await compileComponents（Ivy 是同步的）
beforeEach(() => {
  TestBed.configureTestingModule({
    declarations: [MyComponent],
  });
  // 直接可用，無需 async
});
```

這讓測試代碼更簡潔，測試套件運行更快。

## 徹底廢棄 IE 11 支持

Angular 13 不再為 IE 11 構建額外的 polyfill 和兼容代碼：

```json
// angular.json - Angular 13 新建項目不再有 IE 相關配置
// 之前的 browserslist 配置（已移除）：
// IE 11

// .browserslistrc（Angular 13 默認）
last 1 Chrome version
last 1 Firefox version
last 2 Edge major versions
last 2 Safari major versions
last 2 iOS major versions
Firefox ESR
```

**影響**：

- 主包體積減少約 4KB（去掉 IE 相關 polyfill）
- 構建速度提升（不需要生成 ES5 兼容代碼）
- 如果你仍需支持 IE 11，**不要升級到 Angular 13**

## Angular Package Format（APF）重設計

APF 定義了 Angular 庫如何發佈到 npm。Angular 13 重新設計了 APF：

```
舊 APF（複雜）：
dist/
  esm2015/      ← ES2015 格式
  esm5/         ← ES5 格式（現在不需要了）
  fesm2015/     ← flat ES2015
  fesm5/        ← flat ES5（現在不需要了）
  bundles/      ← UMD 格式

新 APF（簡潔）：
dist/
  esm2020/      ← ES2020 格式（現代瀏覽器）
  fesm2020/     ← flat ES2020
  fesm2015/     ← flat ES2015（舊 Node.js 兼容）
```

移除了 ES5 產物，減少了庫的發佈體積 **約 25%**。

## 動態組件創建 API 簡化

Angular 13 簡化了 `ViewContainerRef.createComponent` 的 API：

```typescript
// Angular 13 之前：需要 ComponentFactoryResolver
const factory = this.resolver.resolveComponentFactory(DynamicComponent);
const componentRef = this.viewContainer.createComponent(factory);

// Angular 13：直接傳組件類
const componentRef = this.viewContainer.createComponent(DynamicComponent);
componentRef.instance.data = "some data";
```

`ComponentFactoryResolver` 仍然存在（兼容）但已廢棄，推薦用新 API。

## inline fonts 改進

Angular 13 的 CLI 改進了字體內聯策略，支持更多 Google Fonts 格式：

```html
<!-- Angular 13 構建後，字體 CSS 會被內聯 -->
<style>
  @font-face {
    font-family: "Inter";
    src: url("https://fonts.gstatic.com/s/inter/...") format("woff2");
    font-display: swap; /* 優化 CLS */
  }
</style>
```

`font-display: swap` 的自動添加對 CLS（累計佈局偏移）指標有正向影響。

## 升級到 Angular 13

```bash
ng update @angular/core@13 @angular/cli@13

# 主要自動遷移：
# 1. 移除 TestBed.compileComponents 的 async 包裝
# 2. 遷移廢棄的 ComponentFactoryResolver 用法
# 3. 更新 tsconfig 中的 target 到 ES2020
```

**升級前檢查**：

```bash
ng update --list
# 確保所有依賴都有 Angular 13 兼容版本
```

## 總結

Angular 13 是一個"清掃型"版本——刪掉歷史包袱，讓框架更輕、更快。移除 View Engine 和 IE 11 支持後，Angular 應用的構建產物平均減少 10-15%。如果你的用户中已經沒有 IE 11，這次升級性價比非常高。