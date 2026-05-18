---
title: "防抖与节流：原理、实现与场景"
date: 2018-04-17 16:15:36
tags:
  - 前端
readingTime: 3
description: "防抖和节流是前端优化的基础工具，几乎所有项目都会用到，面试也必问。这篇文章讲清楚两者的区别和适用场景。"
---

防抖和节流是前端优化的基础工具，几乎所有项目都会用到，面试也必问。这篇文章讲清楚两者的区别和适用场景。

## 问题背景

有些事件触发频率极高：

- `scroll`：每次滚动可能触发几十次
- `resize`：窗口大小变化时连续触发
- `input`：用户每打一个字触发一次
- `mousemove`：鼠标移动时每帧触发

如果每次触发都执行回调（尤其是网络请求、DOM 操作），会导致性能问题。

## 节流（Throttle）

**定义**：在指定时间内，无论触发多少次，只执行一次。

**比喻**：水龙头限流，每分钟最多出水一次，无论你开多大。

```javascript
function throttle(fn, delay) {
  let lastTime = 0;

  return function (...args) {
    const now = Date.now();

    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// 使用：滚动事件最多每 200ms 触发一次
window.addEventListener(
  "scroll",
  throttle(() => {
    console.log("scroll position:", window.scrollY);
  }, 200),
);
```

**时间戳版本**每次都在间隔开始时执行（不会等到最后一次触发）。

**定时器版本**（在间隔结束时执行）：

```javascript
function throttle(fn, delay) {
  let timer = null;

  return function (...args) {
    if (timer) return; // 还在等待中，忽略

    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}
```

**适用场景：**

- 滚动加载（每 300ms 检查一次是否到底部）
- 按钮防重复点击（3秒内只触发一次）
- 鼠标跟随动画
- API 轮询频率控制

## 防抖（Debounce）

**定义**：事件停止触发后等待指定时间，才执行回调。如果在等待期间再次触发，重新计时。

**比喻**：电梯关门。有人进来就重新等，一段时间没人进才关门。

```javascript
function debounce(fn, delay) {
  let timer = null;

  return function (...args) {
    // 清除上一次的定时器
    if (timer) clearTimeout(timer);

    // 重新计时
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// 使用：输入停止 500ms 后才搜索
const searchInput = document.getElementById("search");
searchInput.addEventListener(
  "input",
  debounce((e) => {
    fetchSearchResults(e.target.value);
  }, 500),
);
```

**立即执行版本**（第一次触发立即执行，停止后冷却）：

```javascript
function debounce(fn, delay, immediate = false) {
  let timer = null;

  return function (...args) {
    const callNow = immediate && !timer;

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);

    if (callNow) fn.apply(this, args);
  };
}
```

**适用场景：**

- 搜索框实时搜索（停止输入后才请求）
- 表单验证（停止输入后才校验）
- 窗口 resize 结束后重新计算布局
- 编辑器内容变化自动保存

## 两者对比

|          | 节流         | 防抖           |
| 
-------- | ------------ | -------------- |
| 执行时机 | 固定间隔执行 | 停止触发后执行 |
| 适用场景 | 需要持续响应 | 等待操作完成   |
| 举例     | 滚动位置更新 | 搜索框联想     |

**核心区别**：节流关心"执行频率"，防抖关心"操作是否完成"。

## 在 Vue 中使用

```vue
<script>
import { debounce, throttle } from "lodash";

export default {
  data() {
    return { searchQuery: "" };
  },
  created() {
    // 在 created 里创建，保证每个组件实例有独立的 debounce 函数
    this.debouncedSearch = debounce(this.fetchResults, 500);
  },
  beforeDestroy() {
    // 组件销毁时取消等待中的调用
    this.debouncedSearch.cancel();
  },
  methods: {
    onInput(value) {
      this.searchQuery = value;
      this.debouncedSearch(value);
    },
    async fetchResults(query) {
      const results = await searchAPI(query);
      this.results = results;
    },
  },
};
</script>
```

**注意**：不要在 methods 里直接用 `debounce()` 包装，这会导致所有组件实例共享同一个 debounce 函数：

```javascript
// ❌ 错误：methods 里的函数是共享的
methods: {
  onInput: debounce(function(value) { ... }, 500)
}

// ✅ 正确：在 created 里创建，每个实例独立
created() {
  this.debouncedFn = debounce(this.fn, 500)
}
```

## 小结

- 高频事件必须节流或防抖，否则有性能问题
- 节流 = 固定频率执行（适合持续响应的场景）
- 防抖 = 等停止后执行（适合等待操作完成的场景）
- Vue 中在 `created` 里创建，在 `beforeDestroy` 里 cancel
