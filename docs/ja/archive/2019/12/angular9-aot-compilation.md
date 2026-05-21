---
title: "Angular 9 Beta：AOTコンパイルのデフォルト有効化とバンドルサイズ最適化"
date: 2019-12-20 09:57:10
tags:
  - Angular
readingTime: 2
description: "Angular 9 目前处于 Beta 阶段，预计 2020 年初正式发布。最大的变化是 Ivy 渲染引擎将成为默认，连带着 AOT 也将默认开启。这两个变化对包体积和模板类型安全都有显著影响。"
wordCount: 383
---

Angular 9 目前处于 Beta 阶段，预计 2020 年初正式发布。最大的变化是 Ivy 渲染引擎将成为默认，连带着 AOT 也将默认开启。这两个变化对包体积和模板类型安全都有显著影响。

## AOT vs JIT おさらい

| 特性                | JIT（运行时编译）          | AOT（构建时编译） |
| ------------------- | -------------------------- | ----------------- |
| 编译时机            | 运行时                     | 构建时            |
| 用户初始加载速度    | 慢（需要下载并解析编译器） | 快                |
| Bundle 中包含编译器 | 是（+~100KB）              | 否                |
| 模板错误检测        | 运行时                     | 构建时            |
| Tree-shaking 效果   | 差                         | 好                |

在 Angular 8 中，dev 模式默认是 JIT，production 才用 AOT。Angular 9 将两种模式都切成 AOT。

## Ivy + AOTによるバンドルサイズ削減

根据 Angular 团队公布的数据：

- **小型应用**：减小约 30%
- **中型应用**：减小约 40%
- **大型应用**：收益相对较小，但 tree-shaking 效果改善明显

## strictTemplatesオプション

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

开启后，模板里的类型错误将在构建时就被捕获，而不是在运行时。

## 移行時のよくある問題

**1. ViewChild 需要指定 `{ static }` 选项**

```typescript
// Angular 8+ 必须显式指定
// static: true  = 在 ngOnInit 中可用
// static: false = 在 ngAfterViewInit 中可用
@ViewChild('myRef', { static: false }) myRef: ElementRef;
```

**2. Renderer2 替代 Renderer**

```typescript
// ❌ Renderer 已在 Ivy 中删除
// ✅ 用 Renderer2
constructor(private renderer: Renderer2) {}
```

**3. 模板类型错误修复**

```html
<!-- ❌ 类型不匹配会报错 -->
<app-user [userId]="'123'"></app-user>
<!-- 如果 userId 是 number -->

<!-- ✅ 类型匹配 -->
<app-user [userId]="123"></app-user>
```

## アップグレード手順

```bash
# 待正式发布后
npm install @angular/core@9 @angular/cli@9

# 或者用 ng update
ng update @angular/core @angular/cli
# CLI 自动运行 migration schematic 处理 ViewChild static 等问题
```

## まとめ

Angular 9 的核心是“默认更好”——AOT 默认开启让开发模式与生产模式一致，消除了“本地正常上线打破”的经典问题。Ivy 的体积收益将让 Angular 应用在性能指标上更具竞争力。
