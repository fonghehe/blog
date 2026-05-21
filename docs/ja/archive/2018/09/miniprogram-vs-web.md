---
title: "WeChat ミニプログラム開発：Web 開発との違い"
date: 2018-09-24 15:29:30
tags:
  - フロントエンド
readingTime: 2
description: "最近 WeChat ミニプログラムの案件を受けました。Web の基礎があれば比較的早くキャッチアップできましたが、慣れが必要な点もいくつかありました。"
wordCount: 436
---

最近 WeChat ミニプログラムの案件を受けました。Web の基礎があれば比較的早くキャッチアップできましたが、慣れが必要な点もいくつかありました。

## 似ているところ

ミニプログラムのコンポーネントは Vue によく似ています：

```javascript
// Vue コンポーネント
export default {
  data() {
    return { count: 0, list: [] };
  },
  computed: {
    doubleCount() {
      return this.count * 2;
    },
  },
  methods: {
    increment() {
      this.count++;
    },
  },
  mounted() {
    this.loadData();
  },
};
```

```javascript
// ミニプログラム Page
Page({
  data: {
    count: 0,
    list: [],
  },
  // computed はない、手動で更新する必要がある
  onLoad() {
    this.loadData();
  }, // ≈ mounted
  onShow() {}, // 表示されるたびに呼ばれる
  increment() {
    this.setData({ count: this.data.count + 1 }); // setData を使う必要がある
  },
  async loadData() {
    const res = await wx.request({ url: "..." });
    this.setData({ list: res.data });
  },
});
```

## 違うところ

### 1. DOM がない、Web API が使えない

```javascript
// ❌ ミニプログラムでは使えない
document.getElementById("xxx");
window.localStorage;
XMLHttpRequest;
fetch;

// ✅ ミニプログラムが提供する API を使う
wx.request({ url, method, data, success, fail }); // ネットワークリクエスト
wx.setStorageSync("key", value); // ローカルストレージ
wx.showToast({ title: "成功" }); // Toast 表示
```

### 2. ルーティング方式

```javascript
// ミニプログラムのルーティング
wx.navigateTo({ url: "/pages/detail/detail?id=123" }); // 遷移（戻れる）
wx.redirectTo({ url: "/pages/home/home" }); // 置き換え（戻れない）
wx.navigateBack({ delta: 1 }); // 戻る
wx.switchTab({ url: "/pages/index/index" }); // tabBar ページへ遷移

// URL パラメータの受け取り（文字列のみ）
// 受け取り：onLoad(options) { const id = options.id }
```

### 3. コンポーネントのライフサイクル

```javascript
// Web より多いライフサイクルメソッド：
onLoad(options); // ページ読み込み時（1回のみ）。options はルートパラメータ
onShow(); // ページ表示時（バックグラウンド/他ページからの復帰でも呼ばれる）
onHide(); // ページ非表示時
onUnload(); // ページ破棄時（navigateTo では呼ばれない、redirectTo では呼ばれる）
onPullDownRefresh(); // 下に引いてリフレッシュ
onReachBottom(); // スクロールが一番下に達したとき
```

### 4. スタイルの制限

```css
/* ミニプログラムは rpx（responsive pixel）を単位として使用 */
/* 750rpx = 画面幅 → 1rpx ≈ 0.5px（iPhone 6） */
.container {
  width: 750rpx; /* 全画面幅 */
  padding: 24rpx;
  font-size: 28rpx;
}

/* 使えない：* セレクター、タグセレクター（制限あり） */
/* 使える：クラスセレクター、ID セレクター、疑似クラス */
```

### 5. wxs：テンプレート内のロジック

ミニプログラムのテンプレート内では methods を直接呼べないため、wxs を使います：

```html
{% raw %}
<!-- WXML -->
<wxs module="utils" src="./utils.wxs"></wxs>
<view>{{ utils.formatDate(date) }}</view>
{% endraw %}
```

```javascript
// utils.wxs（JS ではない！構文に制限がある）
var formatDate = function (date) {
  return date.substring(0, 10);
};
module.exports = { formatDate: formatDate };
```

## おすすめのツール

- **uni-app**：1つのコードで複数プラットフォーム（ミニプログラム/H5/App）に対応
- **Taro**：React ライクな構文で各プラットフォームにコンパイル
- **WePY**：Vue ライクな構文のミニプログラムフレームワーク

WeChat ミニプログラムだけを対象とするなら、ネイティブ開発で十分です。マルチプラットフォームが必要なら uni-app や Taro が選択肢になります。

## まとめ

- ミニプログラムと Vue は設計思想が似ており、Web の基礎があれば早くキャッチアップできる
- 最大の違い：DOM/BOM がない。すべての API は `wx.*`
- `setData` でビューを更新する。`data` を直接変更してはいけない
- rpx はミニプログラム専用の単位。750rpx = 画面全幅
