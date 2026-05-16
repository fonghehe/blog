---
title: "Reading Vue 2 Source Code: The Reactivity System"
date: 2018-06-05 10:32:51
tags:
  - Vue
readingTime: 2
description: "Vue's reactivity system is its most central feature, and many interview questions revolve around it. This article traces through Vue 2.x source code to clarify "
---

Vue's reactivity system is its most central feature, and many interview questions revolve around it. This article traces through Vue 2.x source code to clarify how it works.

## The Core: Object.defineProperty

Vue 2's reactivity is based on `Object.defineProperty`, which sets getters/setters on every property of the data:

```javascript
function defineReactive(obj, key, value) {
  const dep = new Dep(); // dependency collector

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (Dep.target) {
        // there's a Watcher currently computing
        dep.depend(); // collect the dependency
      }
      return value;
    },
    set(newValue) {
      if (newValue === value) return;
      value = newValue;
      dep.notify(); // notify all Watchers to update
    },
  });
}
```

## Observer: Recursively Process the Entire Object

```javascript
class Observer {
  constructor(value) {
    this.value = value;

    if (Array.isArray(value)) {
      // special handling for arrays
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

## Dep: Dependency Management

Each reactive property has a `Dep` instance that manages all the `Watcher`s that depend on it:

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

Dep.target = null; // the currently-computing Watcher
```

## Watcher: The Observer

Each computed property, `watch` option, and render function corresponds to a `Watcher`:

```javascript
class Watcher {
  constructor(vm, expOrFn, callback) {
    this.vm = vm;
    this.cb = callback;
    this.getter = typeof expOrFn === "function" ? expOrFn : () => vm[expOrFn];

    this.value = this.get(); // trigger getter on init to collect dependencies
  }

  get() {
    Dep.target = this; // set current Watcher
    const value = this.getter.call(this.vm); // trigger data getter
    Dep.target = null; // clear
    return value;
  }

  update() {
    const oldValue = this.value;
    this.value = this.get();
    this.cb.call(this.vm, this.value, oldValue);
  }
}
```

## The Full Flow

```
data: { count: 0 }
   ↓ Vue.observe()
count property is defineProperty'd; a Dep is created

Component render function executes
   ↓ accesses this.count
count's getter is triggered
   ↓ Dep.target = render Watcher
dep.depend() → render Watcher added to dep.subscribers

this.count++
   ↓ count's setter is triggered
dep.notify() → notifies all subscribers
   ↓ render Watcher.update()
component re-renders
```

## Limitations of Vue 2 Reactivity

Understanding the principle explains why these limitations exist:

### Cannot Detect Property Addition/Deletion

```javascript
// ❌ This addition is not reactive
this.user.age = 18; // wasn't defineProperty'd; won't trigger update

// ✅ Use Vue.set
this.$set(this.user, "age", 18);
```

Reason: `defineProperty` can only intercept already-existing properties; it can't intercept newly-added ones.

### Cannot Detect Array Index Assignment

```javascript
// ❌ Won't trigger update
this.list[0] = "new value";
this.list.length = 0;

// ✅ Use array methods
this.list.splice(0, 1, "new value");
this.list.splice(0);

// ✅ Or replace the whole array
this.list = [...this.list];
```

Vue intercepts array methods like push/pop/splice so they trigger updates.

## Vue 2 vs Vue 3 Reactivity

Vue 3 replaces `Object.defineProperty` with `Proxy`, resolving the above limitations:

```javascript
// Proxy can intercept property addition and deletion
const proxy = new Proxy(obj, {
  set(target, key, value) {
    const oldValue = target[key];
    target[key] = value;
    trigger(target, key); // trigger update
    return true;
  },
});

proxy.newProp = "value"; // this is detectable now!
```

## Summary

- Vue 2 reactivity is based on `Object.defineProperty` + the Dep/Watcher pattern
- Observer recursively processes object properties; Dep manages dependencies; Watcher responds to changes
- `Object.defineProperty`'s limitations mean it cannot detect property addition/deletion
- Vue 3 uses Proxy to resolve these limitations
