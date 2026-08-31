---
title: "Angular 11 in Practice: Webpack 5 Integration and Full Strict Mode"
date: 2021-01-02 09:43:58
tags:
  - Angular
  - Webpack
  - TypeScript
  - CSS

readingTime: 2
description: "Angular 11 shipped in November 2020. Entering the new year, this article sums up the two post-upgrade features most worth going deep on: experimental Webpack 5 support and full strict mode. The first speeds up builds significantly; the second eliminates a whole class of bugs at the root."
wordCount: 279
---

Angular 11 was released in November 2020. As we step into the new year, here's a systematic look at the two features most worth adopting after upgrading: experimental Webpack 5 support and strict mode. The former dramatically speeds up builds; the latter helps you eliminate an entire class of bugs at the source.

## Enabling Webpack 5 Experimental Support

Angular 11 ships Webpack 5 as an experimental feature; it won't be stable until Angular 12. But you can already try out its persistent cache:

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

**Build speed comparison** (medium project, ~150 components):

|           | First build | Incremental build (with persistent cache) |
| --------- | -------- | ------------------------ |
| Webpack 4 | 45s      | 18s                      |
| Webpack 5 | 38s      | **4s**                   |

The 4-second incremental builds enabled by persistent caching are the biggest win — in day-to-day development you barely notice any wait.

## Strict Mode: All at Once

New projects get it by default with `ng new --strict`. Existing projects need to enable it manually:

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

### Typical errors caught by strictTemplates

**1. Optional chaining issues**

```html
<!-- ❌ user 可能是 null，严格模式会报错 -->
<p>{{ user.name }}</p>

<!-- ✅ 方式一：使用 *ngIf -->
<p *ngIf="user">{{ user.name }}</p>

<!-- ✅ 方式二：可选链 -->
<p>{{ user?.name }}</p>
```

**2. EventEmitter type inference**

```typescript
// ❌ 没有类型参数，严格模式下 $event 为 any
@Output() selected = new EventEmitter();

// ✅ 明确类型
@Output() selected = new EventEmitter<User>();
```

**3. trackBy typing in ngFor**

```typescript
// ❌ 严格模式下，trackBy 函数参数类型必须匹配
// trackBy(index: number, item) - item 是 any

// ✅ 明确类型
trackByUser(index: number, user: User): number {
  return user.id;
}
```

## Font Inlining

Angular 11 inlines the Google Fonts CSS at build time by default, removing one network round trip:

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

This has a positive effect on LCP (Largest Contentful Paint), so I'd keep it on.

## strictInputAccessModifiers

This is a new compiler option in Angular 11 that prevents templates from accessing private/protected properties:

```typescript
@Component({
  template: `{{ privateData }}`, // ❌ 严格模式报错
})
export class MyComponent {
  private privateData = "secret";
  protected protectedData = "also restricted";
}
```

This rule forces templates to use only the public API, which helps with component encapsulation.

## Upgrade Steps

```bash
ng update @angular/core@11 @angular/cli@11
ng update @angular/material@11  # 如果使用 Material

# 查看升级指南
ng update --list
```

## Summary

For existing projects, Angular 11 is a low-risk, high-reward upgrade. Strict mode is worth planning a full rollout for early in the year — combined with TypeScript 4.1's template literal types, the type safety of Angular projects in 2021 takes a real step up.
