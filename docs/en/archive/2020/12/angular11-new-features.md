---
title: "Angular 11 New Features: HMR Support and Font Inlining Optimization"
date: 2020-12-05 10:59:50
tags:
  - Angular
readingTime: 2
description: "Angular 11 shipped on November 11, 2020. Compared with Angular 10's 'quality release,' Angular 11 delivers more substantive developer-experience improvements — HMR support and font inlining are the two features most worth watching."
wordCount: 203
---

Angular 11 was officially released on November 11, 2020. Compared to Angular 10's "quality release," Angular 11 brings more substantial developer-experience improvements, with HMR support and font inlining being the two most notable.

## Out-of-the-Box HMR

Before Angular 11, enabling HMR meant manually editing `main.ts` — a fiddly setup. Now it takes just a single CLI flag:

```bash
# Angular 11 之前的 HMR 配置（繁琐）
# 1. 修改 angular.json
# 2. 修改 main.ts 添加 module.hot 判断
# 3. 安装 @angularclass/hmr

# Angular 11：一行命令
ng serve --hmr

# 或在 angular.json 中永久开启
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

With HMR on, editing a component's template or styles updates just that component instead of reloading the whole page — a big lift to the developer experience.

## Font Inlining Optimization

The Angular 11 CLI inlines Google Fonts CSS into the HTML by default, avoiding an extra network request:

```html
<!-- 之前：需要一次额外的 HTTP 请求 -->
<link
  href="https://fonts.googleapis.com/css2?family=Roboto&display=swap"
  rel="stylesheet"
/>

<!-- Angular 11 构建后自动内联（仅 CSS，字体文件本身仍 CDN 加载）-->
<style>
  /* 内联字体 CSS，省去一次 DNS 解析 + HTTP 请求 */
  @font-face {
    font-family: "Roboto";
    src: url("https://fonts.gstatic.com/s/roboto/...") format("woff2");
  }
</style>
```

This optimization has a positive effect on Lighthouse's LCP (Largest Contentful Paint) score.

## Stricter NgModule Type Checking

```typescript
// Angular 11 对 NgModule 的 declarations 进行更严格的类型检查
@NgModule({
  declarations: [
    AppComponent,
    // ❌ 在 Angular 11 之前，把 Service 错误放在 declarations 里不会立即报错
    // UserService  // 现在会明确报错：UserService is not a component/directive/pipe
  ]
})
```

## Router Improvements: Stricter Types

```typescript
// Angular 11 的 Router 提供了更好的类型推导
const routes: Routes = [
  {
    path: "users/:id",
    component: UserDetailComponent,
    resolve: {
      user: UserResolver, // TypeScript 现在能更好地推导 resolve 的类型
    },
  },
];
```

## Upgrading to Angular 11

```bash
ng update @angular/core@11 @angular/cli@11

# 主要迁移点：
# 1. Webpack 5（实验性）替换了 Webpack 4
# 2. TypeScript 4.0 支持（Angular 10 是 3.9）
# 3. IE 9/10 支持正式移除
```

**Experimental Webpack 5 support** (still experimental in Angular 11):

```javascript
// angular.json（开启 Webpack 5 实验性支持）
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

## TypeScript 4.0 New Feature Support

Angular 11 fully supports TypeScript 4.0, so you can use the new variadic tuple types:

```typescript
// TypeScript 4.0 可变元组类型
type Concat<T extends unknown[], U extends unknown[]> = [...T, ...U];
type Strings = Concat<[string, string], [string]>;
// type Strings = [string, string, string]

// 在 Angular 服务中的实际应用（参数类型推导更准确）
function concat<T extends unknown[], U extends unknown[]>(
  arr1: T,
  arr2: U,
): [...T, ...U] {
  return [...arr1, ...arr2];
}
```

## Summary

Angular 11's HMR improvement is a developer-experience win you feel every day, while font inlining is a zero-config performance optimization. For existing Angular 10 projects, this upgrade introduces almost no breaking changes, so the cost is minimal — I'd recommend moving to it soon.
