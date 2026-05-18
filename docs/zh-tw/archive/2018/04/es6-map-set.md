---
title: "ES6 Map 和 Set"
date: 2018-04-07 09:32:14
tags:
  - ES6
readingTime: 1
description: "ES6 引入了 `Map` 和 `Set` 兩種新的資料結構，但工作中很多人還是習慣用物件和陣列。來看看什麼場景下它們更合適。"
---

ES6 引入了 `Map` 和 `Set` 兩種新的資料結構，但工作中很多人還是習慣用物件和陣列。來看看什麼場景下它們更合適。

## Set：值不重複的集合

```javascript
// 最常用場景：陣列去重
const arr = [1, 2, 2, 3, 3, 4];
const unique = [...new Set(arr)];
console.log(unique); // [1, 2, 3, 4]

// 也可以用於字串去重
const chars = [...new Set("abracadabra")].join("");
console.log(chars); // 'abrcd'
```

```javascript
// Set 的基本操作
const set = new Set([1, 2, 3]);

set.add(4); // 新增
set.delete(1); // 刪除
set.has(2); // 查詢：true
set.size; // 長度：3

// 遍歷
for (const item of set) {
  console.log(item);
}
set.forEach((item) => console.log(item));
```

```javascript
// 集合運算
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

// 並集
const union = new Set([...a, ...b]); // {1, 2, 3, 4}

// 交集
const intersection = new Set([...a].filter((x) => b.has(x))); // {2, 3}

// 差集（a 有 b 沒有）
const diff = new Set([...a].filter((x) => !b.has(x))); // {1}
```

## Map：鍵可以是任意型別的鍵值對

普通物件的鍵只能是字串或 Symbol，Map 的鍵可以是任何值：

```javascript
const map = new Map();

// 以物件為鍵
const userKey = { id: 1 };
map.set(userKey, { name: "張三", age: 25 });
map.get(userKey); // { name: '張三', age: 25 }

// 以函式為鍵
map.set(function () {}, "some value");

// 基本操作
map.set("key", "value");
map.get("key"); // 'value'
map.has("key"); // true
map.delete("key");
map.size; // 長度
```

```javascript
// 初始化
const map = new Map([
  ["name", "張三"],
  ["age", 25],
  ["city", "上海"],
]);

// 遍歷
for (const [key, value] of map) {
  console.log(key, value);
}

// 轉換
const obj = Object.fromEntries(map); // Map → 物件
const arr = [...map]; // Map → 陣列
```

## 什麼時候用 Map 代替物件

```javascript
// 場景：需要頻繁增刪鍵值對的快取
// 用物件：
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
// 場景：鍵是非字串
// 用物件：鍵會被 toString()，不同物件的鍵相同
const obj = {};
obj[{ id: 1 }] = "a";
obj[{ id: 2 }] = "b";
console.log(obj); // { '[object Object]': 'b' } 鍵被覆蓋了！

// 用 Map：鍵是引用，互不干擾
const map = new Map();
const key1 = { id: 1 };
const key2 = { id: 2 };
map.set(key1, "a");
map.set(key2, "b");
map.size; // 2，正確
```

## 小結

- `Set`：不重複值的集合；最常用：陣列去重、集合運算
- `Map`：鍵值對，鍵可以是任意型別；適合：頻繁增刪、鍵非字串
- 普通場景用物件/陣列就夠了，不要為了用新 API 而用