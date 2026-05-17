---
title: "JavaScriptオブジェクト指向プログラミング：プロトタイプチェーンとクラス設計"
date: 2018-03-30 11:27:27
tags:
  - JavaScript
readingTime: 2
description: "ES6 の `class` 構文により、JavaScript のオブジェクト指向はより直感的に書けるようになりました。しかし、内部はプロトタイプチェーンのままです。この2つの抽象化を理解すると、継承方式の選択やデバッグに自信が持てます。"
---

ES6 の `class` 構文により、JavaScript のオブジェクト指向はより直感的に書けるようになりました。しかし、内部はプロトタイプチェーンのままです。この2つの抽象化を理解すると、継承方式の選択やデバッグに自信が持てます。

## プロトタイプチェーンの基礎

JavaScript ではすべてのオブジェクトに暗黙のプロトタイプ `[[Prototype]]` があり、プロパティの検索はプロトタイプチェーンを辿ります：

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  console.log(`${this.name} makes a sound.`);
};

const dog = new Animal("Dog");
dog.speak(); // Dog makes a sound.
console.log(dog.__proto__ === Animal.prototype); // true
```

## ES6 class 構文

`class` はプロトタイプ継承の糖衣構文で、他言語に近い書き方ができます：

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    console.log(`${this.name} makes a sound.`);
  }
}

class Dog extends Animal {
  constructor(name) {
    super(name);
  }
  speak() {
    console.log(`${this.name} barks.`);
  }
}

const d = new Dog("Rex");
d.speak(); // Rex barks.
console.log(d instanceof Dog); // true
console.log(d instanceof Animal); // true
```

## 静的メソッドとプライベートフィールド（Stage 3）

```javascript
class Counter {
  #count = 0; // プライベートフィールド（2018年時点でStage 3提案）

  increment() {
    this.#count++;
  }
  get value() {
    return this.#count;
  }

  static create() {
    return new Counter();
  }
}

const c = Counter.create();
c.increment();
console.log(c.value); // 1
// console.log(c.#count); // SyntaxError
```

## 合成 vs 継承

継承は「is-a」関係を表し、合成は「has-a」関係を表します。過度な継承は密結合を招きます：

```javascript
// ❌ 過度な継承
class FlyingFishAnimal extends Animal { ... }

// ✅ 合成
const canFly = (base) => class extends base {
  fly() { console.log(`${this.name} is flying`); }
};
const canSwim = (base) => class extends base {
  swim() { console.log(`${this.name} is swimming`); }
};

class FlyingFish extends canFly(canSwim(Animal)) {}
const ff = new FlyingFish('FlyingFish');
ff.fly();  // FlyingFish is flying
ff.swim(); // FlyingFish is swimming
```

## よくある落とし穴

**1. this の消失**

```javascript
class Timer {
  constructor() {
    this.seconds = 0;
  }
  start() {
    // ❌ setTimeout 内の this は Timer インスタンスではない
    // setTimeout(function() { this.seconds++; }, 1000);
    // ✅ アロー関数を使う
    setTimeout(() => {
      this.seconds++;
    }, 1000);
  }
}
```

**2. super() の忘れ**

```javascript
class Child extends Parent {
  constructor(name) {
    // this への代入より前に super() を呼ぶ必要がある
    super(name); // ✅
    this.extra = "extra";
  }
}
```

## まとめ

ES6 class 構文は JavaScript OOP の可読性を大幅に改善しました。プロトタイプチェーンを理解することは良い JS を書く基礎であり、合成パターンを適切に使うことで継承階層が深くなりすぎる保守問題を避けられます。
