---
title: "CSS 容器查询 2026 实践：组件级响应式设计"
date: 2026-06-04 16:38:53
tags:
  - CSS
  - 响应式设计
readingTime: 4
description: "容器查询让组件能够根据自身容器的尺寸调整布局，而不是依赖视口宽度。本文讨论 2026 年容器查询的实战用法、常见陷阱和与 Grid、Flex 的配合策略。"
wordCount: 874
---

CSS 容器查询（Container Queries）是响应式设计的一次范式转变。传统的媒体查询基于视口宽度，但组件在实际使用中往往不知道自己会被放在多宽的容器里。容器查询解决了这个问题——让组件根据"自己的环境"来调整样式。

## 基础语法

容器查询的核心是两个属性：`container-type` 和 `@container`：

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

`container-type` 有三个值：
- `inline-size`：只监听行内方向的尺寸变化（最常用）
- `size`：同时监听行内和块方向
- `normal`：不作为容器查询的目标

## 容器查询 vs 媒体查询

两者的适用场景不同：

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 页面整体布局 | 媒体查询 | 视口宽度决定整体布局 |
| 卡片组件 | 容器查询 | 卡片在不同容器中宽度不同 |
| 导航栏 | 媒体查询 | 通常受视口宽度控制 |
| 表单组件 | 容器查询 | 表单可能在侧边栏或主内容区 |
| 隐藏/显示元素 | 媒体查询 | 通常由视口决定 |

原则：**组件自身需要根据环境调整 → 容器查询；页面整体布局 → 媒体查询**。

## 实际案例：自适应卡片

一个典型的卡片组件，在不同容器宽度下有三种布局：

```css
.card-wrapper {
  container-type: inline-size;
}

.card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

/* 窄容器：垂直布局 */
@container (max-width: 300px) {
  .card {
    flex-direction: column;
  }
  .card-image {
    aspect-ratio: 16/9;
    width: 100%;
  }
}

/* 中等容器：水平布局，图片在左 */
@container (min-width: 301px) and (max-width: 600px) {
  .card {
    flex-direction: row;
  }
  .card-image {
    width: 120px;
    flex-shrink: 0;
  }
}

/* 宽容器：水平布局，图片更大 */
@container (min-width: 601px) {
  .card {
    flex-direction: row;
  }
  .card-image {
    width: 200px;
    flex-shrink: 0;
  }
}
```

这个组件可以放在侧边栏（窄）、主内容区（中）或全宽区域（宽），都能自动适配。

## 容器查询单位

容器查询引入了新的相对单位：

```css
.card-title {
  /* cqi: 容器内联尺寸的 1% */
  font-size: clamp(1rem, 3cqi, 1.5rem);
}

.card-meta {
  font-size: 2cqi;
  line-height: 1.5;
}
```

单位列表：
- `cqw`：容器宽度的 1%
- `cqh`：容器高度的 1%
- `cqi`：容器内联尺寸的 1%
- `cqb`：容器块尺寸的 1%
- `cqmin`：cqi 和 cqb 中较小的
- `cqmax`：cqi 和 cqb 中较大的

## 容器查询与 Grid 的配合

容器查询和 CSS Grid 是天然搭档。组件内部用容器查询调整细节，外部用 Grid 控制整体布局：

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.widget-container {
  container-type: inline-size;
}

@container (min-width: 500px) {
  .widget {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

Grid 决定"有多少空间"，容器查询决定"怎么利用空间"。

## 常见陷阱

**陷阱 1：忘记设置 container-type**

```css
/* 错误：没有声明容器类型 */
.sidebar {
  width: 300px;
}

@container (min-width: 400px) {
  .sidebar .widget { /* 这条规则不会生效 */ }
}
```

必须在父元素上设置 `container-type`。

**陷阱 2：容器查询嵌套**

```css
.outer {
  container-type: inline-size;
}

.inner {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .inner .content { /* 匹配 .outer 的容器 */ }
}

@container inner (min-width: 400px) {
  .inner .content { /* 匹配 .inner 的容器 */ }
}
```

嵌套容器时需要用 `container-name` 明确指定查询目标。

**陷阱 3：容器查询不支持样式查询**

2026 年容器查询只能查询尺寸，不能查询样式（如字体大小、颜色）。如果需要根据父元素样式调整，还是得用媒体查询或 CSS 变量。

## 渐进增强策略

容器查询的浏览器支持已经很好（2026 年覆盖率 >95%），但对于旧浏览器可以提供降级方案：

```css
/* 基础样式（不依赖容器查询） */
.card {
  display: flex;
  flex-direction: column;
}

/* 容器查询增强 */
@container (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

基础样式保证组件在任何环境下都可用，容器查询提供增强体验。

## 性能优化

容器查询的性能影响很小，但大规模使用时需要注意：

1. **避免过度嵌套**：容器层级太深会增加计算成本
2. **使用 `contain: layout inline-size`**：如果不需要样式查询，可以用这个更高效的属性
3. **批量处理**：多个容器查询条件可以合并

```css
/* 优化：使用 containment */
.widget {
  contain: layout inline-size;
  container-type: inline-size;
}
```

## 小结

容器查询让组件真正实现了"自适应"，不再依赖视口宽度。它是响应式设计的最后一块拼图——页面布局用媒体查询，组件内部用容器查询。配合 Grid 和 Flex，可以构建出真正灵活的组件系统。2026 年的前端开发，容器查询应该是基础技能。
