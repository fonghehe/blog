---
title: "Angular 11 in Practice: Webpack 5 Integration and Full Strict Mode"
date: 2021-01-02 09:43:58
tags:
  - Angular
  - Webpack
  - TypeScript
  - CSS

readingTime: 2
description: "Angular 11 于 2020 年 11 月发布，进入新的一年，这里系统总结升级后最值得深入使用的两个特性：Webpack 5 实验性支持和严格模式。前者大幅提升构建速度，后者帮你从根源消灭一类 bug。"
---

Angular 11 于 2020 年 11 月发布，进入新的一年，这里系统总结升级后最值得深入使用的两个特性：Webpack 5 实验性支持和严格模式。前者大幅提升构建速度，后者帮你从根源消灭一类 bug。

## Enabling Webpack 5 Experimental Support

Angular 11 将 Webpack 5 列为实验性功能，正式稳定要等 Angular 12。但现在就可以体验它的持久化缓存：

```bash
# 1. 使用 yarn（Webpack 5 需要 yarn resolutions）
yarn set version berry  # 可选

# 2. package.json 添加 resolutions
```

```json
{
  "resolutions": {
    "webpack": "^5.0.0"
  },
  "scripts": {
    "postinstall": "ngcc"
  }
}
```

```bash
yarn install
```

```json
// angular.json - 开启实验性 Webpack 5
{
  "cli": {
    "packageManager": "yarn"
  }
}
```

**构建速度对比**（中型项目，约 150 个组件）：

|           | 首次构建 | 增量构建（持久化缓存后） |
| --------- | -------- | ------------------------ |
| Webpack 4 | 45s      | 18s                      |
| Webpack 5 | 38s      | **4s**                   |

持久化缓存带来的 4s 增量构建是最大收益——日常开发中几乎感觉不到等待。

## Strict Mode: All at Once

新项目用 `ng new --strict` 默认开启。老项目需要手动启用：

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

### strictTemplates 捕获的典型错误

**1. 可选链问题**

```html
<!-- ❌ user 可能是 null，严格模式会报错 -->
<p>{{ user.name }}</p>

<!-- ✅ 方式一：使用 *ngIf -->
<p *ngIf="user">{{ user.name }}</p>

<!-- ✅ 方式二：可选链 -->
<p>{{ user?.name }}</p>
```

**2. EventEmitter 类型推断**

```typescript
// ❌ 没有类型参数，严格模式下 $event 为 any
@Output() selected = new EventEmitter();

// ✅ 明确类型
@Output() selected = new EventEmitter<User>();
```

**3. ngFor 的 trackBy 类型**

```typescript
// ❌ 严格模式下，trackBy 函数参数类型必须匹配
// trackBy(index: number, item) - item 是 any

// ✅ 明确类型
trackByUser(index: number, user: User): number {
  return user.id;
}
```

## Font Inlining

Angular 11 默认在构建时将 Google Fonts 的 CSS 内联，减少一次网络往返：

```json
// angular.json - 默认已开启，如需关闭：
{
  "build": {
    "options": {
      "optimization": {
        "fonts": false
      }
    }
  }
}
```

对 LCP（最大内容绘制）指标有正向影响，推荐保持开启。

## strictInputAccessModifiers

这是 Angular 11 新增的编译器选项，防止从模板访问 private/protected 属性：

```typescript
@Component({
  template: `{{ privateData }}`, // ❌ 严格模式报错
})
export class MyComponent {
  private privateData = "secret";
  protected protectedData = "also restricted";
}
```

这个规则强制模板只使用 public API，有助于组件封装。

## Upgrade Steps

```bash
ng update @angular/core@11 @angular/cli@11
ng update @angular/material@11  # 如果使用 Material

# 查看升级指南
ng update --list
```

## Summary

Angular 11 对现有项目来说是低风险高收益的升级。严格模式值得在年初规划一次全面开启——配合 TypeScript 4.1 的模板字面量类型，2021 年 Angular 项目的类型安全会上一个台阶。
