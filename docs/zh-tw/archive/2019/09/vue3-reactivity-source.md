---
title: "Vue 3 Alpha 原始碼閱讀：響應式系統原理"
date: 2019-09-24 15:06:04
tags:
  - Vue
readingTime: 2
description: "Vue 3 alpha 程式碼公開了！第一時間去看了響應式系統（packages/reactivity），相比 Vue 2 改變很大。"
---

Vue 3 alpha 程式碼公開了！第一時間去看了響應式系統（packages/reactivity），相比 Vue 2 改變很大。

## Vue 2 響應式的侷限

```javascript
// Vue 2 用 Object.defineProperty
// 問題 1：無法檢測新增屬性
const vm = new Vue({ data: { user: { name: "Alice" } } });
vm.user.age = 25; // 不觸發更新！需要 Vue.set(vm.user, 'age', 25)

// 問題 2：無法檢測陣列索引賦值
vm.items[0] = newItem; // 不觸發更新！需要 Vue.set 或 splice

// 問題 3：初始化時需要遍歷所有屬性（效能）
```

## Vue 3 基於 Proxy 的響應式

```javascript
// packages/reactivity/src/reactive.ts（簡化版）

function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 依賴追蹤
      track(target, TrackOpTypes.GET, key);

      const res = Reflect.get(target, key, receiver);

      // 懶遞迴：只有訪問到巢狀物件時才代理
      if (isObject(res)) {
        return reactive(res);
      }

      return res;
    },

    set(target, key, value, receiver) {
      const hadKey = hasOwn(target, key);
      const result = Reflect.set(target, key, value, receiver);

      if (!hadKey) {
        // 新增屬性：觸發 ADD 型別
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        // 修改屬性：觸發 SET 型別
        trigger(target, TriggerOpTypes.SET, key, value, oldValue);
      }

      return result;
    },

    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      if (result && hasOwn(target, key)) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined);
      }
      return result;
    },
  });
}
```

## effect、track、trigger

```javascript
// 當前活躍的 effect
let activeEffect = null;

// effect：定義響應式副作用
function effect(fn) {
  const effectFn = () => {
    activeEffect = effectFn;
    fn(); // 執行時自動追蹤依賴
    activeEffect = null;
  };
  effectFn(); // 立即執行一次
  return effectFn;
}

// track：在 get 中呼叫，收集依賴
// targetMap: WeakMap<target, Map<key, Set<effect>>>
const targetMap = new WeakMap();

function track(target, type, key) {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));

  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));

  dep.add(activeEffect);
}

// trigger：在 set 中呼叫，觸發更新
function trigger(target, type, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const effects = depsMap.get(key) || new Set();
  effects.forEach((effect) => effect());
}
```

## ref 的實現

```javascript
// ref 用於基本型別（不能用 Proxy，因為 Proxy 只能代理物件）
function ref(value) {
  return {
    get value() {
      track(this, TrackOpTypes.GET, "value");
      return value;
    },
    set value(newValue) {
      if (hasChanged(newValue, value)) {
        value = newValue;
        trigger(this, TriggerOpTypes.SET, "value", newValue);
      }
    },
  };
}
```

## computed 的實現

```javascript
function computed(getter) {
  let dirty = true; // 髒標記：true 表示需要重新計算
  let value;

  const runner = effect(getter, {
    lazy: true, // 不立即執行
    scheduler: () => {
      dirty = true; // 依賴變化時標記為髒，不立即重計算
    },
  });

  return {
    get value() {
      if (dirty) {
        value = runner(); // 只有訪問時才計算
        dirty = false;
      }
      track(this, TrackOpTypes.GET, "value");
      return value;
    },
  };
}
```

## 和 Vue 2 的效能對比

|          | Vue 2                      | Vue 3                  |
| 
-------- | -------------------------- | ---------------------- |
| 初始化   | 遞迴遍歷所有屬性           | 懶代理（訪問到才代理） |
| 新增屬性 | 不追蹤（需要 $set）        | 自動追蹤               |
| 陣列     | 重寫 7 個方法              | 原生支援               |
| 記憶體     | 每個屬性建立 getter/setter | WeakMap 管理依賴       |

## 小結

- Proxy 比 defineProperty 更強大：攔截新增、刪除、陣列索引操作
- 懶遞迴代理（訪問時才 reactive）比 Vue 2 初始化時全量遞迴更高效
- `track` 收集依賴，`trigger` 觸發更新，是整個響應式的核心
- `computed` 用髒標記實現懶求值，只有訪問時才重新計算
