---
title: "Angular 10 New Features: TypeScript 3.9 and Strict Mode Configuration"
date: 2020-07-17 09:48:23
tags:
  - Angular
readingTime: 2
description: "Angular 10 was officially released on June 24, 2020, only about four months after Angular 9. This release focuses mainly on **quality and ecosystem health**: stricter TypeScript configuration, deprecation of legacy dependencies, and a large number of bug fixes."
wordCount: 217
---

Angular 10 was officially released on June 24, 2020, only about four months after Angular 9. This release focuses mainly on **quality and ecosystem health**: stricter TypeScript configuration, deprecation of legacy dependencies, and a large number of bug fixes.

## Strict Mode Enabled by Default for New Projects

When you create a new project, the Angular 10 CLI offers a strict mode option:

```bash
ng new my-app --strict
```

Strict mode enables a series of settings in `tsconfig.json` and `angular.json`:

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

## TypeScript 3.9 Support

Angular 10 requires TypeScript 3.9, which brings several practical improvements:

**`// @ts-expect-error` comment**

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

**Improved Conditional Type Inference**

```typescript
// 3.9 之前，某些联合类型的条件类型推断不正确
type IsString<T> = T extends string ? "yes" : "no";
type Test = IsString<string | number>;
// 3.9 之前：'yes' | 'no'（分布式）
// 3.9：仍然是分布式，但某些边界 case 修复了
```

## Deprecating Legacy Dependencies

Angular 10 begins **deprecating** the following (they will be removed in Angular 12):

- `ViewEncapsulation.Native` → use `ViewEncapsulation.ShadowDom`
- Non-generic form of `ModuleWithProviders`
- Certain deprecated properties on `ActivatedRoute`
- Support for IE 9, 10, and IE Mobile

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

## Date Range Picker (Material UI)

Angular 10 adds a date range picker to Angular Material:

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

## Upgrading from Angular 9

```bash
ng update @angular/core@10 @angular/cli@10

# 如果有 Material UI
ng update @angular/material@10
```

The main migration steps are:

1. Fix `ViewEncapsulation.Native` → `ShadowDom` warnings
2. Add the generic parameter to `ModuleWithProviders<T>` (the CLI handles this automatically)
3. Update TypeScript to 3.9

## Summary

Angular 10 is not a feature-driven major release, but an **engineering-quality-driven** one. Enabling strict mode by default is a great practice for new projects — building the right typing habits from the start costs far less than migrating later.
