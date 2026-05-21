---
title: "ブラウザイベントメカニズムの深い理解"
date: 2018-09-05 10:46:42
tags:
  - フロントエンド
readingTime: 2
description: "ブラウザイベントはフロントエンド開発の基礎ですが、イベントキャプチャ、バブリング、委譲の理解が不十分な人も多いです。ここで体系的に整理します。"
wordCount: 265
---

ブラウザイベントはフロントエンド開発の基礎ですが、イベントキャプチャ、バブリング、委譲の理解が不十分な人も多いです。ここで体系的に整理します。

## イベントフローの3フェーズ

ユーザーが要素をクリックすると、ブラウザは3つのフェーズを経ます：

```
Window
  └── Document
        └── html
              └── body
                    └── div#container（1. キャプチャフェーズ ↓）
                          └── button（2. ターゲットフェーズ）
                    └── div#container（3. バブリングフェーズ ↑）
```

```javascript
// addEventListenerの第3引数 true = キャプチャフェーズ、false（デフォルト）= バブリングフェーズ
element.addEventListener("click", handler, true); // キャプチャ
element.addEventListener("click", handler, false); // バブリング（デフォルト）

// optionsオブジェクト形式が推奨（より明確）
element.addEventListener("click", handler, { capture: true });
```

## バブリングの停止

```javascript
document.getElementById("child").addEventListener("click", (e) => {
  e.stopPropagation(); // イベントのバブリングを停止
  // e.stopImmediatePropagation()  // 同じ要素の他のリスナーも停止
});
```

## イベント委譲

各子要素にイベントをバインドする代わりに、バブリングを利用して親要素で一括処理：

```javascript
// 悪い例：各liにイベントをバインド（メモリ消費大、動的追加要素に無効）
document.querySelectorAll("li").forEach((li) => {
  li.addEventListener("click", handleItemClick);
});

// 良い例：親要素に委譲
document.getElementById("list").addEventListener("click", (e) => {
  const li = e.target.closest("li"); // closestで最も近いliを上方向に探す
  if (!li) return;

  const id = li.dataset.id;
  handleItemClick(id);
});

// 動的に追加されたliもイベントに応答できる ✅
const newLi = document.createElement("li");
newLi.dataset.id = "100";
newLi.textContent = "新しいアイテム";
document.getElementById("list").appendChild(newLi);
```

## e.target vs e.currentTarget

```javascript
document.getElementById("parent").addEventListener("click", (e) => {
  console.log(e.target); // 実際にイベントをトリガーした要素（子要素の可能性あり）
  console.log(e.currentTarget); // リスナーがバインドされた要素（parent）
});
```

## よく使われるマウスイベント

```javascript
element.addEventListener("mouseenter", () => {}); // 要素に入る、バブリングなし
element.addEventListener("mouseleave", () => {}); // 要素から出る、バブリングなし
element.addEventListener("mouseover", () => {}); // 要素または子要素に入る、バブリングあり
element.addEventListener("mouseout", () => {}); // 要素または子要素から出る、バブリングあり
```

`mouseenter` / `mouseleave`は子要素を通過するときに発火しないため、通常より使いやすいです。

## よく使われるキーボードイベント

```javascript
document.addEventListener("keydown", (e) => {
  console.log(e.key); // 'Enter', 'Escape', 'ArrowUp' など
  console.log(e.code); // 'KeyA', 'Digit1' など（物理キー）
  console.log(e.keyCode); // 非推奨、e.keyを使う

  // キーの組み合わせ
  if (e.ctrlKey && e.key === "z") {
    /* Ctrl+Z */
  }
  if (e.metaKey && e.key === "s") {
    /* Cmd+S */
  }
  if (e.shiftKey && e.key === "Enter") {
    /* Shift+Enter */
  }
});
```

## カスタムイベント

```javascript
// カスタムイベントの作成とディスパッチ
const event = new CustomEvent("user:login", {
  bubbles: true,
  cancelable: true,
  detail: { userId: 123, username: "Alice" },
});

document.dispatchEvent(event);

// カスタムイベントのリッスン
document.addEventListener("user:login", (e) => {
  console.log(e.detail.username); // 'Alice'
});
```

## 高頻度イベントのデバウンス

```javascript
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

window.addEventListener(
  "resize",
  debounce(() => {
    console.log("resizeが止まった後に実行");
  }, 300),
);
```

## イベントリスナーのクリーンアップ

```javascript
// よくあるメモリリーク：イベントをバインドしてクリーンアップしない
class Component {
  handleClick = () => {};

  mount() {
    document.addEventListener("click", this.handleClick);
  }

  destroy() {
    document.removeEventListener("click", this.handleClick); // 必ずクリーンアップ
  }
}
```
