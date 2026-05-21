---
title: "JavaScript this 绑定机制"
date: 2018-02-15 14:48:07
tags:
  - JavaScript
readingTime: 1
description: "`this` 是 JS 里最容易出错的概念之一。写了一年多代码，终于搞清楚它的规则。"
wordCount: 148
---

`this` 是 JS 里最容易出错的概念之一。写了一年多代码，终于搞清楚它的规则。

## 四种绑定规则

### 1. 默认绑定

```javascript
function sayName() {
  console.log(this.name);
}

var name = "全局";
sayName(); // '全局'（非严格模式，this 指向 window）

// 严格模式
("use strict");
sayName(); // TypeError: Cannot read property 'name' of undefined
```

### 2. 隐式绑定

```javascript
const user = {
  name: "张三",
  greet() {
    console.log(`你好，${this.name}`);
  },
};

user.greet(); // '你好，张三'（this 指向 user）

// 隐式绑定丢失：把方法赋值给变量
const greet = user.greet;
greet(); // '你好，undefined'（this 变成了 window）
```

这个"丢失"是最常见的 bug 来源：

```javascript
// 异步回调里 this 丢失
const timer = {
  count: 0,
  start() {
    setInterval(function () {
      this.count++; // this 不是 timer！
    }, 1000);
  },
};
```

### 3. 显式绑定

```javascript
function greet(greeting) {
  console.log(`${greeting}，${this.name}`);
}

const user = { name: "张三" };

greet.call(user, "你好"); // call：立即执行，参数逐个传
greet.apply(user, ["你好"]); // apply：立即执行，参数数组传
const boundGreet = greet.bind(user); // bind：返回新函数，不立即执行
boundGreet("你好");
```

### 4. new 绑定

```javascript
function Person(name) {
  this.name = name; // this 指向新创建的对象
}

const p = new Person("张三");
console.log(p.name); // '张三'
```

## 箭头函数：没有自己的 this

```javascript
const timer = {
  count: 0,
  start() {
    // 箭头函数继承外层（start 方法）的 this
    setInterval(() => {
      this.count++; // this 就是 timer ✅
    }, 1000);
  },
};

// Vue 里的坑：不要在 methods 里用箭头函数
export default {
  data() {
    return { name: "张三" };
  },
  methods: {
    // 错误：箭头函数，this 不是 Vue 实例
    greet: () => {
      console.log(this.name); // undefined
    },
    // 正确
    greet() {
      console.log(this.name); // '张三'
    },
  },
};
```

## 优先级

```
new > 显式绑定（call/apply/bind）> 隐式绑定 > 默认绑定
```

## 实际场景总结

```javascript
// 场景一：事件回调，用箭头函数保持 this
class Component {
  handleClick = () => {
    // 类属性语法，箭头函数
    console.log(this); // 始终是 Component 实例
  };
}

// 场景二：需要动态 this 的情况，不要用箭头函数
const obj = {
  value: 42,
  getValue() {
    return this.value;
  }, // 普通函数，this 跟调用方式走
};
```

## 小结

- 普通函数：this 在**调用时**决定，不是定义时
- 箭头函数：this 在**定义时**继承外层，之后不变
- 优先级：new > call/apply/bind > 对象调用 > 默认 window
- Vue methods 不要用箭头函数