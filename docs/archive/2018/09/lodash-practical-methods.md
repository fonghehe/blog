---
title: "Lodash 常用方法整理"
date: 2018-09-28 15:30:34
tags:
  - JavaScript
readingTime: 1
description: "Lodash 是前端项目里最常用的工具库之一，但很多人只用了一小部分。整理一下工作中最实用的方法。"
---

Lodash 是前端项目里最常用的工具库之一，但很多人只用了一小部分。整理一下工作中最实用的方法。

## 对象操作

```javascript
import _ from "lodash";

const user = {
  name: "张三",
  address: {
    city: "上海",
    district: "浦东",
  },
  roles: ["admin", "editor"],
};

// _.get：安全地访问深层属性
_.get(user, "address.city"); // '上海'
_.get(user, "address.country"); // undefined（不报错）
_.get(user, "address.country", "中国"); // '中国'（默认值）

// _.set：安全地设置深层属性
const updated = _.set({ ...user }, "address.country", "中国");

// _.pick：只取指定属性
_.pick(user, ["name", "address"]); // { name: '张三', address: {...} }

// _.omit：去掉指定属性
_.omit(user, ["roles"]); // 去掉 roles 属性

// _.cloneDeep：深拷贝
const copy = _.cloneDeep(user);

// _.merge：深合并（Object.assign 是浅合并）
const defaults = { theme: "light", lang: "zh", pagination: { pageSize: 20 } };
const userConfig = { lang: "en", pagination: { page: 1 } };
_.merge({}, defaults, userConfig);
// { theme: 'light', lang: 'en', pagination: { pageSize: 20, page: 1 } }
```

## 数组操作

```javascript
const arr = [1, 2, 3, 2, 1];

_.uniq(arr); // [1, 2, 3]（去重）
_.uniqBy(users, "id"); // 按 id 去重
_.chunk([1, 2, 3, 4, 5], 2); // [[1,2],[3,4],[5]]（分组）
_.flatten([
  [1, 2],
  [3, [4]],
]); // [1,2,3,[4]]（展开一层）
_.flattenDeep([[1, [2, [3]]]]); // [1,2,3]（完全展开）
_.sortBy(users, ["age", "name"]); // 多字段排序
_.groupBy(users, "city"); // 按城市分组
_.keyBy(users, "id"); // 数组转以 id 为 key 的对象

// 实用场景：把用户数组转成 id → user 的 Map
const userMap = _.keyBy(users, "id");
userMap["123"]; // 直接按 id 查找
```

## 函数工具

```javascript
// _.debounce：防抖（停止操作后 n 毫秒执行）
const handleSearch = _.debounce((keyword) => {
  fetchResults(keyword);
}, 300);

// _.throttle：节流（n 毫秒内最多执行一次）
const handleScroll = _.throttle(() => {
  checkScrollPosition();
}, 100);

// _.memoize：缓存函数结果
const expensiveCalc = _.memoize((n) => {
  // 复杂计算
  return n * n;
});

// _.once：只执行一次
const init = _.once(() => {
  console.log("只初始化一次");
});
init();
init(); // 不再执行
```

## 字符串操作

```javascript
_.camelCase("hello-world"); // 'helloWorld'
_.kebabCase("helloWorld"); // 'hello-world'
_.snakeCase("helloWorld"); // 'hello_world'
_.startCase("helloWorld"); // 'Hello World'
_.truncate("很长很长的文字", { length: 10 }); // '很长很长很...'
_.template("你好，<%= name %>！")({ name: "张三" }); // '你好，张三！'
```

## 按需引入（减少体积）

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

## 小结

- `_.get/set`：安全访问/修改深层属性，不用担心 undefined
- `_.cloneDeep`：深拷贝
- `_.merge`：深合并，比 `Object.assign` 更彻底
- `_.groupBy/keyBy`：数组转对象，非常实用
- `_.debounce/throttle`：比手写更可靠
- 生产环境按需引入，减少打包体积