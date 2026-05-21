---
title: "JavaScriptプロトタイプチェーンの図解"
date: 2018-08-09 15:14:28
tags:
  - JavaScript
readingTime: 2
description: "プロトタイプチェーンはJavaScriptのコアな概念で、多くの人がつまずきます。図とシンプルな例でわかりやすく説明します。"
wordCount: 340
---

プロトタイプチェーンはJavaScriptのコアな概念で、多くの人がつまずきます。図とシンプルな例でわかりやすく説明します。

## コアコンセプト

すべてのオブジェクトには内部プロパティ`[[Prototype]]`（`__proto__`でアクセス）があり、それが「プロトタイプオブジェクト」を指しています。プロパティにアクセスするとき、オブジェクトにそのプロパティがなければ、JavaScriptはチェーンを遡っていきます。これがプロトタイプチェーンです。

## 関数、Prototype、`__proto__`の関係

```javascript
function Person(name) {
  this.name = name;
}

Person.prototype.sayHello = function () {
  return `こんにちは、${this.name}です`;
};

const alice = new Person("Alice");

// プロトタイプチェーン：
// alice.__proto__ === Person.prototype ✓
// Person.prototype.__proto__ === Object.prototype ✓
// Object.prototype.__proto__ === null（チェーンの終端） ✓

console.log(alice.sayHello()); // "こんにちは、Aliceです"
// プロパティ探索：
// alice.sayHello → aliceには見つからない
//               → alice.__proto__（Person.prototype）を探す
//               → 見つかった！返す
```

関係のASCII図：

```
alice ─── __proto__ ──→ Person.prototype ─── __proto__ ──→ Object.prototype ─── __proto__ ──→ null
               ↑                    ↑
           constructor          constructor
               |                    |
             Person            （組み込み）
               |
           prototype ──→ Person.prototype
```

## `new`が何をするか

```javascript
// new Person('Alice') が実際にすること：
function myNew(Constructor, ...args) {
  // 1. 新しい空のオブジェクトを作成
  const obj = {};

  // 2. プロトタイプを設定：obj.__proto__ = Constructor.prototype
  Object.setPrototypeOf(obj, Constructor.prototype);

  // 3. コンストラクタを呼び出し、新しいオブジェクトをthisとして渡す
  const result = Constructor.apply(obj, args);

  // 4. コンストラクタがオブジェクトを返せばそれを使い、そうでなければobjを返す
  return result instanceof Object ? result : obj;
}

const alice = myNew(Person, "Alice");
```

## ES5継承（Object.create）

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name}が音を出します`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 親のコンストラクタを呼び出す
  this.breed = breed;
}

// キーとなる行：DogのプロトタイプをAnimal.prototypeに設定
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog; // constructorの参照を修正

Dog.prototype.bark = function () {
  return `${this.name}が吠えます`;
};

const rex = new Dog("Rex", "ハスキー");
rex.speak(); // "Rexが音を出します" — Animalから
rex.bark(); // "Rexが吠えます" — Dogから
```

## ES6クラス：糖衣構文

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return `${this.name}が音を出します`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // Animal.call(this, name)と同等
    this.breed = breed;
  }

  bark() {
    return `${this.name}が吠えます`;
  }
}

// 内部のプロトタイプチェーンは上記のES5バージョンと同じ
```

## プロパティ探索ルール

```javascript
const obj = { a: 1 };
const child = Object.create(obj);
child.b = 2;

// child.aを探す：
// 1. childで'a'を探す → 見つからない
// 2. child.__proto__（= obj）で'a'を探す → 見つかった！1を返す

// hasOwnProperty：オブジェクト自身のみをチェック（プロトタイプチェーンは遡らない）
child.hasOwnProperty("a"); // false
child.hasOwnProperty("b"); // true

// for...inはプロトタイプチェーン全体を遡る
for (const key in child) {
  console.log(key); // 出力：b, a
}

// 自身のプロパティのみ
for (const key in child) {
  if (child.hasOwnProperty(key)) {
    console.log(key); // 出力：b
  }
}
```

## よくある面接の質問

```javascript
// 質問1：typeof nullは何か？
typeof null; // "object" — JavaScriptの歴史的なバグ

// 質問2：instanceofは何をチェックするか？
[] instanceof Array; // true — Array.prototypeが[]のプロトタイプチェーンにあるかチェック
[] instanceof Object; // true — Array.prototype.__proto__ === Object.prototype

// 質問3：Object.create(null)後のプロトタイプチェーン
const obj = Object.create(null);
obj.__proto__; // undefined — プロトタイプチェーンが全くない
// toString、hasOwnPropertyなどを避ける完全にクリーンな辞書オブジェクトに使われる
```

## まとめ

- 各オブジェクトは`__proto__`でプロトタイプを指し、プロパティ探索はチェーンを遡る
- 関数には`prototype`プロパティがある。`new`の後、インスタンスの`__proto__`はそれに設定される
- `class`は糖衣構文で、内部の仕組みはプロトタイプチェーンのまま
- `hasOwnProperty`は自身のプロパティのみチェック。`in`演算子はチェーン全体を遡る
