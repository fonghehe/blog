---
title: "CSS BEM 命名規則"
date: 2018-09-14 14:48:41
tags:
  - CSS
readingTime: 1
description: "プロジェクトが大きくなると、CSS の命名が混乱し始めます：`.title`、`.list-item`、`.active`……グローバルなスタイルの衝突が増えていきます。BEM 規則で命名を統一した後、問題が大幅に減りました。"
wordCount: 214
---

プロジェクトが大きくなると、CSS の命名が混乱し始めます：`.title`、`.list-item`、`.active`……グローバルなスタイルの衝突が増えていきます。BEM 規則で命名を統一した後、問題が大幅に減りました。

## BEM とは

BEM = Block（ブロック）、Element（エレメント）、Modifier（モディファイア）

```
Block（ブロック）：独立したコンポーネント（header、menu、card など）
Element（エレメント）：ブロックの構成要素。__ で接続（card__title、menu__item など）
Modifier（モディファイア）：ブロックまたはエレメントの状態/バリアント。-- で接続（card--dark、menu__item--active など）
```

## 命名フォーマット

```css
/* Block */
.card {
}

/* Element（card に属する子要素）*/
.card__title {
}
.card__content {
}
.card__footer {
}

/* Modifier（card のバリアント）*/
.card--dark {
}
.card--horizontal {
}

/* Element + Modifier */
.card__title--large {
}
```

## 実際の例

```html
<!-- 商品カード -->
<div class="product-card product-card--featured">
  <img class="product-card__image" src="..." />
  <div class="product-card__body">
    <h3 class="product-card__title">商品名</h3>
    <p class="product-card__price">¥99</p>
    <p class="product-card__price product-card__price--original">¥199</p>
  </div>
  <div class="product-card__footer">
    <button class="product-card__btn product-card__btn--primary">
      カートに追加
    </button>
    <button class="product-card__btn product-card__btn--secondary">
      お気に入り
    </button>
  </div>
</div>
```

```css
.product-card {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

/* Modifier：特集商品 */
.product-card--featured {
  border-color: #f90;
  box-shadow: 0 2px 8px rgba(255, 153, 0, 0.3);
}

.product-card__image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.product-card__price {
  color: #f40;
  font-size: 18px;
  font-weight: bold;
}

/* 元値（取り消し線）*/
.product-card__price--original {
  color: #999;
  font-size: 14px;
  text-decoration: line-through;
}
```

## SCSS で BEM を書く

```scss
.product-card {
  border: 1px solid #eee;

  // &-- で Modifier を生成
  &--featured {
    border-color: #f90;
  }

  // &__ で Element を生成
  &__image {
    width: 100%;
  }

  &__price {
    color: #f40;

    // Element の Modifier
    &--original {
      color: #999;
      text-decoration: line-through;
    }
  }
}
```

## BEM のメリット

```
1. 命名が自己説明的：クラス名を見ればその要素が何でどこに属するかわかる
2. 優先度が低い：クラスセレクターのみ使用。入れ子なし。スタイルの重みが一定
3. 再利用可能：Block は独立しており、どこにでも配置できる
4. 低結合：HTML 構造に依存しないため、リファクタリングが怖くない
```

## BEM を使わない場面

```
- ユーティリティクラス（.text-center、.mt-16 など）は BEM 不要
- 状態クラス（.is-active、.has-error など）は is-/has- プレフィックスを使う慣習
- グローバルリセットスタイル
```

## Vue の scoped との組み合わせ

```vue
<style scoped>
/* scoped でスコープが分離されているため、BEM を適度に簡略化できる */
/* scoped がハッシュを付加するため、完全な block 名を書く必要はない */
.card {
  /* ... */
}
</style>
```

## まとめ

- BEM は CSS 命名の混乱を根本から解決する
- Block・Element・Modifier の3層構造で、クラス名が自己説明的になる
- SCSS の `&` 記法と組み合わせると書きやすい
- Vue の scoped を使う場合は BEM を適度に簡略化できる
