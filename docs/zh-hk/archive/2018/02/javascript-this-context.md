---
title: "JavaScript this 綁定機製：落地路徑與實戰建議"
date: 2018-02-15 14:48:07
tags:
  - JavaScript
readingTime: 1
description: "`this` 是 JS 裏最容易出錯的概念之一。寫了一年多代碼，終於搞清楚它的規則。"
wordCount: 148
---

`this` 是 JS 裏最容易出錯的概念之一。寫了一年多代碼，終於搞清楚它的規則。

## 四種綁定規則

### 1. 默認綁定

```javascript
function sayName() {
  console.log(this.name);
}

var name = "全局";
sayName(); // '全局'（非嚴格模式，this 指向 window）

// 嚴格模式
("use strict");
sayName(); // TypeError: Cannot read property 'name' of undefined
```

### 2. 隱式綁定

```javascript
const user = {
  name: "張三",
  greet() {
    console.log(`你好，${this.name}`);
  },
};

user.greet(); // '你好，張三'（this 指向 user）

// 隱式綁定丟失：把方法賦值給變量
const greet = user.greet;
greet(); // '你好，undefined'（this 變成了 window）
```

這個"丟失"是最常見的 bug 來源：

```javascript
// 異步回調裏 this 丟失
const timer = {
  count: 0,
  start() {
    setInterval(function () {
      this.count++; // this 不是 timer！
    }, 1000);
  },
};
```

### 3. 顯式綁定

```javascript
function greet(greeting) {
  console.log(`${greeting}，${this.name}`);
}

const user = { name: "張三" };

greet.call(user, "你好"); // call：立即執行，參數逐個傳
greet.apply(user, ["你好"]); // apply：立即執行，參數數組傳
const boundGreet = greet.bind(user); // bind：返回新函數，不立即執行
boundGreet("你好");
```

### 4. new 綁定

```javascript
function Person(name) {
  this.name = name; // this 指向新創建的對象
}

const p = new Person("張三");
console.log(p.name); // '張三'
```

## 箭頭函數：沒有自己的 this

```javascript
const timer = {
  count: 0,
  start() {
    // 箭頭函數繼承外層（start 方法）的 this
    setInterval(() => {
      this.count++; // this 就是 timer ✅
    }, 1000);
  },
};

// Vue 裏的坑：不要在 methods 裏用箭頭函數
export default {
  data() {
    return { name: "張三" };
  },
  methods: {
    // 錯誤：箭頭函數，this 不是 Vue 實例
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

## 優先級

```
new > 顯式綁定（call/apply/bind）> 隱式綁定 > 默認綁定
```

## 實際場景總結

```javascript
// 場景一：事件回調，用箭頭函數保持 this
class Component {
  handleClick = () => {
    // 類屬性語法，箭頭函數
    console.log(this); // 始終是 Component 實例
  };
}

// 場景二：需要動態 this 的情況，不要用箭頭函數
const obj = {
  value: 42,
  getValue() {
    return this.value;
  }, // 普通函數，this 跟調用方式走
};
```

## 小結

- 普通函數：this 在**調用時**決定，不是定義時
- 箭頭函數：this 在**定義時**繼承外層，之後不變
- 優先級：new > call/apply/bind > 對象調用 > 默認 window
- Vue methods 不要用箭頭函數