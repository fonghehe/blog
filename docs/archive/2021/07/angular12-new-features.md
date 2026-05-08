---
title: "Angular 12 新特性：Ivy 独占、Webpack 5 默认与 Sass 升级"
date: 2021-07-30 10:56:08
tags:
  - Angular
---

Angular 12 于 2021 年 5 月 26 日正式发布。这是一个里程碑版本：View Engine 正式退场，Ivy 成为唯一渲染引擎；Webpack 5 从实验性升级为默认构建工具。升级之后我们整理了一份完整的变化记录。

## View Engine 正式停用

Angular 12 中 `@angular/compiler` 不再包含 View Engine，`ngcc` 也不再需要（因为所有库都已用 Ivy 格式发布）。

**对开发者的影响**：

- 升级 Angular 12 后，项目需要所有依赖都是 Ivy 兼容版本
- 使用旧版第三方库（未更新到 Angular 9+ 的）可能报错
- `enableIvy: false` 配置不再有效

## Webpack 5 正式成为默认

```bash
# Angular 12 之前
ng new my-app  # 使用 Webpack 4

# Angular 12 之后
ng new my-app  # 使用 Webpack 5（持久化缓存默认开启）
```

**持久化缓存的实际效果**（中型项目测试）：

```
首次 ng serve：28s
第二次 ng serve（无代码变化）：4s  ← 持久化缓存命中
修改一个组件后 ng serve：6s  ← 增量重建
```

持久化缓存存储在 `.angular/cache` 目录，建议加入 `.gitignore`：

```bash
echo ".angular/cache" >> .gitignore
```

## strictTemplates 成为新项目默认

Angular 12 开始，所有新项目默认启用 `strictTemplates`，无需 `--strict` flag：

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

## Sass API 更新（重要！）

Angular 12 升级了对 Sass 的支持，废弃旧版 Node Sass API，改用 Dart Sass 的现代 API：

```bash
# 之前：需要 node-sass（C++ 依赖，安装麻烦）
npm install node-sass

# Angular 12：sass（纯 JS 实现）
npm install sass
```

**迁移旧的 Sass 写法**：

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

`@use` 替代 `@import` 的好处：避免全局作用域污染，每个文件明确声明依赖。

## Inline Sass（内联样式支持）

Angular 12 的 CLI 支持在组件里用 Sass 语法写内联样式：

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

## ng build 默认生产模式

```bash
# Angular 12 之前
ng build           # 开发模式
ng build --prod    # 生产模式（需要显式指定）

# Angular 12 之后
ng build           # 生产模式（默认！）
ng build --configuration development  # 开发模式
```

这个改变防止了"忘记加 `--prod` 就发布了开发版本"的事故。

## 升级到 Angular 12

```bash
ng update @angular/core@12 @angular/cli@12

# 主要迁移内容（CLI 自动处理）：
# 1. 更新 tsconfig 中废弃的选项
# 2. 迁移 ng build 默认配置
# 3. 更新 Sass 相关配置
```

**注意**：如果依赖了未升级到 Ivy 的第三方库，升级可能失败。先用 `ng update --list` 检查：

```bash
ng update --list
# 会列出哪些包需要先升级
```

## 总结

Angular 12 的变化里，View Engine 退场是最有象征意义的——Ivy 时代正式开始。Webpack 5 默认开启让增量构建速度翻倍，`ng build` 默认生产模式则消除了一类常见的部署事故。这次升级对绝大多数项目来说是低风险的，推荐尽快跟进。