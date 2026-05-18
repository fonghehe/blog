---
title: "Angular 10 新特性：TypeScript 3.9 與嚴格模式配置"
date: 2020-07-17 09:48:23
tags:
  - Angular
readingTime: 2
description: "Angular 10 於 2020 年 6 月 24 日正式發佈，距離 Angular 9 僅約 4 個月。這次版本主要聚焦於**質量和生態健康**：更嚴格的 TypeScript 配置、廢棄舊版依賴、修復大量 bug。"
---

Angular 10 於 2020 年 6 月 24 日正式發佈，距離 Angular 9 僅約 4 個月。這次版本主要聚焦於**質量和生態健康**：更嚴格的 TypeScript 配置、廢棄舊版依賴、修復大量 bug。

## 新項目默認開啓嚴格模式

Angular 10 CLI 創建新項目時提供嚴格模式選項：

```bash
ng new my-app --strict
```

嚴格模式會在 `tsconfig.json` 和 `angular.json` 中啓用一系列配置：

```json
// tsconfig.json（strict 模式）
{
  "compilerOptions": {
    "strict": true, // TS 嚴格模式
    "noImplicitOverride": false,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true // 模板嚴格檢查（Angular 9 引入）
  }
}
```

```json
// angular.json（strict 模式下的 budget 配置更嚴格）
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "500kb",   // 之前是 2mb
    "maximumError": "1mb"        // 之前是 5mb
  }
]
```

## TypeScript 3.9 支持

Angular 10 要求 TypeScript 3.9，帶來了一些實用改進：

**`// @ts-expect-error` 註釋**

```typescript
// 之前：用 @ts-ignore 壓制錯誤（即使代碼後來修好了，ignore 還在）
// @ts-ignore
const x: number = "hello";

// TypeScript 3.9：用 @ts-expect-error，如果下一行沒有錯誤會報警告
// @ts-expect-error
const x: number = "hello"; // 有錯誤，正確
// @ts-expect-error
const y: number = 123; // 沒有錯誤！TS 會提示這個註釋是多餘的
```

**條件類型推斷改進**

```typescript
// 3.9 之前，某些聯合類型的條件類型推斷不正確
type IsString<T> = T extends string ? "yes" : "no";
type Test = IsString<string | number>;
// 3.9 之前：'yes' | 'no'（分佈式）
// 3.9：仍然是分佈式，但某些邊界 case 修復了
```

## 廢棄舊版依賴

Angular 10 開始**廢棄**以下內容（Angular 12 會刪除）：

- `ViewEncapsulation.Native` → 使用 `ViewEncapsulation.ShadowDom`
- `ModuleWithProviders` 的非泛型形式
- `ActivatedRoute` 的部分廢棄屬性
- 對 IE 9、10 和 IE Mobile 的支持

```typescript
// ❌ 廢棄
@Component({
  encapsulation: ViewEncapsulation.Native
})

// ✅ 替代
@Component({
  encapsulation: ViewEncapsulation.ShadowDom
})
```

## Date Range Picker（Material UI）

Angular 10 在 Angular Material 中新增了日期範圍選擇器：

```html
<mat-date-range-input [rangePicker]="picker">
  <input matStartDate placeholder="開始日期" />
  <input matEndDate placeholder="結束日期" />
</mat-date-range-input>
<mat-date-range-picker #picker></mat-date-range-picker>
```

```typescript
form = this.fb.group({
  dateRange: this.fb.group({
    start: [null],
    end: [null],
  }),
});
```

## 升級從 Angular 9

```bash
ng update @angular/core@10 @angular/cli@10

# 如果有 Material UI
ng update @angular/material@10
```

主要遷移內容：

1. 修復 `ViewEncapsulation.Native` → `ShadowDom` 的警告
2. `ModuleWithProviders<T>` 泛型參數補全（CLI 會自動處理）
3. 更新 TypeScript 到 3.9

## 總結

Angular 10 不是功能驅動的大版本，而是**工程質量驅動**的版本。嚴格模式默認開啓對新項目來説是非常好的實踐——從一開始就建立正確的類型習慣，比後期遷移成本低得多。
