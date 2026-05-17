---
title: "CSSのpositionとスタッキングコンテキスト"
date: 2018-07-05 10:44:49
tags:
  - CSS
readingTime: 2
description: "`position`はフロントエンド必須のプロパティですが、`z-index`が効かない問題で多くの人がハマっています。"
---

`position`はフロントエンド必須のプロパティですが、`z-index`が効かない問題で多くの人がハマっています。

## 5つの配置方法

```css
/* static：デフォルト。z-indexスタッキングに参加しない */
position: static;

/* relative：元の位置から相対的にオフセット。ドキュメントフローから外れない */
position: relative;
top: 10px; /* 10px下に移動。元の位置はスペースを占有し続ける */

/* absolute：最も近い非staticの祖先を基準に配置。フローから外れる */
position: absolute;
top: 0;
right: 0; /* 右上角 */

/* fixed：ビューポートを基準に配置。フローから外れ、スクロールしても動かない */
position: fixed;
bottom: 20px;
right: 20px; /* 右下に固定 */

/* sticky：閾値に達するまではrelative、その後はfixedになる */
position: sticky;
top: 60px; /* ビューポートの上端から60pxになったら固定 */
```

## absoluteの基準点

最も近い**非static**の祖先を探します：

```html
<div class="parent" style="position: relative;">
  <!-- この要素が基準になる -->
  <div class="child" style="position: absolute; top: 10px; left: 10px;"></div>
</div>
```

非static祖先がなければ`<html>`を基準にします。

## スタッキングコンテキスト

`z-index`が機能しない問題のほとんどはスタッキングコンテキストを理解していないことが原因です。

スタッキングコンテキストを作成する一般的な条件：

- `position: relative/absolute/fixed` + `z-index`がauto以外
- `opacity < 1`
- `transform: translate/rotate/scale`など
- `filter`がnone以外
- `will-change`

```html
<div style="position: relative; z-index: 1;">
  <!-- これは独自のスタッキングコンテキストを持つ -->
  <div style="position: absolute; z-index: 999;">
    <!-- z-index: 999は親コンテキスト内でのみ有効 -->
    <!-- 兄弟のz-index: 2を超えることはできない -->
  </div>
</div>
<div style="position: relative; z-index: 2;">
  <!-- z-index: 999の要素より上に表示される -->
</div>
```

**重要な理解**：子要素の`z-index`は親スタッキングコンテキスト内でのみ比較され、そこから抜け出すことはできません。

## よくある落とし穴：transformがスタッキングコンテキストを作成する

```css
/* 親にtransformがあると、子のfixedが機能しなくなる！ */
.parent {
  transform: translateZ(0); /* またはwill-change: transform */
}
.child {
  position: fixed; /* ビューポートではなく.parentに対して配置される */
}
```

## 実用的なテクニック

```css
/* 上下左右中央揃え（absoluteのクラシックな方法） */
.centered {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 固定底部ナビ（Safariのセーフエリア対応） */
.bottom-nav {
  position: fixed;
  bottom: 0;
  bottom: env(safe-area-inset-bottom); /* iOSノッチ対応 */
  width: 100%;
}

/* 固定テーブルヘッダー */
thead th {
  position: sticky;
  top: 0;
  background: white; /* 背景色は必須。ないと透明になる */
  z-index: 1;
}
```

## まとめ

- `absolute`は最も近い非static祖先を探す
- スタッキングコンテキストは内部の`z-index`を隔離する——これがz-indexが機能しない根本原因
- `transform`、`opacity < 1`、`filter`はすべてスタッキングコンテキストを作成する
- `sticky`は親要素に明確な高さが必要で、`overflow: hidden`があってはいけない
