---
title: "Angular 23 Hydration 进阶：增量水合与 Zoneless 实战"
date: 2026-08-27 16:48:05
tags:
  - Angular
readingTime: 7
description: "Angular 23 的 hydration 不再只是全量激活。本文从 @defer hydrate 触发器、选择性水合边界、zoneless 配合、TBT/INP 度量到内容页与仪表盘的不同策略，记录一个营销站迁移的真实数据和踩坑经验。"
wordCount: 1961
---

Angular 17 引入 SSR hydration，解决了长期以来的 re-render flicker 问题。但默认的全量水合对内容型页面来说太重了——一个营销落地页有 20 个组件，用户可见区域只有首屏 3 个，剩下 17 个在后台默默消耗主线程做 hydration，拖慢 TBT 和 INP。Angular 23 的 incremental hydration 让这件事有了精细控制的可能。

我们刚把一个日均 PV 50 万的营销站从 Angular 21 全量水合迁移到 23 的增量水合 + zoneless。这篇文章记录过程中的决策、数据和踩过的坑。

## Incremental Hydration 的核心机制

Angular 23 把 `@defer` 和 hydration 打通了。以前 `@defer` 只控制客户端渲染时机（lazy load），服务端渲染时所有 defer 块仍然会完整输出 HTML。现在你可以指定 defer 块的 hydration 触发条件：

```html
<!-- 可见时才水合 -->
@defer (hydrate on visible) {
  <product-recommendations />
}

<!-- 用户交互时才水合 -->
@defer (hydrate on interaction) {
  <comment-section />
}

<!-- 空闲时水合 -->
@defer (hydrate on idle) {
  <related-articles />
}

<!-- 自定义条件 -->
@defer (hydrate when shouldHydrateMap()) {
  <interactive-map [data]="mapData()" />
}
```

关键区别在于：没有写 `hydrate` 的 `@defer` 块在服务端渲染时**不会输出 HTML**（纯客户端懒加载）；写了 `hydrate on ...` 的块在服务端会完整渲染 HTML，但客户端只在满足触发条件后才激活事件绑定和变更检测。这意味着用户可以立即看到内容，但不必为不可见区域的交互能力付出 JS 执行成本。

四种触发器的适用场景：

| 触发器 | 服务端输出 HTML | 客户端激活时机 | 典型组件 |
|--------|---------------|--------------|---------|
| `on visible` | 是 | 进入视口 | 推荐列表、FAQ、页脚 |
| `on interaction` | 是 | click/focus/touch | 评论区、表单、折叠面板 |
| `on idle` | 是 | requestIdleCallback | 非关键分析组件、社交分享 |
| `when condition()` | 是 | signal 为 true | 需要编程控制的场景 |

## 选择性水合边界的划分原则

不是所有组件都适合延迟水合。我们的划分标准：

**必须立即水合**：导航栏、搜索框、购物车入口、登录状态指示器。这些组件在首屏且需要即时响应交互，延迟水合会导致用户点击无反应。

**可以延迟水合**：产品详情下方的推荐模块、用户评价区、SEO 长文本区块、第三方嵌入（地图、视频）。这些要么不在首屏，要么不需要即时交互。

**不应该用水合**：纯展示且永远不需要交互的内容。直接用 `ngNonBindable` 或原生 HTML，连 Angular 组件都不要套。

实际操作中容易犯的错误是把太多组件标为 `on interaction`。如果用户在首屏就点了某个本该 `on visible` 水合的组件，它会先经历一次"看起来可点但点了没反应"的阶段，然后才激活。这对 UX 的伤害比多花几十毫秒全量水合更大。

## 与 Zoneless Change Detection 的配合

Zoneless 模式下没有 Zone.js 的 monkey-patching，变更检测完全由 signals 和显式 `markForCheck` 驱动。这和增量水合天然契合——每个 defer 块水合时只需要建立自己的 signal subscription，不需要全局 Zone 来追踪异步操作。

```typescript
// zoneless app config
bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideClientHydration(withIncrementalHydration()),
  ],
});
```

注意 `withIncrementalHydration()` 这个 provider。不带它的话，即使模板里写了 `hydrate on ...`，Angular 也会退回到全量水合。这是 23.0 的一个易忽略的配置项。

Zoneless + 增量水合的组合效果是双重的：一方面减少了需要水合的组件数量，另一方面每个被水合的组件也不再携带 Zone.js 的运行时开销。在我们的测试中，两者叠加的收益大于各自单独使用之和。

## 度量 Hydration 成本：TBT 和 INP 的前后对比

迁移前后我们用 Lighthouse CI + Web Vitals API 做了持续监控。数据来自同一组 URL（20 个营销页 + 5 个功能页），采样一周取 p75：

| 指标 | 全量水合 (v21+Zone.js) | 增量水合 (v23+Zoneless) | 变化 |
|------|----------------------|------------------------|------|
| TBT (p75) | 380ms | 140ms | -63% |
| INP (p75) | 290ms | 110ms | -62% |
| LCP (p75) | 2.1s | 1.9s | -10% |
| CLS (p75) | 0.02 | 0.01 | -50% |
| JS Bundle (首屏) | 420KB | 285KB | -32% |

TBT 和 INP 改善最大，因为大量非首屏组件的水合工作被推迟或消除了。LCP 改善有限，因为 LCP 主要取决于图片和字体加载，hydration 对它的直接影响不大。CLS 的改善来自 `@defer` 块预留占位符（`placeholder`）的正确使用。

JS Bundle 减小是因为 zoneless 移除了 Zone.js（~40KB gzip），加上部分 defer 块的代码被拆分到 lazy chunk。

度量时的一个注意事项：不要只看 Lighthouse lab data。Lab 环境跑在模拟设备上，hydration 的时间占比会被放大。Field data（真实用户数据）才是最终评判标准。我们在 field data 上看到 INP good rate 从 78% 提升到 94%。

## 内容页 vs 仪表盘：不同的策略

营销内容页和功能仪表盘的 hydration 策略应该完全不同。

**内容页（营销站）**：以阅读为主，交互集中在少数组件（CTA 按钮、表单、搜索）。策略是激进地延迟水合——首屏以上的 CTA 立即水合，其余全部 `on visible` 或 `on interaction`。目标是让读者在 JS 还没加载完时就能流畅滚动阅读。

```html
<!-- 营销页的典型结构 -->
<header>
  <navbar /> <!-- 立即水合 -->
</header>

<main>
  <hero-section /> <!-- 立即水合，包含 CTA -->

  @defer (hydrate on visible) {
    <feature-highlights />
  }

  @defer (hydrate on visible) {
    <testimonial-carousel />
  }

  @defer (hydrate on interaction) {
    <pricing-calculator />
  }

  @defer (hydrate on idle) {
    <seo-long-form-content />
  }
</main>

<footer>
  @defer (hydrate on visible) {
    <site-footer />
  }
</footer>
```

**仪表盘**：几乎所有组件都需要即时交互。策略是最小化延迟水合——只对明确不在首屏且加载代价大的组件使用 `on visible`，其余保持立即水合。目标是在首屏内提供完整的交互能力。

```html
<!-- 仪表盘的典型结构 -->
<dashboard-layout>
  <sidebar-nav /> <!-- 立即水合 -->
  <top-bar /> <!-- 立即水合 -->

  <main-content>
    <kpi-cards /> <!-- 立即水合 -->
    <chart-panel /> <!-- 立即水合 -->

    @defer (hydrate on visible) {
      <detailed-data-table /> <!-- 表格很长，折叠区域延迟 -->
    }

    @defer (hydrate on interaction) {
      <export-dialog /> <!-- 对话框，点击才需要 -->
    }
  </main-content>
</dashboard-layout>
```

## 踩坑记录

**Event Replay Flicker**。Angular 在水合完成前会录制用户事件，水合完成后重放。如果用户在 hydration 期间快速点击了一个 `on interaction` 的按钮，事件重放时可能出现视觉闪烁——按钮先显示未激活状态，重放后跳到激活状态。解决方案是给这类组件加 CSS transition 做平滑过渡，或者在极端情况下改用 `on visible` 提前水合。

**SEO 与 Deferred Content**。搜索引擎能抓取服务端渲染的 HTML，但对 `@defer` 块的行为取决于触发器。`on visible` 和 `on idle` 的内容在 HTML 中存在，爬虫能看到。`on interaction` 的内容同样存在于初始 HTML 中（这是增量水合的前提）。但如果误用了不带 `hydrate` 的纯 `@defer`，该区块在服务端不会渲染，SEO 内容就丢了。每次 code review 都要确认 defer 块带没带 `hydrate`。

**Signal 初始化时序**。Zoneless 模式下，defer 块内的 signal 在组件实例化时才创建。如果父组件通过 input signal 传递数据给延迟水合的子组件，要确保子组件水合时 signal 已经有值。否则会出现短暂的空状态闪烁。用 `@if (data())` 包裹或在 signal 上设默认值可以避免。

**Testing 复杂度增加**。单元测试中 `@defer (hydrate on visible)` 的组件默认不会渲染。需要在 TestBed 中配置 `deferBlockBehavior: DeferBlockBehavior.Playthrough` 来强制渲染所有 defer 块，或者逐个手动触发。这增加了测试配置的负担。

**第三方库兼容性**。部分 UI 库的内部组件假设了立即水合的环境。比如某些 carousel 库在水合前计算 slide 宽度，结果拿到 0。遇到这种情况要么提 PR 修复，要么把该组件改为立即水合。

## 小结

Angular 23 的增量水合把 hydration 从一个全局开关变成了可以逐组件调节的旋钮。和 zoneless 搭配使用时，性能收益显著——我们的营销站 TBT 降了 63%，INP good rate 从 78% 到 94%。但精细控制也带来了新的决策负担：每个组件都要判断该用什么触发器，错了就可能损害 UX 或 SEO。建议从内容型页面开始尝试，积累经验后再推广到交互式应用。度量时以 field data 为准，lab data 仅作参考。
