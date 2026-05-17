---
title: "CSS Flexboxレイアウト完全ガイド"
date: 2018-06-14 17:13:56
tags:
  - CSS
readingTime: 1
description: "Flexboxは現在最もよく使われるレイアウト方法ですが、一部のプロパティはいつも忘れてしまいます。クイックリファレンスとしてまとめました。"
---

Flexboxは現在最もよく使われるレイアウト方法ですが、一部のプロパティはいつも忘れてしまいます。クイックリファレンスとしてまとめました。

## コンテナのプロパティ

```css
.container {
  display: flex; /* または inline-flex */

  /* 主軸の方向 */
  flex-direction: row; /* → デフォルト */
  flex-direction: row-reverse; /* ← */
  flex-direction: column; /* ↓ */
  flex-direction: column-reverse; /* ↑ */

  /* 折り返し */
  flex-wrap: nowrap; /* 折り返しなし（デフォルト） */
  flex-wrap: wrap; /* 折り返し、下方向 */
  flex-wrap: wrap-reverse; /* 折り返し、上方向 */

  /* 主軸の整列（justify-content） */
  justify-content: flex-start; /* 左/上寄せ（デフォルト） */
  justify-content: flex-end; /* 右/下寄せ */
  justify-content: center; /* 中央 */
  justify-content: space-between; /* 両端揃え、均等間隔 */
  justify-content: space-around; /* 各アイテムの両側が均等 */
  justify-content: space-evenly; /* すべての間隔が均等 */

  /* 交差軸の整列（align-items） */
  align-items: stretch; /* 引き伸ばして埋める（デフォルト） */
  align-items: flex-start; /* 上寄せ */
  align-items: flex-end; /* 下寄せ */
  align-items: center; /* 中央 */
  align-items: baseline; /* ベースライン揃え */

  /* 複数行の整列（align-content、折り返し時のみ有効） */
  align-content: flex-start;
  align-content: space-between;

  /* gap（新プロパティ、marginトリックの代替） */
  gap: 16px; /* 行・列の間隔を同じに */
  gap: 16px 24px; /* 行間隔 列間隔 */
}
```

## アイテムのプロパティ

```css
.item {
  /* 順序 */
  order: 0; /* デフォルト0、小さいほど先 */

  /* 拡大比率（余白がある場合） */
  flex-grow: 0; /* デフォルトは拡大しない */
  flex-grow: 1; /* 残りのスペースをすべて占有 */

  /* 縮小比率（スペースが不足する場合） */
  flex-shrink: 1; /* デフォルトは比率に応じて縮小 */
  flex-shrink: 0; /* 縮小しない */

  /* 主軸上の初期サイズ */
  flex-basis: auto; /* デフォルト：コンテンツで決まる */
  flex-basis: 200px; /* 基本幅を指定 */

  /* 省略形：grow shrink basis */
  flex: 1; /* 1 1 0% */
  flex: auto; /* 1 1 auto */
  flex: none; /* 0 0 auto */
  flex: 0 0 200px; /* 固定200px、拡大も縮小もしない */

  /* コンテナのalign-itemsを上書き */
  align-self: center;
}
```

## よく使うレイアウトパターン

```css
/* 水平・垂直中央揃え */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 左右レイアウト、右側を固定幅に */
.layout {
  display: flex;
}
.layout-main {
  flex: 1;
}
.layout-sidebar {
  width: 240px;
  flex-shrink: 0;
}

/* フッターを底部に固定 */
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
main {
  flex: 1;
} /* 広がってフッターを底部に押し下げる */

/* 等高カラム */
.columns {
  display: flex; /* デフォルトalign-items: stretchで自動的に等高 */
}

/* レスポンシブカードリスト（1行3列） */
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.card {
  flex: 0 0 calc(33.33% - 12px); /* gapを引く */
}
```

## まとめ

- `justify-content`は主軸を制御し、`align-items`は交差軸を制御する
- `flex: 1`は等分配の最もよく使われる書き方
- `gap`プロパティは`margin`でスペースを作るより遥かにすっきりしている
- `flex-shrink: 0`で固定幅のサイドバーが圧縮されるのを防ぐ
