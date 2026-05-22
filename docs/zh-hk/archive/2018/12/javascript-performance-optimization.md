---
title: "前端效能優化：JS 執行效能"
date: 2018-12-15 10:33:56
tags:
  - 性能優化
readingTime: 2
description: "上個月排查了一個頁面卡頓問題，發現是 JS 執行時間過長導致掉幀。借這個機會整理一下 JS 效能優化的常用手段。"
wordCount: 177
---

上個月排查了一個頁面卡頓問題，發現是 JS 執行時間過長導致掉幀。借這個機會整理一下 JS 性能優化的常用手段。

## 瀏覽器的幀率

流暢的動畫是 60fps，也就是每幀約 16.7ms。

```
一幀的時間（16.7ms）需要完成：
- JS 執行
- 樣式計算
- 佈局
- 繪製
- 合成

如果 JS 執行超過 16ms，這一幀就會被推遲，用户感覺到卡頓
```

## 長任務拆分

```javascript
// ❌ 處理 10000 條數據，阻塞主線程
function processLargeList(list) {
  list.forEach((item) => {
    // 耗時操作
    processItem(item);
  });
}

// ✅ 方案一：分批處理
function processInBatches(list, batchSize = 100) {
  let index = 0;

  function processBatch() {
    const end = Math.min(index + batchSize, list.length);
    while (index < end) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      // 每批處理完，讓出主線程，瀏覽器可以響應用户輸入
      requestAnimationFrame(processBatch);
    }
  }

  requestAnimationFrame(processBatch);
}

// ✅ 方案二：用 requestIdleCallback（瀏覽器空閒時處理）
function processWhenIdle(list) {
  let index = 0;

  requestIdleCallback(function process(deadline) {
    // deadline.timeRemaining()：這一幀還剩多少時間
    while (deadline.timeRemaining() > 0 && index < list.length) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      requestIdleCallback(process);
    }
  });
}
```

## 防抖和節流

```javascript
// 防抖：停止觸發後 delay 毫秒才執行（搜索聯想）
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 節流：每 interval 毫秒最多執行一次（scroll 處理）
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

// 實際使用
const debouncedSearch = debounce(handleSearch, 300);
const throttledScroll = throttle(handleScroll, 100);

input.addEventListener("input", debouncedSearch);
window.addEventListener("scroll", throttledScroll);
```

## 避免頻繁的 DOM 操作

```javascript
// ❌ 每次循環都查詢 DOM 和觸發重排
for (let i = 0; i < 100; i++) {
  const height = element.offsetHeight; // 讀取強製同步佈局
  element.style.top = height * i + "px"; // 寫入
}

// ✅ 分離讀寫
const height = element.offsetHeight; // 一次性讀取
for (let i = 0; i < 100; i++) {
  elements[i].style.top = height * i + "px"; // 隻寫入
}

// ✅ 用 DocumentFragment 批量插入
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement("li");
  li.textContent = `Item ${i}`;
  fragment.appendChild(li); // 不觸發重排
}
ul.appendChild(fragment); // 一次性插入，隻觸發一次重排
```

## Web Worker：把耗時運算移到後臺

```javascript
// worker.js
self.addEventListener("message", (e) => {
  const { data } = e;
  const result = heavyCompute(data); // 在 worker 線程裏執行
  self.postMessage(result);
});

// main.js
const worker = new Worker("/worker.js");

worker.postMessage(largeData);
worker.addEventListener("message", (e) => {
  displayResult(e.data); // 結果回來了，更新 UI
});
```

## 內存和 GC 壓力

```javascript
// ❌ 熱路徑裏頻繁創建對象，增加 GC 壓力
function updateItems(items) {
  return items.map((item) => ({
    // 每次都創建新對象
    ...item,
    display: formatDisplay(item),
  }));
}

// ✅ 重用對象（在性能關鍵路徑上）
function updateItems(items, result) {
  for (let i = 0; i < items.length; i++) {
    result[i] = result[i] || {}; // 重用已有對象
    Object.assign(result[i], items[i]);
    result[i].display = formatDisplay(items[i]);
  }
}
```

## 用 Performance API 測量

```javascript
performance.mark("start-heavy");
heavyOperation();
performance.mark("end-heavy");
performance.measure("heavy", "start-heavy", "end-heavy");

const [measure] = performance.getEntriesByName("heavy");
console.log(`耗時: ${measure.duration.toFixed(2)}ms`);
```

## 小結

- 長任務分批處理（`requestAnimationFrame` 或 `requestIdleCallback`）
- scroll/resize 事件用節流，input 搜索用防抖
- 批量讀寫 DOM，避免交替讀寫導致強製同步佈局
- 耗時運算用 Web Worker 移出主線程
- 用 `performance.mark/measure` 精確測量關鍵路徑耗時
