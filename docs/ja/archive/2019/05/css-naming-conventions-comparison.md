---
title: "CSS BEM命名規則の実践"
date: 2019-05-01 10:39:56
tags:
  - CSS
readingTime: 1
description: "チームにCSS BEM命名規則を広める過程で、多くの落とし穴にはまりました。皆さんの参考になれば幸いです。"
---

チームにCSS BEM命名規則を広める過程で、多くの落とし穴にはまりました。皆さんの参考になれば幸いです。

## コア原則

BEMとは**Block**（ブロック）、**Element**（エレメント）、**Modifier**（モディファイア）の略です。命名フォーマット：

```css
/* Block：独立した意味のあるコンポーネント */
.card {
}

/* Element：ブロックの一部（ダブルアンダースコア） */
.card__title {
}
.card__body {
}
.card__footer {
}

/* Modifier：バリアントや状態（ダブルハイフン） */
.card--featured {
}
.card--disabled {
}
.card__title--large {
}
```

## 実践例

```html
<div class="card card--featured">
  <div class="card__header">
    <h2 class="card__title card__title--large">記事タイトル</h2>
  </div>
  <div class="card__body">
    <p class="card__text">コンテンツ...</p>
  </div>
  <div class="card__footer">
    <button class="card__btn card__btn--primary">続きを読む</button>
  </div>
</div>
```

```css
.card {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}
.card--featured {
  border-color: #409eff;
}
.card__title {
  font-size: 18px;
  margin: 0;
}
.card__title--large {
  font-size: 24px;
}
.card__btn {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.card__btn--primary {
  background: #409eff;
  color: #fff;
  border: none;
}
```

## 避けるべき落とし穴

1. **BEMをネストしない**：`.card__header__title`は誤り——`.card__header-title`を使う
2. **モディファイアは単独で使わない**：常にベースクラスを含める：`class="card__btn card__btn--primary"`
3. **ブロックの境界**：子要素はブロックに属し、ネストされた要素のブロックには属さない

BEMは詳細度の競合を排除し、HTMLとCSSの関係を即座に明確にすることで、大規模プロジェクトでのCSSの保守性を大幅に向上させます。
