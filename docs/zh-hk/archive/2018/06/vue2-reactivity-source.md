---
title: "Vue 2 源碼閲讀：響應式原理"
date: 2018-06-05 10:32:51
tags:
  - Vue
readingTime: 2
description: "Vue 的響應式系統是它最核心的特性，很多面試題都圍繞這個展開。這篇文章通過閲讀 Vue 2.x 源碼，理清它的實現原理。"
wordCount: 316
---

Vue 的響應式系統是它最核心的特性，很多面試題都圍繞這個展開。這篇文章通過閲讀 Vue 2.x 源碼，理清它的實現原理。

## 核心：Object.defineProperty

Vue 2 的響應式基於 `Object.defineProperty`，對數據的每個屬性設置 getter/setter：

```javascript
function defineReactive(obj, key, value) {
  const dep = new Dep(); // 依賴收集器

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (Dep.target) {
        // 有正在計算的 Watcher
        dep.depend(); // 收集依賴
      }
      return value;
    },
    set(newValue) {
      if (newValue === value) return;
      value = newValue;
      dep.notify(); // 通知所有 Watcher 更新
    },
  });
}
```

## Observer：遞歸處理整個對象

```javascript
class Observer {
  constructor(value) {
    this.value = value;

    if (Array.isArray(value)) {
      // 數組特殊處理
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }

  walk(obj) {
    Object.keys(obj).forEach((key) => {
      defineReactive(obj, key, obj[key]);
    });
  }

  observeArray(arr) {
    arr.forEach((item) => observe(item));
  }
}

function observe(value) {
  if (typeof value !== "object") return;
  return new Observer(value);
}
```

## Dep：依賴管理

每個響應式屬性都有一個 `Dep` 實例，管理依賴它的所有 `Watcher`：

```javascript
class Dep {
  constructor() {
    this.subscribers = new Set();
  }

  depend() {
    if (Dep.target) {
      this.subscribers.add(Dep.target);
    }
  }

  notify() {
    this.subscribers.forEach((watcher) => watcher.update());
  }
}

Dep.target = null; // 當前正在計算的 Watcher
```

## Watcher：觀察者

每個計算屬性、watch 選項、渲染函數都對應一個 `Watcher`：

```javascript
class Watcher {
  constructor(vm, expOrFn, callback) {
    this.vm = vm;
    this.cb = callback;
    this.getter = typeof expOrFn === "function" ? expOrFn : () => vm[expOrFn];

    this.value = this.get(); // 初始化時觸發 getter，完成依賴收集
  }

  get() {
    Dep.target = this; // 設置當前 Watcher
    const value = this.getter.call(this.vm); // 觸發數據 getter
    Dep.target = null; // 清除
    return value;
  }

  update() {
    const oldValue = this.value;
    this.value = this.get();
    this.cb.call(this.vm, this.value, oldValue);
  }
}
```

## 完整流程

```
data: { count: 0 }
   ↓ Vue.observe()
count 屬性被 defineProperty，創建 Dep

組件渲染函數執行
   ↓ 訪問 this.count
觸發 count 的 getter
   ↓ Dep.target = 渲染 Watcher
dep.depend() → 渲染 Watcher 加入 dep.subscribers

this.count++
   ↓ 觸發 count 的 setter
dep.notify() → 通知所有 subscribers
   ↓ 渲染 Watcher.update()
組件重新渲染
```

## Vue 2 響應式的侷限性

理解了原理，就能理解為什麼有這些限製：

### 無法檢測屬性的添加/刪除

```javascript
// ❌ 這個添加不是響應式的
this.user.age = 18; // 沒有被 defineProperty，不會觸發更新

// ✅ 用 Vue.set
this.$set(this.user, "age", 18);
```

原因：`defineProperty` 隻能攔截已存在的屬性，無法攔截新增屬性。

### 無法檢測數組下標賦值

```javascript
// ❌ 不會觸發更新
this.list[0] = "new value";
this.list.length = 0;

// ✅ 用數組方法
this.list.splice(0, 1, "new value");
this.list.splice(0);

// ✅ 或者整體替換
this.list = [...this.list];
```

Vue 對數組的 push/pop/splice 等方法做了攔截，這些方法會觸發更新。

## Vue 2 vs Vue 3 的響應式

Vue 3 用 `Proxy` 替代 `Object.defineProperty`，解決了以上限製：

```javascript
// Proxy 可以攔截屬性添加和刪除
const proxy = new Proxy(obj, {
  set(target, key, value) {
    const oldValue = target[key];
    target[key] = value;
    trigger(target, key); // 觸發更新
    return true;
  },
});

proxy.newProp = "value"; // 能被檢測到！
```

## 小結

- Vue 2 響應式基於 `Object.defineProperty` + Dep/Watcher 模式
- Observer 遞歸處理對象屬性，Dep 管理依賴，Watcher 響應變化
- `Object.defineProperty` 的限製導致無法檢測屬性新增/刪除
- Vue 3 用 Proxy 解決了這些限製
