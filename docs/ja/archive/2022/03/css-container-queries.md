---
title: "CSS Container Queries：レスポンシブデザインの次のマイルストーン"
date: 2022-03-22 09:48:38
tags:
  - CSS
readingTime: 3
description: "数年の待ちを経て、CSS Container Queries がようやく主要ブラウザで実装されました。従来のメディアクエリはビューポート幅に基づいていましたが、コンポーネントベースの開発で必要なのはコンテナ幅に基づくレスポンシブです。これこそがコンポーネントに本当に必要な機能です。"
wordCount: 589
---

数年の待ちを経て、CSS Container Queries がようやく主要ブラウザで実装されました。従来のメディアクエリはビューポート幅に基づいていましたが、コンポーネントベースの開発で必要なのはコンテナ幅に基づくレスポンシブです。これこそがコンポーネントに本当に必要な機能です。

## なぜ Container Queries が必要か

```html
<!-- 同一个卡片组件，在侧边栏和主内容区需要不同的样式 -->
<aside>
  <div class="card-container">
    <article class="card">
      <img src="photo.jpg" />
      <div class="card-body">
        <h3>标题</h3>
        <p>内容...</p>
      </div>
    </article>
  </div>
</aside>

<main>
  <div class="card-container">
    <article class="card">
      <img src="photo.jpg" />
      <div class="card-body">
        <h3>标题</h3>
        <p>内容...</p>
      </div>
    </article>
  </div>
</main>
```

以前はメディアクエリを使うと、ブラウザのビューポートに基づいてスタイルを決めることしかできませんでした。しかし、ここのカードコンポーネントは親コンテナの幅に応じてレイアウトを変更する必要があります。

## 基本的な使い方

```css
/* 1. 定义容器 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* 2. 使用 container query */
@container card (min-width: 400px) {
  .card {
    display: flex;
    gap: 16px;
  }

  .card img {
    width: 200px;
    height: 150px;
    object-fit: cover;
  }
}

@container card (min-width: 600px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .card img {
    width: 100%;
    height: 200px;
  }
}

/* 默认样式（小容器） */
.card {
  display: block;
}

.card img {
  width: 100%;
  height: auto;
}
```

`container-type: inline-size` はブラウザに対して、この要素がコンテナであり、インライン方向（水平）のサイズ変化を監視する必要があることを伝えます。

## コンテナクエリ単位

ビューポート単位と同様に、Container Queries もコンテナ相対単位を導入しています：

```css
/* cqw = 容器宽度的 1% */
.card-title {
  font-size: clamp(14px, 3cqw, 24px);
}

/* cqh = 容器高度的 1% */
.hero-banner {
  height: clamp(200px, 50cqh, 400px);
}

/* cqi/cqbi = 行内方向 */
.sidebar-text {
  font-size: max(12px, 2.5cqi);
}
```

## コンポーネントライブラリでの実用例

```css
/* Button 组件的响应式 */
.button-container {
  container-type: inline-size;
  container-name: button;
}

@container button (max-width: 200px) {
  .button {
    padding: 4px 8px;
    font-size: 12px;
  }

  .button-icon {
    display: none;
  }
}

@container button (min-width: 400px) {
  .button {
    padding: 12px 24px;
    font-size: 16px;
  }

  .button-icon {
    margin-right: 8px;
  }
}
```

```css
/* 表单组件的响应式 */
.form-container {
  container-type: inline-size;
  container-name: form;
}

@container form (min-width: 500px) {
  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-row label {
    width: 120px;
    text-align: right;
  }
}

@container form (min-width: 800px) {
  .form-row {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
    gap: 16px;
    align-items: center;
  }
}
```

## Container Name の役割

```css
/* 页面有多种容器，用 container-name 区分 */
.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

.main-content {
  container-type: inline-size;
  container-name: main;
}

/* 只响应侧边栏的尺寸变化 */
@container sidebar (min-width: 300px) { ... }

/* 只响应主内容区的尺寸变化 */
@container main (min-width: 800px) { ... }

/* 不指定名字的 query 会匹配最近的容器 */
@container (min-width: 400px) { ... }
```

## CSS 変数との組み合わせ

```css
.card-container {
  container-type: inline-size;
  container-name: card;
  --card-gap: 12px;
  --card-direction: column;
}

@container card (min-width: 400px) {
  .card-container {
    --card-gap: 16px;
    --card-direction: row;
  }
}

@container card (min-width: 600px) {
  .card-container {
    --card-gap: 24px;
    --card-direction: row;
  }
}

.card {
  display: flex;
  flex-direction: var(--card-direction);
  gap: var(--card-gap);
}
```

## ブラウザサポート（2022年中期）

Chrome 105+、Edge 105+、Safari 16+、Firefox 110+。未対応のブラウザには PostCSS プラグインでフォールバックできます：

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-preset-env')({
      features: {
        'css-container-queries': true,
      },
    }),
  ],
};
```

## まとめ

Container Queries はコンポーネントベース開発における最も基本的なニーズを解決します。グローバルなビューポートに依存するのではなく、コンポーネント自身のコンテナに応じてレスポンシブにレイアウトを調整できるのです。これは CSS レスポンシブデザインが「ページレベル」から「コンポーネントレベル」へ進化したことを意味します。主要ブラウザはすでに対応済みであり、コンポーネントライブラリで使い始める好機です。