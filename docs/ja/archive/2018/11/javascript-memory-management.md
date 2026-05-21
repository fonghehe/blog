---
title: "JavaScript メモリ管理とガベージコレクション"
date: 2018-11-10 14:30:38
tags:
  - JavaScript
readingTime: 3
description: "フロントエンドのページを長時間使うとだんだん重くなることがあります。通常はメモリリークが原因です。JavaScript のメモリ管理の仕組みを理解することで、リークのないコードが書けます。"
wordCount: 577
---

フロントエンドのページを長時間使うとだんだん重くなることがあります。通常はメモリリークが原因です。JavaScript のメモリ管理の仕組みを理解することで、リークのないコードが書けます。

## メモリのライフサイクル

```
1. 割り当て：変数を宣言したりオブジェクトを作成したりすると、JS エンジンがメモリを割り当てる
2. 使用：割り当てられたメモリの読み書き
3. 解放：使われなくなったメモリは回収されるべき
```

JavaScript はガベージコレクター（GC）でメモリを自動解放するため、手動で `free()` する必要はありません。

## ガベージコレクション：マーク＆スイープ

現代の JS エンジンは主に**マーク＆スイープ**アルゴリズムを使用します：

```
「ルート」（グローバルオブジェクト、現在のコールスタック）から始め、
到達可能なすべてのオブジェクトをマーク。
マークされていないオブジェクト（到達不能）がガベージで、メモリを解放。
```

```javascript
function foo() {
  const obj = { name: "太郎" }; // メモリを割り当て
  console.log(obj.name);
  // foo の実行後、obj は到達不能になり、GC を待つ
}

// メモリリーク：obj が意図せず到達可能な状態を保つ
const cache = {};
function foo() {
  const obj = { name: "太郎", bigData: new Array(100000) };
  cache[obj.name] = obj; // obj が cache に参照されている。GC が回収できない！
}
```

## よくあるメモリリークのシナリオ

**1. グローバル変数**

```javascript
// ❌ 意図せずグローバル変数を作成
function foo() {
  leak = { data: new Array(100000) }; // var/let/const がない → グローバル変数になる
}

// ✅ strict モードでこれを防げる
("use strict");
function foo() {
  leak = {}; // TypeError: leak is not defined
}
```

**2. クリアされていないタイマー**

```javascript
// ❌ コンポーネントが破棄された後もタイマーが動き、コンポーネントへの参照を保持
created() {
  this.timer = setInterval(() => {
    this.data = fetchData()  // this（コンポーネントインスタンス）を保持
  }, 1000)
}

// ✅ コンポーネントの破棄時にクリア
beforeDestroy() {
  clearInterval(this.timer)
}
```

**3. 削除されていないイベントリスナー**

```javascript
// ❌
mounted() {
  window.addEventListener('resize', this.handleResize)
  // コンポーネントが破棄された後も、window が handleResize への参照を保持
}

// ✅
beforeDestroy() {
  window.removeEventListener('resize', this.handleResize)
}
```

**4. クリアされていない Vue イベントバス**

```javascript
// ❌
mounted() {
  this.$bus.$on('update', this.handler)
}

// ✅
beforeDestroy() {
  this.$bus.$off('update', this.handler)
}
```

**5. 大きなオブジェクトを保持するクロージャ**

```javascript
// ❌
function attachEvent(element) {
  const bigData = new Array(100000).fill("data");
  element.addEventListener("click", function () {
    console.log("clicked"); // クロージャが bigData を保持、回収不可
  });
}

// ✅ クロージャ内に大きなオブジェクトを保持しない
function attachEvent(element) {
  element.addEventListener("click", function () {
    console.log("clicked"); // 使うものだけ保持
  });
}
```

## Chrome DevTools でメモリリークを調査

1. **Performance パネル**：操作を録画し、メモリの折れ線グラフが継続的に増加しているか確認
2. **Memory パネル → Heap snapshot**：
   - 操作前にスナップショットを取る
   - 疑わしい操作を実行（例：モーダルを開いて閉じる）
   - 操作後に 2 枚目のスナップショットを取る
   - 2 枚を比較し、どのオブジェクトが増えているか確認

```
モーダルを閉じた後もスナップショットにモーダルコンポーネントが現れる場合、
解放されていない参照があることを示します
```

## 弱参照：WeakMap と WeakSet

```javascript
// WeakMap：キーは弱参照で、キーが GC に回収されると自動的にエントリが削除される
const cache = new WeakMap();

function processUser(user) {
  if (cache.has(user)) return cache.get(user);

  const result = heavyCompute(user);
  cache.set(user, result); // user オブジェクトが回収されるとこのエントリも自動的に消える
  return result;
}
// 手動でキャッシュをクリアする必要がなく、メモリリークが起きない
```

## まとめ

- JS はマーク＆スイープアルゴリズムで自動 GC。「到達不能」なオブジェクトが回収される
- メモリリーク = 使われなくなったオブジェクトが意図せず到達可能な状態を保つ
- よくある原因：クリアされていないタイマー、イベントリスナー、クロージャ、グローバル変数
- Vue コンポーネントは `beforeDestroy` でタイマーとイベントリスナーをクリア
- `WeakMap`/`WeakSet` で GC を妨げないキャッシュを実装できる
