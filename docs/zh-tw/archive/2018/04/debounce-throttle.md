---
title: "防抖與節流：原理、實現與場景"
date: 2018-04-17 16:15:36
tags:
  - 前端
readingTime: 3
description: "防抖和節流是前端最佳化的基礎工具，幾乎所有專案都會用到，面試也必問。這篇文章講清楚兩者的區別和適用場景。"
wordCount: 609
---

防抖和節流是前端最佳化的基礎工具，幾乎所有專案都會用到，面試也必問。這篇文章講清楚兩者的區別和適用場景。

## 問題背景

有些事件觸發頻率極高：

- `scroll`：每次滾動可能觸發幾十次
- `resize`：視窗大小變化時連續觸發
- `input`：使用者每打一個字觸發一次
- `mousemove`：滑鼠移動時每幀觸發

如果每次觸發都執行回撥（尤其是網路請求、DOM 操作），會導致效能問題。

## 節流（Throttle）

**定義**：在指定時間內，無論觸發多少次，隻執行一次。

**比喻**：水龍頭限流，每分鐘最多出水一次，無論你開多大。

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

// 使用：滾動事件最多每 200ms 觸發一次
window.addEventListener(
  "scroll",
  throttle(() => {
    console.log("scroll position:", window.scrollY);
  }, 200),
);
```

**時間戳版本**每次都在間隔開始時執行（不會等到最後一次觸發）。

**定時器版本**（在間隔結束時執行）：

```javascript
function throttle(fn, delay) {
  let timer = null;

  return function (...args) {
    if (timer) return; // 還在等待中，忽略

    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}
```

**適用場景：**

- 滾動載入（每 300ms 檢查一次是否到底部）
- 按鈕防重複點選（3秒內隻觸發一次）
- 滑鼠跟隨動畫
- API 輪詢頻率控製

## 防抖（Debounce）

**定義**：事件停止觸發後等待指定時間，才執行回撥。如果在等待期間再次觸發，重新計時。

**比喻**：電梯關門。有人進來就重新等，一段時間沒人進才關門。

```javascript
function debounce(fn, delay) {
  let timer = null;

  return function (...args) {
    // 清除上一次的定時器
    if (timer) clearTimeout(timer);

    // 重新計時
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// 使用：輸入停止 500ms 後才搜尋
const searchInput = document.getElementById("search");
searchInput.addEventListener(
  "input",
  debounce((e) => {
    fetchSearchResults(e.target.value);
  }, 500),
);
```

**立即執行版本**（第一次觸發立即執行，停止後冷卻）：

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

**適用場景：**

- 搜尋框即時搜尋（停止輸入後才請求）
- 表單驗證（停止輸入後才校驗）
- 視窗 resize 結束後重新計算佈局
- 編輯器內容變化自動儲存

## 兩者對比

|          | 節流         | 防抖           |
| 
-------- | ------------ | -------------- |
| 執行時機 | 固定間隔執行 | 停止觸發後執行 |
| 適用場景 | 需要持續響應 | 等待操作完成   |
| 舉例     | 滾動位置更新 | 搜尋框聯想     |

**核心區別**：節流關心"執行頻率"，防抖關心"操作是否完成"。

## 在 Vue 中使用

```vue
<script>
import { debounce, throttle } from "lodash";

export default {
  data() {
    return { searchQuery: "" };
  },
  created() {
    // 在 created 裡建立，保證每個元件例項有獨立的 debounce 函式
    this.debouncedSearch = debounce(this.fetchResults, 500);
  },
  beforeDestroy() {
    // 元件銷燬時取消等待中的呼叫
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

**注意**：不要在 methods 裡直接用 `debounce()` 包裝，這會導致所有元件例項共享同一個 debounce 函式：

```javascript
// ❌ 錯誤：methods 裡的函式是共享的
methods: {
  onInput: debounce(function(value) { ... }, 500)
}

// ✅ 正確：在 created 裡建立，每個例項獨立
created() {
  this.debouncedFn = debounce(this.fn, 500)
}
```

## 小結

- 高頻事件必須節流或防抖，否則有效能問題
- 節流 = 固定頻率執行（適合持續響應的場景）
- 防抖 = 等停止後執行（適合等待操作完成的場景）
- Vue 中在 `created` 裡建立，在 `beforeDestroy` 裡 cancel
