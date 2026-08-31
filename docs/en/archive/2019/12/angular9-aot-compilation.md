---
title: "Angular 9 Beta: AOT Compilation Enabled by Default and Bundle Size Optimization"
date: 2019-12-20 09:57:10
tags:
  - Angular
readingTime: 2
description: "Angular 9 is currently in beta and is expected to ship in early 2020. The biggest change is that the Ivy rendering engine becomes the default, and with it AOT compilation is enabled by default as well. Both changes have a significant impact on bundle size and template type safety."
wordCount: 240
---

Angular 9 is currently in beta and is expected to ship in early 2020. The biggest change is that the Ivy rendering engine becomes the default, and with it AOT compilation is enabled by default as well. Both changes have a significant impact on bundle size and template type safety.

## AOT vs JIT Review

| Feature             | JIT (compiled at runtime)  | AOT (compiled at build time) |
| ------------------- | -------------------------- | ---------------------------- |
| Compile time        | Runtime                    | Build time                   |
| Initial page load   | Slow (downloads & parses the compiler) | Fast               |
| Compiler in bundle  | Yes (+~100KB)              | No                           |
| Template error detection | Runtime               | Build time                   |
| Tree-shaking        | Poor                       | Good                         |

In Angular 8, dev mode defaulted to JIT and only production used AOT. Angular 9 switches both modes to AOT.

## Bundle Size Benefits from Ivy + AOT

According to data published by the Angular team:

- **Small apps**: bundle size drops by about 30%
- **Medium apps**: drops by about 40%
- **Large apps**: the gains are relatively smaller, but the improvement in tree-shaking is noticeable

## strictTemplates Options

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": true, // 启用所有模板严格检查
    "strictInputTypes": true, // @Input() 类型检查
    "strictNullInputTypes": true, // 防止 null/undefined 传给 @Input
    "strictAttributeTypes": true, // DOM 属性类型检查
    "strictOutputEventTypes": true, // @Output() 事件类型检查
    "strictDomEventTypes": true // DOM 事件类型检查
  }
}
```

Once enabled, template type errors are caught at build time rather than at runtime.

## Common Migration Issues

**1. ViewChild now requires the `{ static }` option**

```typescript
// Angular 8+ 必须显式指定
// static: true  = 在 ngOnInit 中可用
// static: false = 在 ngAfterViewInit 中可用
@ViewChild('myRef', { static: false }) myRef: ElementRef;
```

**2. Use Renderer2 instead of Renderer**

```typescript
// ❌ Renderer 已在 Ivy 中删除
// ✅ 用 Renderer2
constructor(private renderer: Renderer2) {}
```

**3. Fixing template type errors**

```html
<!-- ❌ 类型不匹配会报错 -->
<app-user [userId]="'123'"></app-user>
<!-- 如果 userId 是 number -->

<!-- ✅ 类型匹配 -->
<app-user [userId]="123"></app-user>
```

## Upgrade Steps

```bash
# 待正式发布后
npm install @angular/core@9 @angular/cli@9

# 或者用 ng update
ng update @angular/core @angular/cli
# CLI 自动运行 migration schematic 处理 ViewChild static 等问题
```

## Summary

Angular 9's core philosophy is "better by default"—with AOT on by default, dev and production modes stay consistent, eliminating the classic "works on my machine but breaks in production" problem. Ivy's bundle-size wins make Angular apps more competitive on performance metrics.
