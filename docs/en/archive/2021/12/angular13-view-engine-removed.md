---
title: "Angular 13 Release: Removing View Engine Remnants and APF Redesign"
date: 2021-12-17 16:44:32
tags:
  - Angular
  - TypeScript

readingTime: 2
description: "Angular 13 于 2021 年 11 月 3 日正式发布。这个版本最大的意义是**彻底清理历史包袱**：完全移除 View Engine 相关代码、废弃 IE 11 支持、重新设计 Angular Package Format（APF）。对于已经在 Ivy 上稳定运行的项目，这次升级带来了更小的依赖体积和更快的"
wordCount: 447
---

Angular 13 于 2021 年 11 月 3 日正式发布。这个版本最大的意义是**彻底清理历史包袱**：完全移除 View Engine 相关代码、废弃 IE 11 支持、重新设计 Angular Package Format（APF）。对于已经在 Ivy 上稳定运行的项目，这次升级带来了更小的依赖体积和更快的编译速度。

## Complete Removal of View Engine

Angular 12 标记了 View Engine 为废弃，Angular 13 **完全删除**了相关代码：

- 移除 `@angular/compiler` 中的 View Engine 编译逻辑
- 不再生成 `ngfactory` 和 `ngsummary` 文件
- `TestBed` 不再调用 `compileComponents()`（异步编译）：

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

这让测试代码更简洁，测试套件运行更快。

## Dropping IE 11 Support Completely

Angular 13 不再为 IE 11 构建额外的 polyfill 和兼容代码：

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

**影响**：

- 主包体积减少约 4KB（去掉 IE 相关 polyfill）
- 构建速度提升（不需要生成 ES5 兼容代码）
- 如果你仍需支持 IE 11，**不要升级到 Angular 13**

## Angular Package Format（APF）重设计

APF 定义了 Angular 库如何发布到 npm。Angular 13 重新设计了 APF：

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

移除了 ES5 产物，减少了库的发布体积 **约 25%**。

## Simplified Dynamic Component Creation API

Angular 13 简化了 `ViewContainerRef.createComponent` 的 API：

```typescript
// Angular 13 之前：需要 ComponentFactoryResolver
const factory = this.resolver.resolveComponentFactory(DynamicComponent);
const componentRef = this.viewContainer.createComponent(factory);

// Angular 13：直接传组件类
const componentRef = this.viewContainer.createComponent(DynamicComponent);
componentRef.instance.data = "some data";
```

`ComponentFactoryResolver` 仍然存在（兼容）但已废弃，推荐用新 API。

## inline fonts 改进

Angular 13 的 CLI 改进了字体内联策略，支持更多 Google Fonts 格式：

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

`font-display: swap` 的自动添加对 CLS（累计布局偏移）指标有正向影响。

## Upgrading to Angular 13

```bash
ng update @angular/core@13 @angular/cli@13

# 主要自动迁移：
# 1. 移除 TestBed.compileComponents 的 async 包装
# 2. 迁移废弃的 ComponentFactoryResolver 用法
# 3. 更新 tsconfig 中的 target 到 ES2020
```

**升级前检查**：

```bash
ng update --list
# 确保所有依赖都有 Angular 13 兼容版本
```

## Summary

Angular 13 是一个"清扫型"版本——删掉历史包袱，让框架更轻、更快。移除 View Engine 和 IE 11 支持后，Angular 应用的构建产物平均减少 10-15%。如果你的用户中已经没有 IE 11，这次升级性价比非常高。