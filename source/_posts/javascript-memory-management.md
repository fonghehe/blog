---
title: "JavaScript 内存管理和垃圾回收"
date: 2018-11-10 14:30:38
tags:
  - JavaScript
---

前端页面用久了会越来越卡，通常是内存泄漏。了解 JavaScript 的内存管理机制，能帮助写出不泄漏的代码。

## 内存生命周期

```
1. 分配：声明变量、创建对象时，JS 引擎分配内存
2. 使用：读写分配的内存
3. 释放：不再使用的内存应被回收
```

JavaScript 用垃圾回收器（GC）自动释放内存，我们不需要手动 `free()`。

## 垃圾回收：标记清除

现代 JS 引擎主要用**标记清除**算法：

```
从"根"（全局对象、当前调用栈）出发，遍历所有可以访问到的对象，打上标记。
没有被标记的对象（不可达的）就是垃圾，释放其内存。
```

```javascript
function foo() {
  const obj = { name: "张三" }; // 分配内存
  console.log(obj.name);
  // foo 执行完后，obj 不再可达，等待 GC 回收
}

// 内存泄漏：obj 意外保持可达状态
const cache = {};
function foo() {
  const obj = { name: "张三", bigData: new Array(100000) };
  cache[obj.name] = obj; // obj 被 cache 引用，GC 无法回收！
}
```

## 常见内存泄漏场景

**1. 全局变量**

```javascript
// ❌ 意外创建全局变量
function foo() {
  leak = { data: new Array(100000) }; // 没有 var/let/const，变成全局变量
}

// ✅ 严格模式可以防止这种情况
("use strict");
function foo() {
  leak = {}; // TypeError: leak is not defined
}
```

**2. 未清理的定时器**

```javascript
// ❌ 组件销毁后定时器还在跑，持有组件引用
created() {
  this.timer = setInterval(() => {
    this.data = fetchData()  // 持有 this（组件实例）
  }, 1000)
}

// ✅ 组件销毁时清理
beforeDestroy() {
  clearInterval(this.timer)
}
```

**3. 未解绑的事件监听**

```javascript
// ❌
mounted() {
  window.addEventListener('resize', this.handleResize)
  // 组件销毁后，window 还持有对 handleResize 的引用
}

// ✅
beforeDestroy() {
  window.removeEventListener('resize', this.handleResize)
}
```

**4. 未清理的 Vue 事件总线**

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

**5. 闭包持有大对象**

```javascript
// ❌
function attachEvent(element) {
  const bigData = new Array(100000).fill("data");
  element.addEventListener("click", function () {
    console.log("clicked"); // 闭包持有 bigData，bigData 无法回收
  });
}

// ✅ 不在闭包里持有大对象
function attachEvent(element) {
  element.addEventListener("click", function () {
    console.log("clicked"); // 只用什么就持有什么
  });
}
```

## 用 Chrome DevTools 排查内存泄漏

1. **Performance 面板**：录制一段操作，看内存折线图是否持续增长
2. **Memory 面板 → Heap snapshot**：
   - 操作前拍一个快照
   - 执行可疑操作（如打开弹窗然后关闭）
   - 操作后拍第二个快照
   - 比较两个快照，看哪些对象在增加

```
如果关闭弹窗后，弹窗组件还出现在 snapshot 里，说明有引用没释放
```

## 弱引用：WeakMap 和 WeakSet

```javascript
// WeakMap：key 是弱引用，key 被 GC 回收后，条目自动删除
const cache = new WeakMap();

function processUser(user) {
  if (cache.has(user)) return cache.get(user);

  const result = heavyCompute(user);
  cache.set(user, result); // user 对象被回收后，这个条目自动消失
  return result;
}
// 不需要手动清理 cache，不会造成内存泄漏
```

## 小结

- JS 用标记清除算法自动 GC，"不可达"的对象会被回收
- 内存泄漏 = 不再使用的对象意外保持可达
- 常见原因：未清理的定时器、事件监听、闭包、全局变量
- Vue 组件在 `beforeDestroy` 清理定时器、事件监听
- `WeakMap`/`WeakSet` 实现不阻止 GC 的缓存
