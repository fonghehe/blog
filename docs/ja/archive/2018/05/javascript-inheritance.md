---
title: "JavaScriptの継承パターン"
date: 2018-05-24 16:15:02
tags:
  - JavaScript
readingTime: 2
description: "面接の定番問題ですが、深く理解することには実際の価値もあります。JSの継承方法は多く、それぞれ適した場面があります。"
wordCount: 381
---

面接の定番問題ですが、深く理解することには実際の価値もあります。JSの継承方法は多く、それぞれ適した場面があります。

## プロトタイプチェーン継承

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name}が声を出す`;
};

function Dog(name) {
  this.name = name;
}
Dog.prototype = new Animal(); // プロトタイプチェーン継承

const dog = new Dog("ポチ");
dog.speak(); // 'ポチが声を出す'
```

**問題**：すべてのサブクラスインスタンスがプロトタイプ上の参照型プロパティを共有します。

```javascript
function Animal() {
  this.friends = []; // 参照型
}
Dog.prototype = new Animal();

const d1 = new Dog();
const d2 = new Dog();
d1.friends.push("ネコ");
console.log(d2.friends); // ['ネコ'] ← d2も汚染される！
```

## コンストラクター継承（コンストラクターの借用）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}

function Dog(name, breed) {
  Animal.call(this, name); // サブクラスのコンストラクター内で親クラスを呼び出す
  this.breed = breed;
}

const d1 = new Dog("ポチ", "柴犬");
const d2 = new Dog("クロ", "ラブラドール");
d1.friends.push("ネコ");
console.log(d2.friends); // [] ← 相互に影響しない
```

**問題**：親クラスのプロトタイプ上のメソッドを継承できません（`Animal.prototype.speak`が使えない）。

## 組み合わせ継承（最も一般的な従来の方法）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name}が声を出す`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 1. プロパティを継承
  this.breed = breed;
}
Dog.prototype = new Animal(); // 2. メソッドを継承
Dog.prototype.constructor = Dog; // 3. constructorを修正

const dog = new Dog("ポチ", "柴犬");
dog.speak(); // ✅ 親クラスのメソッドを呼べる
dog.friends; // ✅ 独立している、共有しない
```

**問題**：`Animal`が2回呼ばれる（パフォーマンスの無駄）。

## Object.create：寄生組み合わせ継承（従来の最良パターン）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name}が声を出す`;
};

function Dog(name, breed) {
  Animal.call(this, name);
  this.breed = breed;
}

// ポイント：new Animal()の代わりにObject.createを使用 — 親コンストラクターの2回呼び出しを避ける
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

// サブクラスのメソッド
Dog.prototype.bark = function () {
  return "ワンワン！";
};
```

## ES6 class（モダンなアプローチ）

```javascript
class Animal {
  constructor(name) {
    this.name = name;
    this.friends = [];
  }

  speak() {
    return `${this.name}が声を出す`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // 必ず最初にsuperを呼ぶ
    this.breed = breed;
  }

  bark() {
    return "ワンワン！";
  }
}

const dog = new Dog("ポチ", "柴犬");
dog.speak(); // 'ポチが声を出す'
dog.bark(); // 'ワンワン！'
dog instanceof Animal; // true
dog instanceof Dog; // true
```

## まとめ

| パターン             | プロパティ継承 | メソッド継承 | 推奨                           |
| -------------------- | -------------- | ------------ | ------------------------------ |
| プロトタイプチェーン | ❌共有         | ✅           | ❌                             |
| コンストラクター     | ✅             | ❌           | ❌                             |
| 組み合わせ           | ✅             | ✅           | 使えるがパフォーマンス問題あり |
| 寄生組み合わせ       | ✅             | ✅           | ✅ ES6前の最良パターン         |
| ES6 class            | ✅             | ✅           | ✅ モダンな第一選択            |

新しいコードはES6 classを使います。プロトタイプチェーン継承の理解はレガシーコードの読解と面接対策のためです。
