---
title: "Lodash 常用方法整理"
date: 2018-09-28 15:30:34
tags:
  - JavaScript
readingTime: 1
description: "Lodash 是前端項目裏最常用的工具庫之一，但很多人只用了一小部分。整理一下工作中最實用的方法。"
---

Lodash 是前端項目裏最常用的工具庫之一，但很多人只用了一小部分。整理一下工作中最實用的方法。

## 對象操作

```javascript
import _ from "lodash";

const user = {
  name: "張三",
  address: {
    city: "上海",
    district: "浦東",
  },
  roles: ["admin", "editor"],
};

// _.get：安全地訪問深層屬性
_.get(user, "address.city"); // '上海'
_.get(user, "address.country"); // undefined（不報錯）
_.get(user, "address.country", "中國"); // '中國'（默認值）

// _.set：安全地設置深層屬性
const updated = _.set({ ...user }, "address.country", "中國");

// _.pick：只取指定屬性
_.pick(user, ["name", "address"]); // { name: '張三', address: {...} }

// _.omit：去掉指定屬性
_.omit(user, ["roles"]); // 去掉 roles 屬性

// _.cloneDeep：深拷貝
const copy = _.cloneDeep(user);

// _.merge：深合併（Object.assign 是淺合併）
const defaults = { theme: "light", lang: "zh", pagination: { pageSize: 20 } };
const userConfig = { lang: "en", pagination: { page: 1 } };
_.merge({}, defaults, userConfig);
// { theme: 'light', lang: 'en', pagination: { pageSize: 20, page: 1 } }
```

## 數組操作

```javascript
const arr = [1, 2, 3, 2, 1];

_.uniq(arr); // [1, 2, 3]（去重）
_.uniqBy(users, "id"); // 按 id 去重
_.chunk([1, 2, 3, 4, 5], 2); // [[1,2],[3,4],[5]]（分組）
_.flatten([
  [1, 2],
  [3, [4]],
]); // [1,2,3,[4]]（展開一層）
_.flattenDeep([[1, [2, [3]]]]); // [1,2,3]（完全展開）
_.sortBy(users, ["age", "name"]); // 多字段排序
_.groupBy(users, "city"); // 按城市分組
_.keyBy(users, "id"); // 數組轉以 id 為 key 的對象

// 實用場景：把用户數組轉成 id → user 的 Map
const userMap = _.keyBy(users, "id");
userMap["123"]; // 直接按 id 查找
```

## 函數工具

```javascript
// _.debounce：防抖（停止操作後 n 毫秒執行）
const handleSearch = _.debounce((keyword) => {
  fetchResults(keyword);
}, 300);

// _.throttle：節流（n 毫秒內最多執行一次）
const handleScroll = _.throttle(() => {
  checkScrollPosition();
}, 100);

// _.memoize：緩存函數結果
const expensiveCalc = _.memoize((n) => {
  // 複雜計算
  return n * n;
});

// _.once：只執行一次
const init = _.once(() => {
  console.log("只初始化一次");
});
init();
init(); // 不再執行
```

## 字符串操作

```javascript
_.camelCase("hello-world"); // 'helloWorld'
_.kebabCase("helloWorld"); // 'hello-world'
_.snakeCase("helloWorld"); // 'hello_world'
_.startCase("helloWorld"); // 'Hello World'
_.truncate("很長很長的文字", { length: 10 }); // '很長很長很...'
_.template("你好，<%= name %>！")({ name: "張三" }); // '你好，張三！'
```

## 按需引入（減少體積）

```javascript
// 全量引入：很大
import _ from "lodash";

// 按需引入：只打包用到的
import get from "lodash/get";
import debounce from "lodash/debounce";
import cloneDeep from "lodash/cloneDeep";

// 或者用 lodash-es（ES module 版本，支持 tree-shaking）
import { get, debounce } from "lodash-es";
```

## 小結

- `_.get/set`：安全訪問/修改深層屬性，不用擔心 undefined
- `_.cloneDeep`：深拷貝
- `_.merge`：深合併，比 `Object.assign` 更徹底
- `_.groupBy/keyBy`：數組轉對象，非常實用
- `_.debounce/throttle`：比手寫更可靠
- 生產環境按需引入，減少打包體積