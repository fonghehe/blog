---
title: "State of CSS 2023：コンテナクエリ、ネスト、カラー関数が全面普及"
date: 2023-09-22 17:22:14
tags:
  - CSS
readingTime: 3
description: "State of CSS 2023 調査結果が2023年に発表され、世界9,000人以上の開発者からのデータが含まれています。今年のメインテーマは「長年待ち続けた機能がついに使えるようになった」：Container Queries、ネイティブ CSS ネスト、`:has()` セレクター、`color-mix()` な"
wordCount: 606
---

State of CSS 2023 調査結果が2023年に発表され、世界9,000人以上の開発者からのデータが含まれています。今年のメインテーマは「長年待ち続けた機能がついに使えるようになった」：Container Queries、ネイティブ CSS ネスト、`:has()` セレクター、`color-mix()` などがすべての主要ブラウザで85%以上のサポート率を突破し、実用可能な範囲に入りました。

## コンテナクエリ：真のコンポーネントレベルのレスポンシブデザイン

ついにビューポート幅に依存したレスポンシブデザインから解放されます。`@container` によりコンポーネントが自身のコンテナサイズに基づいてスタイルを調整できます：

```css
/* 定义容器 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* 容器查询 */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

```html
<!-- 同一组件在不同容器中自动适应 -->
<aside class="narrow-sidebar">
  <div class="card-container">
    <div class="card">...</div>
    <!-- 竖向布局 -->
  </div>
</aside>

<main class="wide-content">
  <div class="card-container">
    <div class="card">...</div>
    <!-- 横向网格布局 -->
  </div>
</main>
```

**コンテナクエリ単位（cqw/cqh）**：

```css
.responsive-text {
  font-size: clamp(14px, 4cqw, 24px); /* 字体随容器宽度变化 */
}
```

## ネイティブ CSS ネスト：プリプロセッサと決別する核心的理由

Baseline 2023、Chrome 112+、Safari 16.5+、Firefox 117+ がすべてサポート：

```css
/* 原生 CSS 嵌套（2023 年稳定） */
.button {
  background: #0066ff;
  color: white;
  padding: 8px 16px;

  &:hover {
    background: #0052cc;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 嵌套媒体查询 */
  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 14px;
  }

  /* 嵌套容器查询 */
  @container (min-width: 400px) {
    padding: 12px 24px;
  }
}
```

## :has() セレクター：「親セレクター」がついに実現

```css
/* 含有 img 的 card 显示特殊样式 */
.card:has(img) {
  padding: 0;
  overflow: hidden;
}

/* 含有 required 输入框的 form-group 显示必填标记 */
.form-group:has(input:required) .label::after {
  content: " *";
  color: red;
}

/* 父选择器用途：选中包含 :checked input 的 li */
li:has(input:checked) {
  background: #e8f5e9;
  font-weight: bold;
}

/* 当表格有超过 5 列时，调整单元格内边距 */
table:has(th:nth-child(5)) td {
  padding: 4px 8px; /* 列多时缩小内边距 */
}
```

## color-mix()：CSS ネイティブカラーミキシング

```css
:root {
  --primary: #0066ff;
  --primary-hover: color-mix(in srgb, var(--primary) 85%, black); /* 深15% */
  --primary-light: color-mix(in srgb, var(--primary) 20%, white); /* 浅80% */
  --primary-transparent: color-mix(in srgb, var(--primary) 60%, transparent);
}

.button {
  background: var(--primary);

  &:hover {
    background: var(--primary-hover); /* 自动计算悬停颜色 */
  }
}

.badge {
  background: var(--primary-light);
  border: 1px solid var(--primary);
}
```

## CSS 相対カラー構文（より強力なカラー計算）

```css
:root {
  --accent: hsl(200deg 80% 50%);
}

.variant-dark {
  /* 从 --accent 派生，只改亮度 */
  background: hsl(from var(--accent) h s calc(l - 15%));
}

.variant-muted {
  /* 降低饱和度 */
  background: hsl(from var(--accent) h calc(s - 40%) l);
}
```

## CSS カスケードレイヤー（@layer）：詳細度戦争を解決

```css
/* 按优先级从低到高声明层级 */
@layer reset, base, components, utilities;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer base {
  a {
    color: inherit;
  }
  button {
    cursor: pointer;
  }
}

@layer components {
  .card {
    /* 组件样式 */
  }
}

@layer utilities {
  .text-center {
    text-align: center !important;
  }
}

/* 不在任何层的样式总是胜过层内样式 */
.critical {
  color: red;
} /* 优先级最高，无需 !important */
```

## 2023年 State of CSS 調査ハイライトデータ

- **コンテナクエリ認知率**：91%、使用率は2022年の19%から42%に急増
- **`:has()`**：認知率72%、使用率38%（フルサポート初年度でこれほどの使用率）
- **ネイティブネスト**：認知率87%、使用率35%
- **最想要的新特性**：`if()` 函数（CSS 条件值）排名第一

## まとめ

2023年は CSS の「収穫の年」——長年待ち続けた機能がついて全面的に使えるようになりました。Container Queries によりコンポーネントが真に自己完結し、`:has()` が長らく欠如していた親セレクターの機能を実現し、ネイティブネストで CSS の可読性が大幅に向上しました。SCSS を大量に使用しているプロジェクトにとって、2023年は「プリプロセッサがまだ必要か」を評価する良い機会です。