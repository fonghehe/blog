---
title: "JavaScript 内存泄漏排查"
date: 2018-08-04 11:19:49
tags:
  - JavaScript
readingTime: 1
description: "排查了一个长期运行后内存越来越大的后台系统，记录一下内存泄漏的常见原因和排查方法。"
wordCount: 191
---

排查了一个长期运行后内存越来越大的后台系统，记录一下内存泄漏的常见原因和排查方法。

## 常见内存泄漏场景

### 1. 未清除的事件监听器

```javascript
// ❌ 组件销毁后监听器还在
export default {
  mounted() {
    window.addEventListener('resize', this.handleResize)
    document.addEventListener('click', this.handleClick)
  }
  // 忘记在 beforeDestroy 中清除！
}

// ✅ 正确做法
export default {
  mounted() {
    window.addEventListener('resize', this.handleResize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
  }
}
```

### 2. 未清除的定时器

```javascript
// ❌ 组件销毁后定时器仍在执行
export default {
  mounted() {
    this.timer = setInterval(this.poll, 5000);
  },
  beforeDestroy() {
    clearInterval(this.timer); // 必须清除！
  },
};
```

### 3. 闭包持有大对象引用

```javascript
// ❌ 大对象被闭包捕获，无法被 GC
function createClosure() {
  const hugeData = new Array(10000).fill("data"); // 大数组

  return function handler() {
    // handler 被存储，hugeData 无法释放
    console.log("done"); // 其实不需要 hugeData！
  };
}

// ✅ 只保留需要的数据
function createClosure() {
  const hugeData = new Array(10000).fill("data");
  const needed = hugeData.length; // 只保留需要的
  hugeData = null; // 让 GC 回收

  return function handler() {
    console.log(needed);
  };
}
```

### 4. 全局缓存没有上限

```javascript
// ❌ 无限增长的缓存
const cache = {};
function getUser(id) {
  if (!cache[id]) {
    cache[id] = fetchUser(id);
  }
  return cache[id];
}

// ✅ 用 WeakMap 或设置上限
const cache = new Map();
const MAX_SIZE = 100;
function getUser(id) {
  if (cache.has(id)) return cache.get(id);
  if (cache.size >= MAX_SIZE) {
    cache.delete(cache.keys().next().value); // 删最旧的
  }
  const user = fetchUser(id);
  cache.set(id, user);
  return user;
}
```

## Chrome DevTools 排查

1. **Memory 面板 → Heap Snapshot**：对比两次快照，找增长的对象
2. **Memory 面板 → Allocation instrumentation on timeline**：记录内存分配时间线
3. **Performance Monitor**：实时监控 JS Heap 大小

```javascript
// 主动触发 GC（调试用）
// DevTools → Memory → Collect Garbage 按钮
// 或命令行：node --expose-gc app.js，然后 global.gc()
```

## WeakMap 和 WeakRef

```javascript
// WeakMap：键是弱引用，GC 可以回收键对象
const elementData = new WeakMap();

function attachData(el, data) {
  elementData.set(el, data); // el 被 GC 回收时，这条记录也消失
}

// 适合存储 DOM 元素相关的私有数据
```

## 小结

- 组件销毁时清除所有监听器、定时器
- 闭包注意不要意外持有大对象
- 全局缓存设上限或用 LRU
- Chrome DevTools Memory 面板是排查工具
