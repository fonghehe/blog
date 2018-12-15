---
title: "前端性能优化：JS 执行性能"
date: 2018-12-15 10:33:56
tags:
  - 性能优化
---

上个月排查了一个页面卡顿问题，发现是 JS 执行时间过长导致掉帧。借这个机会整理一下 JS 性能优化的常用手段。

## 浏览器的帧率

流畅的动画是 60fps，也就是每帧约 16.7ms。

```
一帧的时间（16.7ms）需要完成：
- JS 执行
- 样式计算
- 布局
- 绘制
- 合成

如果 JS 执行超过 16ms，这一帧就会被推迟，用户感觉到卡顿
```

## 长任务拆分

```javascript
// ❌ 处理 10000 条数据，阻塞主线程
function processLargeList(list) {
  list.forEach((item) => {
    // 耗时操作
    processItem(item);
  });
}

// ✅ 方案一：分批处理
function processInBatches(list, batchSize = 100) {
  let index = 0;

  function processBatch() {
    const end = Math.min(index + batchSize, list.length);
    while (index < end) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      // 每批处理完，让出主线程，浏览器可以响应用户输入
      requestAnimationFrame(processBatch);
    }
  }

  requestAnimationFrame(processBatch);
}

// ✅ 方案二：用 requestIdleCallback（浏览器空闲时处理）
function processWhenIdle(list) {
  let index = 0;

  requestIdleCallback(function process(deadline) {
    // deadline.timeRemaining()：这一帧还剩多少时间
    while (deadline.timeRemaining() > 0 && index < list.length) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      requestIdleCallback(process);
    }
  });
}
```

## 防抖和节流

```javascript
// 防抖：停止触发后 delay 毫秒才执行（搜索联想）
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流：每 interval 毫秒最多执行一次（scroll 处理）
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// 实际使用
const debouncedSearch = debounce(handleSearch, 300);
const throttledScroll = throttle(handleScroll, 100);

input.addEventListener("input", debouncedSearch);
window.addEventListener("scroll", throttledScroll);
```

## 避免频繁的 DOM 操作

```javascript
// ❌ 每次循环都查询 DOM 和触发重排
for (let i = 0; i < 100; i++) {
  const height = element.offsetHeight; // 读取强制同步布局
  element.style.top = height * i + "px"; // 写入
}

// ✅ 分离读写
const height = element.offsetHeight; // 一次性读取
for (let i = 0; i < 100; i++) {
  elements[i].style.top = height * i + "px"; // 只写入
}

// ✅ 用 DocumentFragment 批量插入
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement("li");
  li.textContent = `Item ${i}`;
  fragment.appendChild(li); // 不触发重排
}
ul.appendChild(fragment); // 一次性插入，只触发一次重排
```

## Web Worker：把耗时运算移到后台

```javascript
// worker.js
self.addEventListener("message", (e) => {
  const { data } = e;
  const result = heavyCompute(data); // 在 worker 线程里执行
  self.postMessage(result);
});

// main.js
const worker = new Worker("/worker.js");

worker.postMessage(largeData);
worker.addEventListener("message", (e) => {
  displayResult(e.data); // 结果回来了，更新 UI
});
```

## 内存和 GC 压力

```javascript
// ❌ 热路径里频繁创建对象，增加 GC 压力
function updateItems(items) {
  return items.map((item) => ({
    // 每次都创建新对象
    ...item,
    display: formatDisplay(item),
  }));
}

// ✅ 重用对象（在性能关键路径上）
function updateItems(items, result) {
  for (let i = 0; i < items.length; i++) {
    result[i] = result[i] || {}; // 重用已有对象
    Object.assign(result[i], items[i]);
    result[i].display = formatDisplay(items[i]);
  }
}
```

## 用 Performance API 测量

```javascript
performance.mark("start-heavy");
heavyOperation();
performance.mark("end-heavy");
performance.measure("heavy", "start-heavy", "end-heavy");

const [measure] = performance.getEntriesByName("heavy");
console.log(`耗时: ${measure.duration.toFixed(2)}ms`);
```

## 小结

- 长任务分批处理（`requestAnimationFrame` 或 `requestIdleCallback`）
- scroll/resize 事件用节流，input 搜索用防抖
- 批量读写 DOM，避免交替读写导致强制同步布局
- 耗时运算用 Web Worker 移出主线程
- 用 `performance.mark/measure` 精确测量关键路径耗时
