---
title: "CSS Anchor Positioning 実践：宣言的ポジショニングの新パラダイム"
date: 2026-07-08 14:50:02
tags:
  - CSS
readingTime: 11
description: "CSS Anchor Positioning API はフローティング要素のポジショニングを JavaScript から CSS に戻す。本記事では anchor-name、position-anchor、position-try などのコアプロパティを詳解し、Tooltip、Popover、Dropdown の純 CSS 実装を通じて宣言的ポジショニングの実践を示す。"
wordCount: 2534
---

フロントエンド開発において、フローティング要素のポジショニングは常に悩みの種であった。Tooltip、Popover、Dropdown これらのコンポーネントのコア要件はシンプルである——「ある要素に寄り添って表示する」——しかし、実装には境界検出、反転、オフセット、スクロール追従などの一連のロジックの処理が必要となる。Floating UI、Popper.js などのライブラリの存在自体がこの問題の複雑さを物語っている。CSS Anchor Positioning API の登場により、これらは CSS の宣言的パラダイムに回帰した。

## コア概念とブラウザサポート

Anchor Positioning の中心的な考え方は、ある要素が「別の要素にアンカーする」ことを宣言し、CSS プロパティでアンカーに対する位置関係を記述するというものである。ブラウザが境界検出と反転を処理する。

2026 年 7 月時点の Anchor Positioning のブラウザサポート状況：

| ブラウザ | バージョン | サポート状況 |
|--------|------|----------|
| Chrome | 125+ | 完全サポート |
| Edge | 125+ | 完全サポート |
| Safari | 26+ | 完全サポート |
| Firefox | 138+ | 完全サポート |
| Safari iOS | 26+ | 完全サポート |

Chrome 125 が 2024 年 5 月にいち早くサポートし、2026 年までに主要ブラウザがすべて追従した。これは本番環境で Anchor Positioning を使用することがすでに実行可能な選択肢であることを意味するが、fallback の提供は依然必要である。

## anchor-name と position-anchor

二つのコアプロパティが Anchor Positioning の基礎を構成する。

```css
/* アンカー要素：自身のアンカー名を宣言 */
.anchor-button {
  anchor-name: --tooltip-anchor;
}

/* フローティング要素：何にアンカーするかを宣言 */
.tooltip {
  position: fixed;
  position-anchor: --tooltip-anchor;
  /* アンカーに対して相対的に配置 */
  top: anchor(bottom);
  left: anchor(center);
  /* 水平中央でアンカーに整列 */
  translate: -50% 0;
}
```

`anchor-name` はアンカー要素にカスタム識別子（`--` で始まる必要あり）を定義する。`position-anchor` はフローティング要素でこの識別子を参照し、アンカー関係を確立する。

`anchor()` 関数がポジショニングの中核であり、方向パラメータを受け取る。

- `anchor(top)` — アンカー要素の上端
- `anchor(bottom)` — アンカー要素の下端
- `anchor(left)` — アンカー要素の左端
- `anchor(right)` — アンカー要素の右端
- `anchor(center)` — アンカー要素の水平中央
- `anchor(center, 50%)` — 垂直中央（第二パラメータでパーセンテージを指定）

## 完全 Tooltip 実装

`popover` API と組み合わせて純 CSS の Tooltip を実装する。

```html
<style>
  .tooltip-trigger {
    anchor-name: --trigger-anchor;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
  }

  .tooltip {
    popover: auto;
    position: fixed;
    position-anchor: --trigger-anchor;
    /* アンカーの上に配置 */
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    /* 間隔 */
    margin-bottom: 8px;

    background: #1f2937;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    white-space: nowrap;

    /* 入場アニメーション */
    transition: opacity 0.2s, transform 0.2s;
    transform-origin: bottom center;
  }

  .tooltip:popover-open {
    opacity: 1;
  }

  .tooltip::backdrop {
    background: transparent;
  }
</style>

<button class="tooltip-trigger" popovertarget="my-tooltip">
  ホバーでヒントを表示
</button>

<div class="tooltip" id="my-tooltip" role="tooltip">
  これは純 CSS Tooltip です
</div>
```

JavaScript は一行も不要。`popover` API が表示/非表示を処理し、`position-anchor` がポジショニングを処理する。

## position-try Fallback 戦略

Tooltip はビューポートの端で切り取られる。`position-try` はブラウザに他の位置を自動的に試みさせる。

```css
.tooltip {
  position: fixed;
  position-anchor: --trigger-anchor;

  /* デフォルト位置：上 */
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;

  /* Fallback：上の空きが足りない場合、順番に他の位置を試みる */
  position-try: flip-block flip-inline;
}

/* 明示的に fallback リストを定義することも可能 */
.tooltip-explicit {
  position: fixed;
  position-anchor: --trigger-anchor;
  bottom: anchor(top);
  left: anchor(center);

  /* すべての代替位置を明示的に列挙 */
  position-try-options: --top, --bottom, --left, --right;
}

@position-try --top {
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;
}

@position-try --bottom {
  top: anchor(bottom);
  left: anchor(center);
  transform: translateX(-50%);
  margin-top: 8px;
}

@position-try --left {
  right: anchor(left);
  top: anchor(center);
  transform: translateY(-50%);
  margin-right: 8px;
}

@position-try --right {
  left: anchor(right);
  top: anchor(center);
  transform: translateY(-50%);
  margin-left: 8px;
}
```

`position-try: flip-block` の挙動：デフォルト位置の空きが足りない場合、ブラウザが自動的に反転する——上が下に、下が上になる。`flip-inline` は左右を反転させる。`flip-block flip-inline` の組み合わせで四方向をカバーできる。

`@position-try` ルールは完全なカスタマイズ能力を提供する。ブラウザは `position-try-options` にリストされた順序で一つずつ試み、完全に表示できる位置が見つかるまで続ける。

### position-try-fallbacks 優先度制御

```css
.dropdown {
  position: fixed;
  position-anchor: --dropdown-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  /* 戦略 1：まず反転を試み、次に移動を試みる */
  position-try: flip-block;

  /* 戦略 2：オーバーフローを許可するがサイズは変更しない */
  position-try: flip-block allow-overflow;

  /* 戦略 3：反転後も収まらない場合、整列方式を変更 */
  position-try: flip-block shift-inline;
}
```

`allow-overflow` はフローティング要素のビューポートはみ出しを反転ではなく許可するもので、コンテンツをクリップできない場面に適する。`shift-inline` は反転後も収まらない場合、中央揃えを維持せず水平方向にスライドする。

## Dropdown 実装とインタラクションスタイル

```css
.dropdown-menu {
  popover: auto;
  position: fixed;
  position-anchor: --menu-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  min-width: 200px;
  padding: 4px;

  position-try: flip-block;

  /* 入場アニメーション */
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}

.dropdown-menu:popover-open {
  opacity: 1;
  transform: scaleY(1);
}

.dropdown-menu:not(:popover-open) {
  opacity: 0;
  transform: scaleY(0.9);
}

.dropdown-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dropdown-item:hover {
  background: #f3f4f6;
}
```

```html
<button class="menu-trigger" popovertarget="menu" style="anchor-name: --menu-trigger">
  メニュー
  <svg width="12" height="12"><!-- arrow icon --></svg>
</button>

<div class="dropdown-menu" id="menu" role="menu">
  <div class="dropdown-item" role="menuitem">編集</div>
  <div class="dropdown-item" role="menuitem">コピー</div>
  <div class="dropdown-item" role="menuitem">削除</div>
</div>
```

## JavaScript ポジショニングソリューションとの比較

Floating UI を例に、同等の機能を実装するために必要なコード量：

```typescript
// Floating UI 実装
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom'

const trigger = document.querySelector('.trigger')
const tooltip = document.querySelector('.tooltip')

function update() {
  computePosition(trigger, tooltip, {
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(tooltip.style, {
      left: `${x}px`,
      top: `${y}px`,
    })
  })
}

autoUpdate(trigger, tooltip, update)

// 表示/非表示の手動処理も必要
trigger.addEventListener('mouseenter', () => {
  tooltip.style.display = 'block'
  update()
})
trigger.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none'
})
```

| 観点 | CSS Anchor Positioning | Floating UI / Popper.js |
|------|----------------------|------------------------|
| コード量 | ~20 行 CSS | ~30 行 JS + 依存パッケージ |
| 実行時性能 | ブラウザネイティブ、ゼロオーバーヘッド | ResizeObserver + scroll 監視 |
| バンドルサイズ | 0 KB | 3-15 KB（gzip） |
| SSR 対応 | 対応（純 CSS） | 非対応（クライアント hydration が必要） |
| 柔軟性 | 限定された fallback 戦略 | 完全にプログラマブルな middleware |
| ブラウザ互換性 | 2026 年主流フルカバー | 完全互換（IE11+） |
| 動的コンテンツ | 自動追従 | 手動で update の呼び出しが必要 |

Anchor Positioning はシンプルなケースでは JS ソリューションをほぼ完全に代替できる。しかし、複雑なロジック（sticky ポジショニング、仮想化リスト内の tooltip、クロス iframe ポジショニングなど）が必要な場合、Floating UI の方が依然として適している。

## アクセシビリティ（a11y）の考慮

Popover API の `popover` 属性は一部のアクセシビリティ機能を内蔵している。

- `popover="auto"` はフォーカストラップを自動処理
- Escape キーで自動的に閉じる
- 外部クリックで自動的に閉じる
- `aria-expanded` は手動管理が必要

```html
<button
  class="tooltip-trigger"
  popovertarget="my-tooltip"
  aria-describedby="my-tooltip"
  style="anchor-name: --trigger-anchor"
>
  アクションボタン
</button>

<div
  class="tooltip"
  id="my-tooltip"
  role="tooltip"
  popover="auto"
>
  このボタンをクリックして操作を実行
</div>
```

`role="tooltip"` と `aria-describedby` の組み合わせで、スクリーンリーダーがヒント情報を正しく関連付けられることを保証する。Dropdown 系コンポーネントについては、キーボードナビゲーションを手動で実装する必要がある。

```javascript
// 最小限のキーボードナビゲーション補完
const menu = document.querySelector('#menu')
const trigger = document.querySelector('[popovertarget="menu"]')

trigger.addEventListener('click', () => {
  if (menu.matches(':popover-open')) {
    const firstItem = menu.querySelector('[role="menuitem"]')
    firstItem?.focus()
  }
})

menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('[role="menuitem"]')]
  const currentIndex = items.indexOf(document.activeElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[(currentIndex + 1) % items.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[(currentIndex - 1 + items.length) % items.length]?.focus()
  } else if (e.key === 'Escape') {
    trigger.focus()
  }
})
```

## ブラウザ互換性の処理

`@supports` で検出し fallback を提供する。

```css
/* Fallback: Anchor Positioning 非対応時に absolute ポジショニングを使用 */
.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

@supports (anchor-name: --x) {
  .tooltip {
    position: fixed;
    position-anchor: --trigger-anchor;
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    margin-top: 0;
    margin-bottom: 8px;
  }
}
```

完全な fallback が必要なプロジェクトでは、`@floating-ui/dom` を polyfill として使用できる。

```javascript
// Anchor Positioning のサポートを検出
const supportsAnchor = CSS.supports('anchor-name: --x')

if (!supportsAnchor) {
  // Floating UI にフォールバック
  const { autoUpdate, computePosition, offset, flip, shift } = await import(
    '@floating-ui/dom'
  )
  // 全 .tooltip 要素を初期化
}
```

プログレッシブエンハンスメント戦略：モダンブラウザはネイティブな体験を得て、旧ブラウザは JS fallback を使用し、二つのソリューションを `@supports` で切り替える。

## メリット・デメリット分析

**メリット：**

- ゼロ JavaScript 実行時オーバーヘッド、ポジショニング計算はブラウザネイティブで実行
- Popover API との深い統合、表示/非表示/ポジショニングが一体化
- 宣言的構文は命令的 JS より保守しやすい
- スクロール、resize などの境界ケースを自動処理
- SSR フレンドリ、クライアント JS に依存しない

**デメリット：**

- Fallback 戦略が Floating UI ほど柔軟でなく、複雑なケースでは制限がある
- 動的アンカー（リスト項目の tooltip など）では動的に `anchor-name` を設定する必要があり、少量の JS が依然必要
- アニメーション制御が CSS transition に制限され、物理ベースのスプリングアニメーションは不可
- クロスコンテナポジショニング（modal 内の tooltip など）に stacking context の問題あり
- デバッグツールが未成熟で、Chrome DevTools のアンカー関係の可視化は改善が必要

## 今後の展望

CSS Anchor Positioning Level 2 では以下の拡張が議論されている。

- `anchor-scroll` — スクロールコンテナ内のアンカーのポジショニングをサポート
- `anchor-pos` — より精密な位置制御、パーセンテージと計算をサポート
- View Transitions API との統合 — 位置変化時のスムーズなトランジション
- `anchor-match` — アンカー状態に基づく条件付きスタイル

これらの拡張は JS ソリューションとの機能ギャップをさらに縮めるだろう。

## 個人的見解

Anchor Positioning は CSS が宣言的本質に回帰したまた一つのマイルストーンである。Flexbox から Grid、Container Queries、そして Anchor Positioning へと、CSS は JavaScript に奪われた領域を段階的に取り戻している。大多数の Tooltip と Dropdown のケースにおいて、純 CSS ソリューションはすでに十分であり、しかもパフォーマンスも高く、コードも少ない。

しかし本番環境で完全に Floating UI を破棄することはお勧めしない。理由は二つある。一つは互換性の移行期間に polyfill が必要なこと、二つ目は複雑なケース（リッチテキストエディタ内のフローティングメニューなど）では依然として JS によるきめ細かな制御が必要なことである。現実的なアプローチは、シンプルなケースは CSS、複雑なケースは JS とし、`@supports` で両者を共存させることである。

## まとめ

CSS Anchor Positioning は `anchor-name`、`position-anchor` と `anchor()` 関数で宣言的ポジショニングを実現し、`position-try` が境界反転を処理する。Popover API と組み合わせることで、純 CSS で完全な Tooltip、Dropdown コンポーネントを実現できる。Floating UI と比較して、ゼロ実行時オーバーヘッド、SSR フレンドリであるが、柔軟性は限定される。2026 年のブラウザ環境において、Anchor Positioning は本番利用可能であり、プログレッシブエンハンスメント戦略の採用を推奨する：ネイティブ優先、JS fallback をバックアップとする。
