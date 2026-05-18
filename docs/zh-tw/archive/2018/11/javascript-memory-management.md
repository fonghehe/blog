---
title: "JavaScript 記憶體管理和垃圾回收"
date: 2018-11-10 14:30:38
tags:
  - JavaScript
readingTime: 2
description: "前端頁面用久了會越來越卡，通常是記憶體洩漏。瞭解 JavaScript 的記憶體管理機制，能幫助寫出不洩漏的程式碼。"
---

前端頁面用久了會越來越卡，通常是記憶體洩漏。瞭解 JavaScript 的記憶體管理機制，能幫助寫出不洩漏的程式碼。

## 記憶體生命週期

```
1. 分配：宣告變數、建立物件時，JS 引擎分配記憶體
2. 使用：讀寫分配的記憶體
3. 釋放：不再使用的記憶體應被回收
```

JavaScript 用垃圾回收器（GC）自動釋放記憶體，我們不需要手動 `free()`。

## 垃圾回收：標記清除

現代 JS 引擎主要用**標記清除**演算法：

```
從"根"（全域性物件、當前呼叫棧）出發，遍歷所有可以訪問到的物件，打上標記。
沒有被標記的物件（不可達的）就是垃圾，釋放其記憶體。
```

```javascript
function foo() {
  const obj = { name: "張三" }; // 分配記憶體
  console.log(obj.name);
  // foo 執行完後，obj 不再可達，等待 GC 回收
}

// 記憶體洩漏：obj 意外保持可達狀態
const cache = {};
function foo() {
  const obj = { name: "張三", bigData: new Array(100000) };
  cache[obj.name] = obj; // obj 被 cache 引用，GC 無法回收！
}
```

## 常見記憶體洩漏場景

**1. 全域性變數**

```javascript
// ❌ 意外建立全域性變數
function foo() {
  leak = { data: new Array(100000) }; // 沒有 var/let/const，變成全域性變數
}

// ✅ 嚴格模式可以防止這種情況
("use strict");
function foo() {
  leak = {}; // TypeError: leak is not defined
}
```

**2. 未清理的定時器**

```javascript
// ❌ 元件銷燬後定時器還在跑，持有元件引用
created() {
  this.timer = setInterval(() => {
    this.data = fetchData()  // 持有 this（元件例項）
  }, 1000)
}

// ✅ 元件銷燬時清理
beforeDestroy() {
  clearInterval(this.timer)
}
```

**3. 未解綁的事件監聽**

```javascript
// ❌
mounted() {
  window.addEventListener('resize', this.handleResize)
  // 元件銷燬後，window 還持有對 handleResize 的引用
}

// ✅
beforeDestroy() {
  window.removeEventListener('resize', this.handleResize)
}
```

**4. 未清理的 Vue 事件匯流排**

```javascript
// ❌
mounted() {
  this.$bus.$on('update', this.handler)
}

// ✅
beforeDestroy() {
  this.$bus.$off('update', this.handler)
}
```

**5. 閉包持有大物件**

```javascript
// ❌
function attachEvent(element) {
  const bigData = new Array(100000).fill("data");
  element.addEventListener("click", function () {
    console.log("clicked"); // 閉包持有 bigData，bigData 無法回收
  });
}

// ✅ 不在閉包裡持有大物件
function attachEvent(element) {
  element.addEventListener("click", function () {
    console.log("clicked"); // 只用什麼就持有什麼
  });
}
```

## 用 Chrome DevTools 排查記憶體洩漏

1. **Performance 面板**：錄製一段操作，看內存摺線圖是否持續增長
2. **Memory 面板 → Heap snapshot**：
   - 操作前拍一個快照
   - 執行可疑操作（如開啟彈窗然後關閉）
   - 操作後拍第二個快照
   - 比較兩個快照，看哪些物件在增加

```
如果關閉彈窗後，彈窗元件還出現在 snapshot 裡，說明有引用沒釋放
```

## 弱引用：WeakMap 和 WeakSet

```javascript
// WeakMap：key 是弱引用，key 被 GC 回收後，條目自動刪除
const cache = new WeakMap();

function processUser(user) {
  if (cache.has(user)) return cache.get(user);

  const result = heavyCompute(user);
  cache.set(user, result); // user 物件被回收後，這個條目自動消失
  return result;
}
// 不需要手動清理 cache，不會造成記憶體洩漏
```

## 小結

- JS 用標記清除演算法自動 GC，"不可達"的物件會被回收
- 記憶體洩漏 = 不再使用的物件意外保持可達
- 常見原因：未清理的定時器、事件監聽、閉包、全域性變數
- Vue 元件在 `beforeDestroy` 清理定時器、事件監聽
- `WeakMap`/`WeakSet` 實現不阻止 GC 的快取
