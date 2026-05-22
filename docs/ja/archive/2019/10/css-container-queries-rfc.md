---
title: "CSS Container Queries 提案の深掘り"
date: 2019-10-08 17:48:44
tags:
  - CSS
readingTime: 5
description: "レスポンシブデザインでは、これまでビューポートサイズに基づいてレイアウトを調整するために @media クエリに依存してきました。しかし、この方法には根本的な欠陥があります：コンポーネントの動作がビューポートに依存し、コンポーネント自身のサイズに基づいていないことです。Container Queries の提案はこの問題を解決しようとしており、コンポーネントが親コンテナのサイズに応じて自身のスタイルを調整できるようにします。"
wordCount: 892
---

レスポンシブデザインでは、これまでビューポートサイズに基づいてレイアウトを調整するために `@media` クエリに依存してきました。しかし、この方法には根本的な欠陥があります：コンポーネントの動作がビューポートに依存し、コンポーネント自身のサイズに基づいていないことです。Container Queries の提案はこの問題を解決しようとしており、コンポーネントが親コンテナのサイズに応じて自身のスタイルを調整できるようにします。

## レスポンシブデザインの課題

カードコンポーネントがあるとします。メインコンテンツエリアでは横方向に配置し、サイドバーでは縦方向に配置したいとします。`@media` クエリを使用すると：

```css
/* ビューポートの幅に基づいてのみ判断 */
@media (min-width: 768px) {
  .card {
    flex-direction: row;
  }
}

@media (max-width: 767px) {
  .card {
    flex-direction: column;
  }
}
```

問題は、ビューポートが広くても、カードが狭いサイドバーに配置されている場合、狭い画面モードで表示されるべきだということです。`@media` クエリではこのシナリオを処理できません。

## Container Queries 提案のコアコンセプト

Container Queries（Element Queries とも呼ばれる）の核心的な考え方は、CSS がビューポートではなく親コンテナのサイズをクエリできるようにすることです。提案中の構文は以下のようになります：

```css
/* クエリコンテナを宣言 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* コンテナの幅に応じてスタイルを調整 */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
  .card__image {
    width: 200px;
    flex-shrink: 0;
  }
  .card__content {
    padding: 24px;
  }
}

@container card (max-width: 399px) {
  .card {
    flex-direction: column;
  }
  .card__image {
    width: 100%;
    height: 160px;
    object-fit: cover;
  }
  .card__content {
    padding: 16px;
  }
}
```

## 提案の構文詳解

### container-type

`container-type` は要素をクエリコンテナとして定義し、クエリ可能な次元を指定します：

```css
/* inline-size（水平方向の幅）のみをクエリ */
.sidebar {
  container-type: inline-size;
}

/* size（幅と高さ）をクエリ */
.panel {
  container-type: size;
}

/* 宣言するがクエリは有効にしない */
.widget {
  container-type: normal;
}
```

### container-name

`container-name` はコンテナに名前を付け、クエリが特定のコンテナを正確に指し示せるようにします：

```css
.main-content {
  container-type: inline-size;
  container-name: main;
}

.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

/* main コンテナを正確にクエリ */
@container main (min-width: 600px) {
  .card { /* ... */ }
}

/* sidebar コンテナを正確にクエリ */
@container sidebar (min-width: 300px) {
  .card { /* ... */ }
}
```

### container のショートハンド

```css
/* container-type + container-name と同等 */
.widget-wrapper {
  container: widget / inline-size;
}
```

## 実際のユースケース

### シナリオ1：コンポーネントライブラリのレスポンシブコンポーネント

```css
.card-wrapper {
  container: card-layout / inline-size;
}

@container card-layout (min-width: 500px) {
  .card {
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 24px;
  }
}

@container card-layout (min-width: 300px) and (max-width: 499px) {
  .card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}

@container card-layout (max-width: 299px) {
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card__title {
    font-size: 14px;
  }
  .card__description {
    display: none;
  }
}
```

### シナリオ2：ダッシュボード

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.widget {
  container: widget / inline-size;
}

@container widget (min-width: 400px) {
  .widget__chart {
    height: 200px;
  }
  .widget__details {
    display: block;
  }
}

@container widget (max-width: 399px) {
  .widget__chart {
    height: 100px;
  }
  .widget__details {
    display: none;
  }
}
```

## ResizeObserverでシミュレート

ネイティブサポートが来るまでは、JavaScript + ResizeObserver でシミュレートできます：

```js
class ContainerQuery {
  constructor(element, breakpoints) {
    this.element = element;
    this.breakpoints = breakpoints;
    this.observer = new ResizeObserver(this.handleResize.bind(this));
    this.observer.observe(element);
  }

  handleResize(entries) {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      this.applyClasses(width);
    }
  }

  applyClasses(width) {
    Object.keys(this.breakpoints).forEach(bp => {
      this.element.classList.remove(`cq-${bp}`);
    });

    let matched = null;
    const sorted = Object.entries(this.breakpoints)
      .sort((a, b) => a[1] - b[1]);

    for (const [name, minWidth] of sorted) {
      if (width >= minWidth) matched = name;
    }

    if (matched) this.element.classList.add(`cq-${matched}`);
  }

  destroy() {
    this.observer.disconnect();
  }
}

// 使用例
const wrapper = document.querySelector('.card-wrapper');
new ContainerQuery(wrapper, { sm: 300, md: 500, lg: 700 });
```

## React Hookとしてラップ

```jsx
import { useEffect, useRef, useState } from 'react';

function useContainerQuery(breakpoints) {
  const ref = useRef(null);
  const [breakpoint, setBreakpoint] = useState(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const sorted = Object.entries(breakpoints)
          .sort((a, b) => b[1] - a[1]);

        let matched = null;
        for (const [name, minWidth] of sorted) {
          if (width >= minWidth) {
            matched = name;
            break;
          }
        }
        setBreakpoint(matched);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, breakpoint];
}

// 使用例
function Card() {
  const [ref, bp] = useContainerQuery({
    small: 0,
    medium: 300,
    large: 500,
  });

  return (
    <div ref={ref}>
      <div className={`card card--${bp}`}>
        <img className="card__image" src="photo.jpg" alt="" />
        <div className="card__content">
          <h3>卡片标题</h3>
          <p>卡片描述内容</p>
        </div>
      </div>
    </div>
  );
}
```

## Container Queries と @media の関係

両者は補完関係であり、代替関係ではありません：

- **@media**：グローバルなレイアウト決定に適している（ページレベルのレスポンシブ）
- **@container**：コンポーネントレベルのレスポンシブに適している（コンポーネントの適応）

```css
/* 全体のレイアウトには @media */
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

/* コンポーネントの適応には @container */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

## まとめ

- Container Queries により、コンポーネントは親コンテナのサイズに応じてスタイルを調整できる
- 提案の核心的な構文：`container-type`、`container-name`、`@container`
- コンポーネントライブラリが異なるレイアウトコンテキストで適応する際の課題を解決
- 2019 年時点ではまだ提案段階であり、ブラウザのネイティブサポートは未実装
- ResizeObserver + CSS クラス名でシミュレート可能
- React Hook によるラップでコンポーネントでの使用を簡略化
- Container Queries と @media クエリは補完関係にある
