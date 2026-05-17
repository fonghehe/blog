---
title: "JavaScriptメモリリークのデバッグ"
date: 2018-08-04 11:19:49
tags:
  - JavaScript
readingTime: 3
description: "ページを長時間使っているとメモリが増え続け、ブラウザが重くなって最終的に応答しなくなりました。よくあるメモリリークの原因とデバッグ方法をまとめます。"
---

ページを長時間使っているとメモリが増え続け、ブラウザが重くなって最終的に応答しなくなりました。よくあるメモリリークの原因とデバッグ方法をまとめます。

## よくあるメモリリークの原因

### 1. 削除されないイベントリスナー

```javascript
// 問題
class UserCard extends HTMLElement {
  connectedCallback() {
    document.addEventListener("click", this.handleClick);
    // 削除されない。要素が破棄されても、handleClickは参照を保持し続ける
  }

  handleClick = () => {
    /* ... */
  };
}

// 修正
class UserCard extends HTMLElement {
  connectedCallback() {
    document.addEventListener("click", this.handleClick);
  }

  disconnectedCallback() {
    // 要素が破棄されるときにリスナーを削除
    document.removeEventListener("click", this.handleClick);
  }
}
```

### 2. 削除されないタイマー

```javascript
// 問題：タイマーがlargeDataへの参照を保持
function startPolling() {
  const largeData = getLargeData();

  setInterval(() => {
    process(largeData); // largeDataはクロージャにキャプチャされている
  }, 1000);
  // タイマーが削除されず、largeDataがGCされない
}

// 修正：タイマーIDを保存して適切なタイミングでクリア
class Poller {
  start() {
    this.timer = setInterval(() => this.poll(), 1000);
  }

  stop() {
    clearInterval(this.timer);
  }
}
```

### 3. 大きなオブジェクトを保持するクロージャ

```javascript
// 問題
function setup() {
  const largeArray = new Array(1000000).fill("data");

  return {
    getValue() {
      // このクロージャがlargeArrayへの参照を保持
      return largeArray[0];
    },
    // 返されたオブジェクトが生きている限り、largeArrayは解放されない
  };
}

// 修正：必要なものだけ保存
function setup() {
  const largeArray = new Array(1000000).fill("data");
  const firstValue = largeArray[0]; // 必要なものだけ保持

  return {
    getValue() {
      return firstValue; // largeArrayをGCできるようになる
    },
  };
}
```

### 4. 無制限に増えるグローバルキャッシュ

```javascript
// 問題：キャッシュが無制限に増える
const cache = {};

function processUser(userId) {
  if (!cache[userId]) {
    cache[userId] = fetchUser(userId); // 永遠に増え続ける
  }
  return cache[userId];
}

// 修正：WeakMapを使う（GCフレンドリー）
const cache = new WeakMap();

function processUser(userObj) {
  if (!cache.has(userObj)) {
    cache.set(userObj, processData(userObj));
  }
  return cache.get(userObj);
  // userObjがGCされると、キャッシュエントリも自動的にクリーンアップされる
}

// 修正：サイズ制限付きのLRUキャッシュ
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // 末尾に移動（最近使用）
    return value;
  }

  set(key, value) {
    this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      // 最も古い（最初の）エントリを削除
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

## Chrome DevToolsでのデバッグ

### ステップ1：Memoryパネル — ヒープスナップショット

1. DevToolsを開いてMemoryタブを選択
2. "Heap snapshot"を選んでスナップショットを取得
3. ページを操作（ユーザーの操作を再現）
4. もう一度スナップショットを取得
5. "Comparison"ビューに切り替えて増えたオブジェクトを確認

### ステップ2：アロケーションタイムライン

1. "Allocation instrumentation on timeline"を選択
2. ページを操作
3. 縮小しないバー（解放されなかったオブジェクト）を探す

### ステップ3：Memoryパネルのリテイナーツリーを使う

スナップショットでオブジェクトを見つけ、"Retainers"列を展開してどの参照がガベージコレクションを妨げているかを確認します。

## Vue/React固有のリーク

```javascript
// Vue：beforeDestroyでグローバルイベントバスのリスナーを削除しない
export default {
  mounted() {
    this.$bus.$on("data-update", this.handleUpdate);
  },
  beforeDestroy() {
    this.$bus.$off("data-update", this.handleUpdate); // 必ずクリーンアップ！
  },
};

// React：componentWillUnmountでタイマーをクリアしない
class MyComponent extends React.Component {
  componentDidMount() {
    this.timer = setInterval(this.fetchData, 5000);
  }

  componentWillUnmount() {
    clearInterval(this.timer); // 必ずクリーンアップ！
  }
}
```

## まとめ

- 削除されないイベントリスナー、タイマー、クロージャが最もよくあるリークの原因
- `WeakMap`/`WeakSet`を使ってDOM関連データを保持するとGCが自動的に回収できる
- Chrome DevToolsのMemoryパネル：ヒープスナップショット+比較でリークしたオブジェクトを発見
- Vue/Reactでは、ライフサイクルの破棄フックでリスナーとタイマーをクリーンアップする
