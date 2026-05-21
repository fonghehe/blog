---
title: "JavaScript の this バインディング解説"
date: 2018-02-15 14:48:07
tags:
  - JavaScript
readingTime: 2
description: "`this` は JS で最もエラーが起きやすい概念の一つです。1年以上コーディングしてようやくルールが分かりました。"
wordCount: 254
---

`this` は JS で最もエラーが起きやすい概念の一つです。1年以上コーディングしてようやくルールが分かりました。

## 4つのバインディングルール

### 1. デフォルトバインディング

```javascript
function sayName() {
  console.log(this.name);
}

var name = "グローバル";
sayName(); // 'グローバル'（非strictモード、this は window を指す）

// Strict モード
("use strict");
sayName(); // TypeError: Cannot read property 'name' of undefined
```

### 2. 暗黙的バインディング

```javascript
const user = {
  name: "山田太郎",
  greet() {
    console.log(`こんにちは、${this.name}`);
  },
};

user.greet(); // 'こんにちは、山田太郎'（this は user を指す）

// 暗黙的バインディングの消失：メソッドを変数に代入
const greet = user.greet;
greet(); // 'こんにちは、undefined'（this が window になる）
```

この「消失」が最も一般的なバグの原因です：

```javascript
// 非同期コールバックで this が消える
const timer = {
  count: 0,
  start() {
    setInterval(function () {
      this.count++; // this は timer ではない！
    }, 1000);
  },
};
```

### 3. 明示的バインディング

```javascript
function greet(greeting) {
  console.log(`${greeting}、${this.name}`);
}

const user = { name: "山田太郎" };

greet.call(user, "こんにちは"); // call：即座に実行、引数を個別に渡す
greet.apply(user, ["こんにちは"]); // apply：即座に実行、引数を配列で渡す
const boundGreet = greet.bind(user); // bind：新しい関数を返す、即座には実行しない
boundGreet("こんにちは");
```

### 4. new バインディング

```javascript
function Person(name) {
  this.name = name; // this は新しく作られたオブジェクトを指す
}

const p = new Person("山田太郎");
console.log(p.name); // '山田太郎'
```

## アロー関数：自分の this を持たない

```javascript
const timer = {
  count: 0,
  start() {
    // アロー関数は外側（start メソッド）の this を継承する
    setInterval(() => {
      this.count++; // this は timer ✅
    }, 1000);
  },
};

// Vue の落とし穴：methods でアロー関数を使わない
export default {
  data() {
    return { name: "山田太郎" };
  },
  methods: {
    // 間違い：アロー関数、this は Vue インスタンスではない
    greet: () => {
      console.log(this.name); // undefined
    },
    // 正しい
    greet() {
      console.log(this.name); // '山田太郎'
    },
  },
};
```

## 優先順位

```
new > 明示的バインディング（call/apply/bind）> 暗黙的バインディング > デフォルトバインディング
```

## 実際のシナリオまとめ

```javascript
// シナリオ1：イベントコールバック、this を維持するためアロー関数を使う
class Component {
  handleClick = () => {
    // クラスプロパティ構文、アロー関数
    console.log(this); // 常に Component インスタンス
  };
}

// シナリオ2：動的な this が必要な場合、アロー関数を使わない
const obj = {
  value: 42,
  getValue() {
    return this.value;
  }, // 通常の関数、this は呼び出し方法に従う
};
```

## まとめ

- 通常の関数：`this` は**呼び出し時**に決まる（定義時ではない）
- アロー関数：`this` は**定義時に外側のスコープから継承**され、その後変わらない
- 優先順位：new > call/apply/bind > オブジェクトメソッド呼び出し > デフォルト window
- Vue の methods ではアロー関数を使わない
