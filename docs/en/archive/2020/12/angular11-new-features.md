---
title: "Angular 11 New Features: HMR Support and Font Inlining Optimization"
date: 2020-12-05 10:59:50
tags:
  - Angular
readingTime: 2
description: "Angular 11 于 2020 年 11 月 11 日正式发布。相比 Angular 10 的\"质量版本\"，Angular 11 带来了更多开发体验方面的实质改进，其中 HMR 支持和字体内联是最值得关注的两个特性。"
---

Angular 11 于 2020 年 11 月 11 日正式发布。相比 Angular 10 的"质量版本"，Angular 11 带来了更多开发体验方面的实质改进，其中 HMR 支持和字体内联是最值得关注的两个特性。

## Out-of-the-Box HMR

Angular 11 之前，开启 HMR 需要手动修改 `main.ts`，配置繁琐。现在只需一个 CLI 参数：

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

HMR 开启后，修改组件的模板或样式只会更新该组件，而不是刷新整个页面，开发体验大幅提升。

## Font Inlining Optimization

Angular 11 CLI 默认会将 Google Fonts 的 CSS 内联到 HTML 中，避免额外的网络请求：

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

这个优化对 Lighthouse 的 LCP（最大内容绘制）分数有正向影响。

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

**Webpack 5 实验性支持**（Angular 11 中仍是实验性）：

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

Angular 11 完整支持 TypeScript 4.0，可以使用新的可变元组类型：

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

Angular 11 的 HMR 改进是每天都能感受到的开发体验提升，而字体内联则是零配置的性能优化。对现有 Angular 10 项目来说，这次升级几乎没有 breaking changes，升级成本极低，推荐尽快跟进。
