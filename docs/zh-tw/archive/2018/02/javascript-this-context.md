---
title: "JavaScript this 繫結機制"
date: 2018-02-15 14:48:07
tags:
  - JavaScript
readingTime: 1
description: "`this` 是 JS 裡最容易出錯的概念之一。寫了一年多程式碼，終於搞清楚它的規則。"
wordCount: 151
---

`this` 是 JS 裡最容易出錯的概念之一。寫了一年多程式碼，終於搞清楚它的規則。

## 四種繫結規則

### 1. 預設繫結

```javascript
function sayName() {
  console.log(this.name);
}

var name = "全域性";
sayName(); // '全域性'（非嚴格模式，this 指向 window）

// 嚴格模式
("use strict");
sayName(); // TypeError: Cannot read property 'name' of undefined
```

### 2. 隱式繫結

```javascript
const user = {
  name: "張三",
  greet() {
    console.log(`你好，${this.name}`);
  },
};

user.greet(); // '你好，張三'（this 指向 user）

// 隱式繫結丟失：把方法賦值給變數
const greet = user.greet;
greet(); // '你好，undefined'（this 變成了 window）
```

這個"丟失"是最常見的 bug 來源：

```javascript
// 非同步回撥裡 this 丟失
const timer = {
  count: 0,
  start() {
    setInterval(function () {
      this.count++; // this 不是 timer！
    }, 1000);
  },
};
```

### 3. 顯式繫結

```javascript
function greet(greeting) {
  console.log(`${greeting}，${this.name}`);
}

const user = { name: "張三" };

greet.call(user, "你好"); // call：立即執行，引數逐個傳
greet.apply(user, ["你好"]); // apply：立即執行，引數陣列傳
const boundGreet = greet.bind(user); // bind：返回新函式，不立即執行
boundGreet("你好");
```

### 4. new 繫結

```javascript
function Person(name) {
  this.name = name; // this 指向新建立的物件
}

const p = new Person("張三");
console.log(p.name); // '張三'
```

## 箭頭函式：沒有自己的 this

```javascript
const timer = {
  count: 0,
  start() {
    // 箭頭函式繼承外層（start 方法）的 this
    setInterval(() => {
      this.count++; // this 就是 timer ✅
    }, 1000);
  },
};

// Vue 裡的坑：不要在 methods 裡用箭頭函式
export default {
  data() {
    return { name: "張三" };
  },
  methods: {
    // 錯誤：箭頭函式，this 不是 Vue 例項
    greet: () => {
      console.log(this.name); // undefined
    },
    // 正確
    greet() {
      console.log(this.name); // '張三'
    },
  },
};
```

## 優先順序

```
new > 顯式繫結（call/apply/bind）> 隱式繫結 > 預設繫結
```

## 實際場景總結

```javascript
// 場景一：事件回撥，用箭頭函式保持 this
class Component {
  handleClick = () => {
    // 類屬性語法，箭頭函式
    console.log(this); // 始終是 Component 例項
  };
}

// 場景二：需要動態 this 的情況，不要用箭頭函式
const obj = {
  value: 42,
  getValue() {
    return this.value;
  }, // 普通函式，this 跟呼叫方式走
};
```

## 小結

- 普通函式：this 在**呼叫時**決定，不是定義時
- 箭頭函式：this 在**定義時**繼承外層，之後不變
- 優先順序：new > call/apply/bind > 物件呼叫 > 預設 window
- Vue methods 不要用箭頭函式