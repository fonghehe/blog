---
title: "ES6 Map 和 Set"
date: 2018-04-07 09:32:14
tags:
  - ES6
readingTime: 1
description: "ES6 引入了 `Map` 和 `Set` 两种新的数据结构，但工作中很多人还是习惯用对象和数组。来看看什么场景下它们更合适。"
---

ES6 引入了 `Map` 和 `Set` 两种新的数据结构，但工作中很多人还是习惯用对象和数组。来看看什么场景下它们更合适。

## Set：值不重复的集合

```javascript
// 最常用场景：数组去重
const arr = [1, 2, 2, 3, 3, 4];
const unique = [...new Set(arr)];
console.log(unique); // [1, 2, 3, 4]

// 也可以用于字符串去重
const chars = [...new Set("abracadabra")].join("");
console.log(chars); // 'abrcd'
```

```javascript
// Set 的基本操作
const set = new Set([1, 2, 3]);

set.add(4); // 添加
set.delete(1); // 删除
set.has(2); // 查询：true
set.size; // 长度：3

// 遍历
for (const item of set) {
  console.log(item);
}
set.forEach((item) => console.log(item));
```

```javascript
// 集合运算
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

// 并集
const union = new Set([...a, ...b]); // {1, 2, 3, 4}

// 交集
const intersection = new Set([...a].filter((x) => b.has(x))); // {2, 3}

// 差集（a 有 b 没有）
const diff = new Set([...a].filter((x) => !b.has(x))); // {1}
```

## Map：键可以是任意类型的键值对

普通对象的键只能是字符串或 Symbol，Map 的键可以是任何值：

```javascript
const map = new Map();

// 以对象为键
const userKey = { id: 1 };
map.set(userKey, { name: "张三", age: 25 });
map.get(userKey); // { name: '张三', age: 25 }

// 以函数为键
map.set(function () {}, "some value");

// 基本操作
map.set("key", "value");
map.get("key"); // 'value'
map.has("key"); // true
map.delete("key");
map.size; // 长度
```

```javascript
// 初始化
const map = new Map([
  ["name", "张三"],
  ["age", 25],
  ["city", "上海"],
]);

// 遍历
for (const [key, value] of map) {
  console.log(key, value);
}

// 转换
const obj = Object.fromEntries(map); // Map → 对象
const arr = [...map]; // Map → 数组
```

## 什么时候用 Map 代替对象

```javascript
// 场景：需要频繁增删键值对的缓存
// 用对象：
const cache = {};
cache[userId] = data;
delete cache[userId];
Object.keys(cache).length; // 低效

// 用 Map：
const cache = new Map();
cache.set(userId, data);
cache.delete(userId);
cache.size; // O(1)
```

```javascript
// 场景：键是非字符串
// 用对象：键会被 toString()，不同对象的键相同
const obj = {};
obj[{ id: 1 }] = "a";
obj[{ id: 2 }] = "b";
console.log(obj); // { '[object Object]': 'b' } 键被覆盖了！

// 用 Map：键是引用，互不干扰
const map = new Map();
const key1 = { id: 1 };
const key2 = { id: 2 };
map.set(key1, "a");
map.set(key2, "b");
map.size; // 2，正确
```

## 小结

- `Set`：不重复值的集合；最常用：数组去重、集合运算
- `Map`：键值对，键可以是任意类型；适合：频繁增删、键非字符串
- 普通场景用对象/数组就够了，不要为了用新 API 而用