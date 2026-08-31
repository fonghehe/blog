---
title: "Angular 12: Ivy Only, Webpack 5 Default, and Sass Upgrade"
date: 2021-07-30 10:56:08
tags:
  - Angular
  - Webpack
  - TypeScript

readingTime: 2
description: "Angular 12 was officially released on May 26, 2021. It's a milestone release: View Engine is retired for good and Ivy becomes the only rendering engine, while Webpack 5 moves from experimental to the default build tool. After upgrading, we put together a complete rundown of what changed."
wordCount: 351
---

Angular 12 was officially released on May 26, 2021. It's a milestone release: View Engine is retired for good and Ivy becomes the only rendering engine, while Webpack 5 moves from experimental to the default build tool. After upgrading, we put together a complete rundown of what changed.

## View Engine Is Officially Retired

In Angular 12, `@angular/compiler` no longer includes View Engine, and `ngcc` is no longer needed (every library is now published in the Ivy format).

**Impact on developers:**

- After upgrading to Angular 12, all of your project's dependencies must be Ivy-compatible.
- Using older third-party libraries (those not yet updated to Angular 9+) may throw errors.
- The `enableIvy: false` configuration is no longer valid.

## Webpack 5 Officially Becomes Default

```bash
# Angular 12 之前
ng new my-app  # 使用 Webpack 4

# Angular 12 之后
ng new my-app  # 使用 Webpack 5（持久化缓存默认开启）
```

**Real-world effect of the persistent cache** (tested on a medium-sized project):

```
首次 ng serve：28s
第二次 ng serve（无代码变化）：4s  ← 持久化缓存命中
修改一个组件后 ng serve：6s  ← 增量重建
```

The persistent cache is stored in the `.angular/cache` directory, so it's a good idea to add it to `.gitignore`:

```bash
echo ".angular/cache" >> .gitignore
```

## strictTemplates Is Now the Default for New Projects

Starting with Angular 12, every new project enables `strictTemplates` by default — no `--strict` flag required:

```json
// tsconfig.json（Angular 12 新项目默认配置）
{
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

## Sass API Update (Important!)

Angular 12 upgraded its Sass support, deprecating the legacy Node Sass API in favor of Dart Sass's modern API:

```bash
# 之前：需要 node-sass（C++ 依赖，安装麻烦）
npm install node-sass

# Angular 12：sass（纯 JS 实现）
npm install sass
```

**Migrating old Sass syntax:**

```scss
// ❌ 旧 API（已废弃）
@import "variables"; // 使用 @import

// ✅ 新 API
@use "variables" as v;
@use "mixins";

.button {
  color: v.$primary-color; // 使用命名空间
  @include mixins.flex-center;
}
```

The benefit of `@use` over `@import`: it avoids polluting the global scope, since each file declares its dependencies explicitly.

## Inline Sass Support

The Angular 12 CLI lets you write inline styles using Sass syntax inside components:

```typescript
@Component({
  selector: "app-button",
  template: `<button class="btn">点击</button>`,
  styles: [
    `
      $primary: #0066ff;
      .btn {
        background: $primary;
        &:hover {
          background: darken($primary, 10%);
        }
      }
    `,
  ],
})
export class ButtonComponent {}
```

## ng build Defaults to Production Mode

```bash
# Angular 12 之前
ng build           # 开发模式
ng build --prod    # 生产模式（需要显式指定）

# Angular 12 之后
ng build           # 生产模式（默认！）
ng build --configuration development  # 开发模式
```

This change prevents the common accident of shipping a development build because you forgot to pass `--prod`.

## Upgrading to Angular 12

```bash
ng update @angular/core@12 @angular/cli@12

# 主要迁移内容（CLI 自动处理）：
# 1. 更新 tsconfig 中废弃的选项
# 2. 迁移 ng build 默认配置
# 3. 更新 Sass 相关配置
```

**Note**: if you depend on a third-party library that hasn't moved to Ivy yet, the upgrade may fail. Check first with `ng update --list`:

```bash
ng update --list
# 会列出哪些包需要先升级
```

## Summary

Of all the Angular 12 changes, retiring View Engine is the most symbolic — the Ivy era has officially begun. Making Webpack 5 the default roughly doubles incremental build speed, and having `ng build` default to production mode eliminates a whole class of common deployment accidents. For the vast majority of projects this upgrade is low-risk, so we recommend adopting it soon.