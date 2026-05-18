---
title: "Angular 22 RC 预览：全新编译器与增强 Zoneless 架构"
date: 2026-04-24 10:00:00
tags:
  - Angular
  - CSS
readingTime: 3
description: "Angular 22 Release Candidate 于 2026 年 4 月底发布，按惯例正式版将在约三周后的 5 月中旬到来。这是继 Angular 17 引入新模板语法以来最具影响力的版本——全新的 Ivy 第二代编译器（内部代号 \"Evergreen\"）将大幅缩短构建时间，并为 Signal 模型提供更深层"
---

Angular 22 Release Candidate 于 2026 年 4 月底发布，按惯例正式版将在约三周后的 5 月中旬到来。这是继 Angular 17 引入新模板语法以来最具影响力的版本——全新的 Ivy 第二代编译器（内部代号 "Evergreen"）将大幅缩短构建时间，并为 Signal 模型提供更深层的编译期优化。

## Evergreen 编译器：构建速度的质变

Angular 22 的核心是重写的编译器。相较于 Ivy，Evergreen 在增量编译场景下速度提升显著：

| 项目规模            | Ivy 冷启动 | Evergreen 冷启动 | Ivy 热重载 | Evergreen 热重载 |
| ------------------- | ---------- | ---------------- | ---------- | ---------------- |
| 小型（< 50 组件）   | 3.2s       | 1.8s             | 280ms      | 120ms            |
| 中型（50-200 组件） | 12s        | 5.5s             | 650ms      | 210ms            |
| 大型（200+ 组件）   | 38s        | 14s              | 1.8s       | 480ms            |

Evergreen 的核心优化：

- **增量依赖分析**：只重新分析受变更影响的模块子图，而非整个依赖树
- **并行类型检查**：将 TypeScript 类型检查分散到多个 Worker 并行执行
- **Signal 感知 tree-shaking**：编译期识别 Signal 依赖关系，更激进地消除死代码

## Signal 的编译期优化

Evergreen 编译器能在编译期静态分析 Signal 依赖图，生成更高效的变更检测代码：

```typescript
@Component({
  template: `
    <h1>{{ title() }}</h1>
    <p>{{ description() }}</p>
    <app-price [value]="price()" />
  `,
})
export class ProductComponent {
  title = signal("产品名称");
  description = signal("产品描述");
  price = signal(0);
}
```

Evergreen 会分析出 `<h1>` 只依赖 `title`，`<p>` 只依赖 `description`，因此当 `price` 变化时，只更新 `<app-price>` 的 DOM，而不触发整个组件重渲染。这在 Ivy 中需要手动拆分组件才能实现。

## Zoneless 架构的正式推荐

Angular 22 将 Zoneless 从"稳定"升级为"**官方推荐**"模式——新项目的 `ng new` 默认生成 Zoneless 配置：

```typescript
// angular.json 新项目默认配置
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "options": {
            "zoneless": true  // 22 开始是默认值
          }
        }
      }
    }
  }
}
```

```typescript
// main.ts 新项目模板
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // 默认包含
  ],
});
```

## 新增：资源预获取指令

Angular 22 RC 引入了声明式资源预获取，无需手动调用 `prefetchResource`：

```typescript
@Component({
  template: `
    <!-- 鼠标悬停时预获取详情数据 -->
    <a
      routerLink="/products/{{ id }}"
      ngPrefetch="hover"
      [ngPrefetchData]="productDetailPrefetch"
    >
      查看详情
    </a>
  `,
})
export class ProductListItemComponent {
  id = input.required<number>();

  productDetailPrefetch = httpResource(
    () => null, // 初始不加载
    { prefetchOnly: true }, // 仅预获取，不影响当前视图
  );
}
```

## 迁移到 Angular 22

RC 阶段可以提前验证升级兼容性：

```bash
# 安装 RC 版本
npm install @angular/core@22.0.0-rc.0 @angular/cli@22.0.0-rc.0

# 运行迁移 schematic
ng update @angular/core@22.0.0-rc.0 --migrate-only
```

主要 breaking changes：

1. **`NgModule` 的彻底可选化**：22 起，任何 `NgModule` 相关的 API 在新项目中均不会出现
2. **`ChangeDetectionStrategy.Default` 弃用**：现有项目可继续使用，但 IDE 会显示弃用警告
3. **`zone.js` 从默认依赖中移除**：不再自动安装，如需保留 zone 模式需手动添加

## 总结

Angular 22 RC 展示了一个在工具链和架构层面双双成熟的 Angular。Evergreen 编译器大幅改善了开发体验，Zoneless 的默认化标志着整个框架的技术路线已完全转向 Signal 驱动。正式版预计 5 月中旬发布，值得现在就在非关键项目上验证升级可行性。
