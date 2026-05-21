---
title: "Angular 10 新特性：TypeScript 3.9 与严格模式配置"
date: 2020-07-17 09:48:23
tags:
  - Angular
readingTime: 2
description: "Angular 10 于 2020 年 6 月 24 日正式发布，距离 Angular 9 仅约 4 个月。这次版本主要聚焦于**质量和生态健康**：更严格的 TypeScript 配置、废弃旧版依赖、修复大量 bug。"
wordCount: 322
---

Angular 10 于 2020 年 6 月 24 日正式发布，距离 Angular 9 仅约 4 个月。这次版本主要聚焦于**质量和生态健康**：更严格的 TypeScript 配置、废弃旧版依赖、修复大量 bug。

## 新项目默认开启严格模式

Angular 10 CLI 创建新项目时提供严格模式选项：

```bash
ng new my-app --strict
```

严格模式会在 `tsconfig.json` 和 `angular.json` 中启用一系列配置：

```json
// tsconfig.json（strict 模式）
{
  "compilerOptions": {
    "strict": true, // TS 严格模式
    "noImplicitOverride": false,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true // 模板严格检查（Angular 9 引入）
  }
}
```

```json
// angular.json（strict 模式下的 budget 配置更严格）
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "500kb",   // 之前是 2mb
    "maximumError": "1mb"        // 之前是 5mb
  }
]
```

## TypeScript 3.9 支持

Angular 10 要求 TypeScript 3.9，带来了一些实用改进：

**`// @ts-expect-error` 注释**

```typescript
// 之前：用 @ts-ignore 压制错误（即使代码后来修好了，ignore 还在）
// @ts-ignore
const x: number = "hello";

// TypeScript 3.9：用 @ts-expect-error，如果下一行没有错误会报警告
// @ts-expect-error
const x: number = "hello"; // 有错误，正确
// @ts-expect-error
const y: number = 123; // 没有错误！TS 会提示这个注释是多余的
```

**条件类型推断改进**

```typescript
// 3.9 之前，某些联合类型的条件类型推断不正确
type IsString<T> = T extends string ? "yes" : "no";
type Test = IsString<string | number>;
// 3.9 之前：'yes' | 'no'（分布式）
// 3.9：仍然是分布式，但某些边界 case 修复了
```

## 废弃旧版依赖

Angular 10 开始**废弃**以下内容（Angular 12 会删除）：

- `ViewEncapsulation.Native` → 使用 `ViewEncapsulation.ShadowDom`
- `ModuleWithProviders` 的非泛型形式
- `ActivatedRoute` 的部分废弃属性
- 对 IE 9、10 和 IE Mobile 的支持

```typescript
// ❌ 废弃
@Component({
  encapsulation: ViewEncapsulation.Native
})

// ✅ 替代
@Component({
  encapsulation: ViewEncapsulation.ShadowDom
})
```

## Date Range Picker（Material UI）

Angular 10 在 Angular Material 中新增了日期范围选择器：

```html
<mat-date-range-input [rangePicker]="picker">
  <input matStartDate placeholder="开始日期" />
  <input matEndDate placeholder="结束日期" />
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

## 升级从 Angular 9

```bash
ng update @angular/core@10 @angular/cli@10

# 如果有 Material UI
ng update @angular/material@10
```

主要迁移内容：

1. 修复 `ViewEncapsulation.Native` → `ShadowDom` 的警告
2. `ModuleWithProviders<T>` 泛型参数补全（CLI 会自动处理）
3. 更新 TypeScript 到 3.9

## 总结

Angular 10 不是功能驱动的大版本，而是**工程质量驱动**的版本。严格模式默认开启对新项目来说是非常好的实践——从一开始就建立正确的类型习惯，比后期迁移成本低得多。
