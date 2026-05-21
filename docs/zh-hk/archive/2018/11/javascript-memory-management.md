---
title: "JavaScript 內存管理和垃圾回收"
date: 2018-11-10 14:30:38
tags:
  - JavaScript
readingTime: 2
description: "前端頁面用久了會越來越卡，通常是內存泄漏。瞭解 JavaScript 的內存管理機制，能幫助寫出不泄漏的代碼。"
wordCount: 323
---

前端頁面用久了會越來越卡，通常是內存泄漏。瞭解 JavaScript 的內存管理機制，能幫助寫出不泄漏的代碼。

## 內存生命週期

```
1. 分配：聲明變量、創建對象時，JS 引擎分配內存
2. 使用：讀寫分配的內存
3. 釋放：不再使用的內存應被回收
```

JavaScript 用垃圾回收器（GC）自動釋放內存，我們不需要手動 `free()`。

## 垃圾回收：標記清除

現代 JS 引擎主要用**標記清除**算法：

```
從"根"（全局對象、當前調用棧）出發，遍歷所有可以訪問到的對象，打上標記。
沒有被標記的對象（不可達的）就是垃圾，釋放其內存。
```

```javascript
function foo() {
  const obj = { name: "張三" }; // 分配內存
  console.log(obj.name);
  // foo 執行完後，obj 不再可達，等待 GC 回收
}

// 內存泄漏：obj 意外保持可達狀態
const cache = {};
function foo() {
  const obj = { name: "張三", bigData: new Array(100000) };
  cache[obj.name] = obj; // obj 被 cache 引用，GC 無法回收！
}
```

## 常見內存泄漏場景

**1. 全局變量**

```javascript
// ❌ 意外創建全局變量
function foo() {
  leak = { data: new Array(100000) }; // 沒有 var/let/const，變成全局變量
}

// ✅ 嚴格模式可以防止這種情況
("use strict");
function foo() {
  leak = {}; // TypeError: leak is not defined
}
```

**2. 未清理的定時器**

```javascript
// ❌ 組件銷燬後定時器還在跑，持有組件引用
created() {
  this.timer = setInterval(() => {
    this.data = fetchData()  // 持有 this（組件實例）
  }, 1000)
}

// ✅ 組件銷燬時清理
beforeDestroy() {
  clearInterval(this.timer)
}
```

**3. 未解綁的事件監聽**

```javascript
// ❌
mounted() {
  window.addEventListener('resize', this.handleResize)
  // 組件銷燬後，window 還持有對 handleResize 的引用
}

// ✅
beforeDestroy() {
  window.removeEventListener('resize', this.handleResize)
}
```

**4. 未清理的 Vue 事件總線**

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

**5. 閉包持有大對象**

```javascript
// ❌
function attachEvent(element) {
  const bigData = new Array(100000).fill("data");
  element.addEventListener("click", function () {
    console.log("clicked"); // 閉包持有 bigData，bigData 無法回收
  });
}

// ✅ 不在閉包裏持有大對象
function attachEvent(element) {
  element.addEventListener("click", function () {
    console.log("clicked"); // 只用什麼就持有什麼
  });
}
```

## 用 Chrome DevTools 排查內存泄漏

1. **Performance 面板**：錄製一段操作，看內存摺線圖是否持續增長
2. **Memory 面板 → Heap snapshot**：
   - 操作前拍一個快照
   - 執行可疑操作（如打開彈窗然後關閉）
   - 操作後拍第二個快照
   - 比較兩個快照，看哪些對象在增加

```
如果關閉彈窗後，彈窗組件還出現在 snapshot 裏，説明有引用沒釋放
```

## 弱引用：WeakMap 和 WeakSet

```javascript
// WeakMap：key 是弱引用，key 被 GC 回收後，條目自動刪除
const cache = new WeakMap();

function processUser(user) {
  if (cache.has(user)) return cache.get(user);

  const result = heavyCompute(user);
  cache.set(user, result); // user 對象被回收後，這個條目自動消失
  return result;
}
// 不需要手動清理 cache，不會造成內存泄漏
```

## 小結

- JS 用標記清除算法自動 GC，"不可達"的對象會被回收
- 內存泄漏 = 不再使用的對象意外保持可達
- 常見原因：未清理的定時器、事件監聽、閉包、全局變量
- Vue 組件在 `beforeDestroy` 清理定時器、事件監聽
- `WeakMap`/`WeakSet` 實現不阻止 GC 的緩存
