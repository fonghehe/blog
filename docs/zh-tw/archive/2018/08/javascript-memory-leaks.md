---
title: "JavaScript 記憶體洩漏排查"
date: 2018-08-04 11:19:49
tags:
  - JavaScript
readingTime: 1
description: "排查了一個長期執行後記憶體越來越大的後臺系統，記錄一下記憶體洩漏的常見原因和排查方法。"
wordCount: 197
---

排查了一個長期執行後記憶體越來越大的後臺系統，記錄一下記憶體洩漏的常見原因和排查方法。

## 常見記憶體洩漏場景

### 1. 未清除的事件監聽器

```javascript
// ❌ 元件銷燬後監聽器還在
export default {
  mounted() {
    window.addEventListener('resize', this.handleResize)
    document.addEventListener('click', this.handleClick)
  }
  // 忘記在 beforeDestroy 中清除！
}

// ✅ 正確做法
export default {
  mounted() {
    window.addEventListener('resize', this.handleResize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
  }
}
```

### 2. 未清除的定時器

```javascript
// ❌ 元件銷燬後定時器仍在執行
export default {
  mounted() {
    this.timer = setInterval(this.poll, 5000);
  },
  beforeDestroy() {
    clearInterval(this.timer); // 必須清除！
  },
};
```

### 3. 閉包持有大物件引用

```javascript
// ❌ 大物件被閉包捕獲，無法被 GC
function createClosure() {
  const hugeData = new Array(10000).fill("data"); // 大陣列

  return function handler() {
    // handler 被儲存，hugeData 無法釋放
    console.log("done"); // 其實不需要 hugeData！
  };
}

// ✅ 只保留需要的資料
function createClosure() {
  const hugeData = new Array(10000).fill("data");
  const needed = hugeData.length; // 只保留需要的
  hugeData = null; // 讓 GC 回收

  return function handler() {
    console.log(needed);
  };
}
```

### 4. 全域性快取沒有上限

```javascript
// ❌ 無限增長的快取
const cache = {};
function getUser(id) {
  if (!cache[id]) {
    cache[id] = fetchUser(id);
  }
  return cache[id];
}

// ✅ 用 WeakMap 或設定上限
const cache = new Map();
const MAX_SIZE = 100;
function getUser(id) {
  if (cache.has(id)) return cache.get(id);
  if (cache.size >= MAX_SIZE) {
    cache.delete(cache.keys().next().value); // 刪最舊的
  }
  const user = fetchUser(id);
  cache.set(id, user);
  return user;
}
```

## Chrome DevTools 排查

1. **Memory 面板 → Heap Snapshot**：對比兩次快照，找增長的物件
2. **Memory 面板 → Allocation instrumentation on timeline**：記錄記憶體分配時間線
3. **Performance Monitor**：即時監控 JS Heap 大小

```javascript
// 主動觸發 GC（除錯用）
// DevTools → Memory → Collect Garbage 按鈕
// 或命令列：node --expose-gc app.js，然後 global.gc()
```

## WeakMap 和 WeakRef

```javascript
// WeakMap：鍵是弱引用，GC 可以回收鍵物件
const elementData = new WeakMap();

function attachData(el, data) {
  elementData.set(el, data); // el 被 GC 回收時，這條記錄也消失
}

// 適合儲存 DOM 元素相關的私有資料
```

## 小結

- 元件銷燬時清除所有監聽器、定時器
- 閉包注意不要意外持有大物件
- 全域性快取設上限或用 LRU
- Chrome DevTools Memory 面板是排查工具
