---
title: "JavaScript 深拷贝的几种方案"
date: 2018-03-17 11:08:16
tags:
  - JavaScript
---

深拷贝在前端场景里很常见，但实现起来有很多坑。整理一下各种方案的适用场景和局限性。

## 浅拷贝 vs 深拷贝

```javascript
const obj = { name: "Alice", address: { city: "北京" } };

// 浅拷贝：只复制第一层，嵌套引用还是同一个
const shallow = { ...obj };
shallow.address.city = "上海";
console.log(obj.address.city); // '上海'，原对象被修改了！

// 深拷贝：完全独立，修改不影响原对象
const deep = deepClone(obj);
deep.address.city = "上海";
console.log(obj.address.city); // '北京'，原对象不受影响
```

## 方案一：JSON 序列化

```javascript
const clone = JSON.parse(JSON.stringify(obj));
```

**优点**：简单，一行代码

**缺点**：

- 无法处理 `undefined`、函数、Symbol（会被丢弃）
- 无法处理循环引用（会报错）
- `Date` 对象会变成字符串
- `NaN`、`Infinity` 变成 `null`
- 不保留 `RegExp`

```javascript
const obj = {
  undef: undefined, // 丢失
  fn: () => {}, // 丢失
  date: new Date(), // 变成字符串 "2018-03-17T..."
  regex: /test/g, // 变成空对象 {}
  nan: NaN, // 变成 null
};

const clone = JSON.parse(JSON.stringify(obj));
// { date: "2018-03-17T...", nan: null }
```

**适用场景**：纯数据对象（没有特殊类型），快速临时用。

## 方案二：递归实现

```javascript
function deepClone(source, cache = new WeakMap()) {
  // 基础类型直接返回
  if (source === null || typeof source !== "object") return source;

  // 处理循环引用
  if (cache.has(source)) return cache.get(source);

  // 处理特殊类型
  if (source instanceof Date) return new Date(source.getTime());
  if (source instanceof RegExp) return new RegExp(source.source, source.flags);

  // 创建空对象/数组
  const target = Array.isArray(source) ? [] : {};
  cache.set(source, target);

  // 递归复制每个属性
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = deepClone(source[key], cache);
    }
  }

  return target;
}
```

测试：

```javascript
const original = {
  name: "Alice",
  address: { city: "北京" },
  hobbies: ["coding", "reading"],
  date: new Date(),
  regex: /test/g,
};

// 循环引用测试
original.self = original;

const cloned = deepClone(original);
cloned.address.city = "上海";

console.log(original.address.city); // '北京'，不受影响
console.log(cloned.self === cloned); // true，循环引用正确处理
console.log(cloned.date instanceof Date); // true
```

## 方案三：structuredClone（现代浏览器）

2022 年各浏览器开始原生支持，2018 年还不可用，但值得了解：

```javascript
// 未来可用（Chrome 98+, Firefox 94+, Node 17+）
const clone = structuredClone(obj);
```

支持大多数类型，但不支持函数和 Symbol。

## 方案四：lodash.cloneDeep

生产环境最可靠的方案：

```javascript
import cloneDeep from "lodash/cloneDeep";

const clone = cloneDeep(source);
```

lodash 的实现处理了各种边界情况，是最稳健的选择。

## 实际项目中怎么选

| 场景                       | 推荐方案                       |
| -------------------------- | ------------------------------ |
| 纯数据对象，快速使用       | `JSON.parse(JSON.stringify())` |
| 需要处理 Date/RegExp       | lodash `cloneDeep`             |
| 不想引入依赖，已知数据结构 | 自己写递归                     |
| 表单 reset，保存初始值     | lodash `cloneDeep`             |

```javascript
// 表单场景：保存初始值，用于重置
import cloneDeep from 'lodash/cloneDeep'

data() {
  return {
    form: { name: '', email: '' },
    originalForm: null
  }
},
created() {
  this.loadData()
},
methods: {
  async loadData() {
    const data = await fetchFormData()
    this.form = data
    this.originalForm = cloneDeep(data)  // 保存初始状态
  },
  handleReset() {
    this.form = cloneDeep(this.originalForm)  // 恢复
  }
}
```

## 小结

- 简单场景用 `JSON.parse(JSON.stringify())`，但了解它的限制
- 生产代码推荐 `lodash/cloneDeep`，省心
- 如果追求零依赖，手写递归方案，记得处理循环引用
