---
title: "Long Animation Frame API 实战：从归因盲区到 INP 精准优化"
date: 2026-08-14 15:23:41
tags:
  - 性能优化
readingTime: 7
description: "PerformanceObserver long-animation-frame（LoAF）API 解决了 Long Task API 无法归因的核心缺陷。本文详解 LoAF 的字段含义、生产环境采集方案，并通过第三方脚本阻塞、长渲染通道、样式布局抖动三个真实案例展示如何用 LoAF 驱动 INP 优化。"
wordCount: 1343
---

INP（Interaction to Next Paint）在 2024 年正式取代 FID 成为 Core Web Vitals 指标后，前端团队面临一个尴尬的现实：我们知道页面响应慢，但不知道是谁让它慢的。Long Task API 能告诉你"有一个 300ms 的长任务"，却无法告诉你这 300ms 里到底在执行什么代码。这个归因盲区在 2026 年被 Long Animation Frame API（LoAF）填上了。

## Long Task API 为什么不够用

Long Task API 自 Chrome 58 起可用，是性能监控的基础设施之一。它的核心问题只有一个：**没有归因能力**。

```javascript
// Long Task API 能给你的全部信息
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.duration);      // 320ms
    console.log(entry.startTime);     // 1234.56
    console.log(entry.attribution);   // undefined — 没有任何归因信息
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

你知道了"有东西卡了 320ms"，然后呢？是哪个脚本？是渲染还是脚本执行？是样式计算还是布局？这些信息全部缺失。在真实项目中，一个页面的主线程可能同时运行自有代码、第三方 SDK、广告脚本、分析工具，Long Task API 无法区分它们。

这导致了一个普遍的困境：INP 分数差，DevTools 里能看到长条，但无法在生产环境中系统性地定位和追踪责任方。

## LoAF 的关键字段

LoAF 通过 `PerformanceObserver` 的 `long-animation-frame` 类型暴露，每个条目代表一帧中超过 50ms 的动画帧周期。它比 Long Task 多提供了四个关键维度：

```typescript
interface PerformanceLongAnimationFrameEntry extends PerformanceEntry {
  // 帧内所有脚本执行的归因列表
  scripts: PerformanceScriptTiming[];

  // 渲染开始时间（相对于 navigationStart）
  renderStart: number;

  // 样式和布局计算开始时间
  styleAndLayoutStart: number;

  // 帧内第一个用户输入事件的时间戳（用于关联交互）
  firstUIEventTimestamp: number;

  // 阻塞持续时间（排除并行工作后的纯阻塞时间）
  blockingDuration: number;
}

interface PerformanceScriptTiming {
  name: string;              // 脚本 URL 或 'unknown'
  entryType: 'script';
  startTime: number;
  duration: number;
  invoker: string;           // 调用者标识（如 'onclick', 'setTimeout'）
  invokerType: string;       // 'event-listener' | 'resolve-promise' | 'classic-script' | 'module-script' 等
  windowAttribution: string; // 'self' | 'descendant' | 'ancestor' | 'same-page' | 'other'
  sourceURL: string;         // 脚本源 URL
  sourceFunctionName: string;// 函数名（如果可获取）
  sourceCharPosition: number;// 源码中的字符位置
}
```

这些字段的组合让归因成为可能。举一个具体例子：

```javascript
const loafObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration < 100) continue; // 只关注 >100ms 的帧

    const report = {
      duration: entry.duration,
      blockingDuration: entry.blockingDuration,
      scriptCount: entry.scripts.length,
      scripts: entry.scripts.map((s) => ({
        url: s.name,
        duration: s.duration,
        invoker: s.invoker,
        invokerType: s.invokerType,
        functionName: s.sourceFunctionName,
        charPosition: s.sourceCharPosition,
      })),
      renderPhase: entry.renderStart > 0
        ? { start: entry.renderStart, layoutStart: entry.styleAndLayoutStart }
        : null,
    };

    sendToAnalytics(report);
  }
});

loafObserver.observe({ type: 'long-animation-frame', buffered: true });
```

当 `renderStart` 有值而 `scripts` 为空时，说明这一帧的时间主要花在渲染阶段（样式/布局/绘制），而非脚本执行。这是 Long Task API 完全无法区分的场景。

## 生产环境采集方案

LoAF 数据量比 Long Task 大得多（每帧可能包含多个 script 条目），直接全量上报会导致数据爆炸。生产环境需要采样和缓冲策略。

### 采样 + 缓冲 + sendBeacon

```typescript
class LoAFCollector {
  private buffer: object[] = [];
  private sampleRate: number;
  private maxBufferSize: number;
  private flushInterval: number;
  private timerId: number | null = null;

  constructor(options: { sampleRate?: number; maxBufferSize?: number; flushIntervalMs?: number } = {}) {
    this.sampleRate = options.sampleRate ?? 0.1; // 默认 10% 采样
    this.maxBufferSize = options.maxBufferSize ?? 20;
    this.flushInterval = options.flushIntervalMs ?? 10000;
  }

  start() {
    if (!('PerformanceObserver' in window)) return;

    // 检测浏览器是否支持 long-animation-frame
    const supported = PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame');
    if (!supported) {
      console.warn('LoAF not supported, falling back to longtask');
      return;
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 采样过滤
        if (Math.random() > this.sampleRate) continue;

        // 只收集有意义的长帧（>100ms）
        if (entry.duration < 100) continue;

        this.buffer.push(this.serialize(entry));

        if (this.buffer.length >= this.maxBufferSize) {
          this.flush();
        }
      }
    });

    // buffered: true 确保不丢失注册前已产生的条目
    observer.observe({ type: 'long-animation-frame', buffered: true });

    // 定时刷新缓冲区
    this.timerId = window.setInterval(() => this.flush(), this.flushInterval);

    // 页面卸载前强制刷新
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  private serialize(entry: any): object {
    return {
      t: Date.now(),
      d: Math.round(entry.duration),
      b: Math.round(entry.blockingDuration),
      rs: entry.renderStart ? Math.round(entry.renderStart) : null,
      sl: entry.styleAndLayoutStart ? Math.round(entry.styleAndLayoutStart) : null,
      s: entry.scripts?.map((s: any) => ({
        u: s.name,
        d: Math.round(s.duration),
        i: s.invoker,
        it: s.invokerType,
        fn: s.sourceFunctionName || undefined,
        cp: s.sourceCharPosition >= 0 ? s.sourceCharPosition : undefined,
      })) || [],
      p: location.pathname,
    };
  }

  private flush() {
    if (this.buffer.length === 0) return;

    const payload = JSON.stringify(this.buffer.splice(0));

    // sendBeacon 保证页面卸载时也能发送
    const sent = navigator.sendBeacon('/api/metrics/loaf', payload);
    if (!sent) {
      // fallback：fetch keepalive
      fetch('/api/metrics/loaf', {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  }

  stop() {
    if (this.timerId !== null) clearInterval(this.timerId);
    this.flush();
  }
}

// 初始化
const collector = new LoAFCollector({ sampleRate: 0.05, flushIntervalMs: 15000 });
collector.start();
```

关于 `buffered: true`：这个选项至关重要。PerformanceObserver 通常在 DOM ready 之后才注册，但 LoAF 事件可能在页面加载过程中就已经产生。`buffered: true` 让 Observer 回溯并补发注册前的条目，避免遗漏首屏阶段的长帧。

## 真实案例诊断

### 案例一：第三方脚本阻塞主线程

我们的内部仪表盘页面 INP p75 达到 480ms。LoAF 数据显示：

```json
{
  "d": 340,
  "b": 310,
  "rs": null,
  "s": [
    { "u": "https://analytics.vendor.com/sdk.js", "d": 280, "i": "setTimeout", "it": "classic-script" },
    { "u": "https://cdn.example.com/app/dashboard.js", "d": 30, "i": "onclick", "it": "event-listener" }
  ]
}
```

归因非常清晰：340ms 的长帧中，280ms 来自第三方分析 SDK 的 setTimeout 回调，只有 30ms 是我们自己的点击处理逻辑。

修复方式是将第三方脚本延迟到用户首次交互之后加载：

```typescript
// 延迟加载非关键第三方脚本
let analyticsLoaded = false;

function loadAnalyticsOnInteraction() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  const script = document.createElement('script');
  script.src = 'https://analytics.vendor.com/sdk.js';
  script.async = true;
  document.head.appendChild(script);
}

// 在首次用户交互时触发
['click', 'keydown', 'pointerdown'].forEach((evt) => {
  document.addEventListener(evt, loadAnalyticsOnInteraction, { once: true, capture: true });
});
```

效果：INP p75 从 480ms 降到 120ms。

### 案例二：长渲染通道

另一个页面的 LoAF 呈现出完全不同的模式：

```json
{
  "d": 220,
  "b": 40,
  "rs": 1580,
  "sl": 1620,
  "s": []
}
```

`scripts` 为空，`renderStart` 和 `styleAndLayoutStart` 有值，`blockingDuration` 仅 40ms。这说明 220ms 中有 180ms 花在渲染阶段——样式计算、布局和绘制。

排查发现是该页面使用了一个复杂的 CSS Grid 布局，包含 200+ 个网格项和大量嵌套的 `calc()` 表达式。每次数据更新触发的 re-render 导致了完整的样式重算。

修复方向：
- 将 `calc()` 替换为预计算的 CSS 变量
- 对网格容器添加 `contain: layout style`，限制样式影响范围
- 虚拟滚动减少 DOM 节点数

### 案例三：样式/布局抖动（Thrashing）

第三个案例的特征是同一帧中出现多个交替的脚本和渲染阶段：

```json
{
  "d": 380,
  "b": 350,
  "s": [
    { "u": "/app/list.js", "d": 40, "i": "forEach", "fn": "updateItemHeight" },
    { "u": "/app/list.js", "d": 60, "i": "getComputedStyle", "fn": "measureItems" },
    { "u": "/app/list.js", "d": 35, "i": "forEach", "fn": "updateItemHeight" },
    { "u": "/app/list.js", "d": 55, "i": "offsetHeight", "fn": "measureItems" }
  ]
}
```

经典的读写交替模式：`updateItemHeight` 写入样式 → `measureItems` 读取几何属性触发强制同步布局 → 循环往复。LoAF 的 `sourceFunctionName` 字段直接指出了两个函数的名字。

修复方式是批量读写分离：

```typescript
// 修复前：读写交替
items.forEach((item) => {
  item.style.height = calculateHeight(item); // 写
  const rect = item.getBoundingClientRect(); // 读 → 强制同步布局
  updateCache(item.id, rect);
});

// 修复后：先批量读，再批量写
const measurements = items.map((item) => ({
  id: item.id,
  rect: item.getBoundingClientRect(), // 批量读
}));

items.forEach((item, i) => {
  item.style.height = calculateHeight(item); // 批量写
  updateCache(measurements[i].id, measurements[i].rect);
});
```

## 将 LoAF 连接到 INP 改进

LoAF 的价值不仅在于单次诊断，更在于建立持续的性能归因体系。我们在内部搭建了一个简单的聚合看板：

1. **按脚本 URL 聚合**：统计每个脚本在所有 LoAF 中的累计耗时占比，识别最大的性能贡献者
2. **按 invoker 类型聚合**：区分 event-listener、timer、promise 等不同触发来源，判断是用户交互导致的阻塞还是后台任务的干扰
3. **按页面路径聚合**：不同页面的 LoAF 特征不同，分页面看才能精准定位
4. **趋势对比**：将 LoAF 指标与 INP p75 叠加在同一时间轴上，验证优化措施的实际效果

这套体系让我们从"INP 高了 → 打开 DevTools 手动排查 → 猜一下改一改"的模式，转变为"LoAF 自动归因 → 定位到具体脚本和函数 → 针对性修复 → 验证效果"的闭环。

## 展望

LoAF 目前在 Chromium 系浏览器中稳定可用，Firefox 和 Safari 的支持还在推进中。对于需要跨浏览器覆盖的场景，建议同时保留 Long Task API 作为降级方案，并在数据采集层做好 feature detection。

LoAF 不会让 INP 自动变好，但它让"为什么 INP 不好"这个问题有了可回答的答案。在一个前端应用越来越复杂、第三方依赖越来越多的时代，归因能力本身就是基础设施。把 LoAF 接入你的性能监控体系，比盲目优化更有价值。
