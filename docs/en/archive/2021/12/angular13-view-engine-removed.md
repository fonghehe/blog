---
title: "Angular 13 Release: Removing View Engine Remnants and APF Redesign"
date: 2021-12-17 16:44:32
tags:
  - Angular
  - TypeScript

readingTime: 2
description: "Angular 13 was officially released on November 3, 2021. This release's biggest significance is thoroughly clearing out historical baggage: completely removing View Engine code, dropping IE 11 support, and redesigning the Angular Package Format (APF). For projects already on Ivy"
wordCount: 307
---

Angular 13 was officially released on November 3, 2021. The biggest significance of this release is that it **clears out legacy baggage**: it completely removes the View Engine code, deprecates IE 11 support, and redesigns the Angular Package Format (APF). For projects already running stably on Ivy, this upgrade brings a smaller dependency footprint and faster compile times.

## Complete Removal of View Engine

Angular 12 marked View Engine as deprecated; Angular 13 **fully removes** the related code:

- Removed the View Engine compilation logic from `@angular/compiler`
- No longer generates `ngfactory` and `ngsummary` files
- `TestBed` no longer calls `compileComponents()` (async compilation):

```typescript
// Angular 13 之前：TestBed 需要 async compileComponents
beforeEach(async () => {
  await TestBed.configureTestingModule({
    declarations: [MyComponent],
  }).compileComponents(); // 需要等待编译
});

// Angular 13：不再需要 await compileComponents（Ivy 是同步的）
beforeEach(() => {
  TestBed.configureTestingModule({
    declarations: [MyComponent],
  });
  // 直接可用，无需 async
});
```

This makes test code cleaner and test suites run faster.

## Dropping IE 11 Support Completely

Angular 13 no longer builds extra polyfills and compatibility code for IE 11:

```json
// angular.json - Angular 13 新建项目不再有 IE 相关配置
// 之前的 browserslist 配置（已移除）：
// IE 11

// .browserslistrc（Angular 13 默认）
last 1 Chrome version
last 1 Firefox version
last 2 Edge major versions
last 2 Safari major versions
last 2 iOS major versions
Firefox ESR
```

**Impact**:

- Main bundle size reduced by about 4 KB (IE-related polyfills removed)
- Faster builds (no need to generate ES5-compatible code)
- If you still need to support IE 11, **do not upgrade to Angular 13**

## Redesigning the Angular Package Format (APF)

APF defines how Angular libraries are published to npm. Angular 13 redesigned the APF:

```
旧 APF（复杂）：
dist/
  esm2015/      ← ES2015 格式
  esm5/         ← ES5 格式（现在不需要了）
  fesm2015/     ← flat ES2015
  fesm5/        ← flat ES5（现在不需要了）
  bundles/      ← UMD 格式

新 APF（简洁）：
dist/
  esm2020/      ← ES2020 格式（现代浏览器）
  fesm2020/     ← flat ES2020
  fesm2015/     ← flat ES2015（旧 Node.js 兼容）
```

By removing the ES5 artifacts, the published size of libraries was reduced by **about 25%**.

## Simplified Dynamic Component Creation API

Angular 13 simplified the `ViewContainerRef.createComponent` API:

```typescript
// Angular 13 之前：需要 ComponentFactoryResolver
const factory = this.resolver.resolveComponentFactory(DynamicComponent);
const componentRef = this.viewContainer.createComponent(factory);

// Angular 13：直接传组件类
const componentRef = this.viewContainer.createComponent(DynamicComponent);
componentRef.instance.data = "some data";
```

`ComponentFactoryResolver` still exists (for compatibility) but is deprecated; the new API is recommended.

## Inline Fonts Improvements

Angular 13's CLI improved its font-inlining strategy, supporting more Google Fonts formats:

```html
<!-- Angular 13 构建后，字体 CSS 会被内联 -->
<style>
  @font-face {
    font-family: "Inter";
    src: url("https://fonts.gstatic.com/s/inter/...") format("woff2");
    font-display: swap; /* 优化 CLS */
  }
</style>
```

Automatically adding `font-display: swap` has a positive impact on the CLS (Cumulative Layout Shift) metric.

## Upgrading to Angular 13

```bash
ng update @angular/core@13 @angular/cli@13

# 主要自动迁移：
# 1. 移除 TestBed.compileComponents 的 async 包装
# 2. 迁移废弃的 ComponentFactoryResolver 用法
# 3. 更新 tsconfig 中的 target 到 ES2020
```

**Pre-upgrade checklist**:

```bash
ng update --list
# 确保所有依赖都有 Angular 13 兼容版本
```

## Summary

Angular 13 is a "cleanup" release — it clears out legacy baggage, making the framework lighter and faster. After removing View Engine and IE 11 support, Angular apps' build output shrinks by an average of 10–15%. If none of your users are on IE 11, this upgrade offers excellent value.
