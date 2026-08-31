---
title: "CSS Style Queries 実践：カスタムプロパティで駆動するコンポーネントバリアント"
date: 2026-08-21 14:06:19
tags:
  - CSS
readingTime: 9
description: "CSS Style Queries（@container style(...)）が Baseline 2026 に到達し、ついにカスタムプロパティの値に基づいてスタイルを適用できるようになった。本記事は実際の使い方に焦点を当てる：class に頼らないテーマ切り替え、custom property で駆動するコンポーネントバリアント、@property との連携、そしてフォールバック戦略。"
wordCount: 1996
---

Container Queries は「コンテナサイズに応じてレスポンシブにする」という問題を解決したが、一つの盲点があった：コンテナの状態（現在のテーマ、密度モード、ブランドカラーなど）に基づいて子コンポーネントのスタイルを変更できないのだ。これまで我々は大量の class（`.dark`、`.compact`、`.brand-acme`）を追加するか、JS で計算してから props を渡していた。Style Queries はこの隙間を埋める――`@container style(...)` でカスタムプロパティの値を直接クエリし、コンポーネントバリアントの制御権を CSS に戻すことができる。

## Style Queries の基本構文

Style Queries の構文は Size Container Queries と似ているが、クエリの対象がサイズからカスタムプロパティに変わる：

```css
/* style query container の宣言 */
.card-wrapper {
  container-type: normal; /* style queries は size containment を必要としない */
}

/* --theme が dark の場合 */
@container style(--theme: dark) {
  .card {
    background: #1a1a2e;
    color: #e0e0e0;
    border-color: #333;
  }
}

/* --density が compact の場合 */
@container style(--density: compact) {
  .card {
    padding: 8px 12px;
    font-size: 0.875rem;
  }
}
```

`container-type: normal` に注目――style queries は `size` や `inline-size` を必要としない。なぜならクエリ対象がサイズではなくプロパティ値だからだ。つまり、どの要素にも style container を設定でき、レイアウト制約が発動することはない。

## テーマ切り替え：グローバル .dark class との決別

従来のダークテーマの典型的な手法は `<html>` に `.dark` class を付け、子孫セレクタで全色を上書きすることだ。問題は、ページ内に明暗両方のテーマ領域を同時に配置したい場合（埋め込みウィジェット、プレビューパネルなど）、グローバル class では対応できなくなることだ。

Style Queries を使えば、テーマのスコープはコンテナに追従する：

```css
/* カスタムプロパティを登録し、型の正しさを保証する */
@property --theme {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: light;
}

/* テーマコンテナ */
.theme-scope {
  container-type: normal;
  --theme: light;
}

.theme-scope[data-theme="dark"] {
  --theme: dark;
}

/* コンポーネントスタイルはコンテナのテーマに応じて自動切り替え */
@container style(--theme: dark) {
  .button {
    background: var(--color-primary-dark);
    color: #fff;
  }

  .input {
    background: #2a2a3e;
    border-color: #444;
    color: #eee;
  }
}

@container style(--theme: light) {
  .button {
    background: var(--color-primary);
    color: #fff;
  }

  .input {
    background: #fff;
    border-color: #ddd;
    color: #333;
  }
}
```

```html
<!-- 同一ページ内で異なるテーマの領域 -->
<div class="theme-scope" data-theme="light">
  <div class="card">ライトテーマ領域のカード</div>
</div>

<div class="theme-scope" data-theme="dark">
  <div class="card">ダークテーマ領域のカード</div>
</div>
```

ここでの鍵は `inherits: true` だ。`--theme` は DOM ツリーに沿って下方に継承されるため、コンテナレベルで一度設定するだけで、内部の全子コンポーネントが style query を通じてそれを感知できる。各コンポーネントに class をバインドするよりも遥かにクリーンだ。

## Custom Property で駆動するコンポーネントバリアント

Style Queries が最も価値を発揮する場面は、コンポーネントバリアントを class 組み合わせ爆発から解放することだ。Card コンポーネントを例にとると、サイズ（small/medium/large）、トーン（neutral/accent/warning）、密度（comfortable/compact）の 3 つの次元がある。class の組み合わせでは 3×3×3=27 個のセレクタが必要だが、custom properties + style queries なら各次元を独立して処理するだけでよい。

```css
/* バリアントプロパティの登録 */
@property --card-size {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: medium;
}

@property --card-tone {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: neutral;
}

@property --card-density {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: comfortable;
}

/* 基本スタイル */
.card {
  container-type: normal;
  border-radius: 8px;
  transition: all 0.2s ease;
}

/* === サイズ次元 === */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-size: medium) {
  .card { padding: 20px; font-size: 0.9375rem; }
}
@container style(--card-size: large) {
  .card { padding: 28px; font-size: 1.0625rem; }
}

/* === トーン次元 === */
@container style(--card-tone: neutral) {
  .card { background: var(--surface-1); border: 1px solid var(--border-subtle); }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border: 1px solid var(--color-primary); }
}
@container style(--card-tone: warning) {
  .card { background: var(--surface-warning); border: 1px solid var(--color-warning); }
}

/* === 密度次元 === */
@container style(--card-density: compact) {
  .card { gap: 4px; line-height: 1.4; }
  .card__actions { margin-top: 8px; }
}
@container style(--card-density: comfortable) {
  .card { gap: 12px; line-height: 1.6; }
  .card__actions { margin-top: 16px; }
}
```

使用する側はプロパティ値を設定するだけだ：

```html
<div style="--card-size: large; --card-tone: accent; --card-density: compact;">
  <div class="card">
    <h3>大サイズ・アクセント・コンパクトカード</h3>
    <p>3 つの次元を独立制御、class 組み合わせなし。</p>
  </div>
</div>
```

Vue / React コンポーネントでは、これらの custom properties を props 経由でマッピングできる：

```vue
<template>
  <div
    :style="{
      '--card-size': size,
      '--card-tone': tone,
      '--card-density': density,
    }"
  >
    <div class="card">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
  tone?: 'neutral' | 'accent' | 'warning'
  density?: 'compact' | 'comfortable'
}>()
</script>
```

コンポーネントテンプレートにはバリアントロジックが一切含まれず、すべての視覚的差異は CSS style queries が処理する。デザインシステム更新時は CSS のみを変更し、コンポーネントコードは変更不要だ。

## @property との連携：なぜ登録が重要なのか

上記の例はすべて `@property` でカスタムプロパティを登録している。これは省略可能なものではない――登録しなければ、ブラウザはカスタムプロパティを型なし文字列として扱い、style query のマッチング動作が期待通りにならない可能性がある。

具体的には：

| 特性 | 未登録プロパティ | @property 登録後 |
|------|-----------|-----------------|
| 構文チェック | なし | syntax に従って検証 |
| 継承動作 | デフォルトで継承 | inherits で制御 |
| 初期値 | なし（空値はマッチしない） | initial-value あり |
| アニメーションサポート | サポートなし | syntax に従って補間 |
| Style Query マッチング | 厳密な文字列マッチのみ | 型付きマッチング |

よくある落とし穴：未登録のプロパティの値が空の場合（ある祖先要素が設定していない場合）、style query はどの分岐にもマッチせず、コンポーネントは基本スタイルにフォールバックする。登録後には `initial-value` があるため、常に確定したマッチ対象が存在する。

```css
/* 非継承 + 初期値を指定して登録 */
@property --card-highlight {
  syntax: '<color>';
  inherits: false;
  initial-value: transparent;
}

/* 明示的にハイライト色が設定されたコンテナ内でのみ有効 */
@container style(--card-highlight) {
  .card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--card-highlight);
  }
}
```

ここで `@container style(--card-highlight)` はコロンと値を持たず、「そのプロパティが存在し初期値以外であればマッチする」ことを表す。これは style queries の簡便記法で、オン/オフ型のバリアントに適している。

## フォールバック戦略：Style Queries 非対応時の対応

2026 年 8 月時点で、Style Queries は Baseline Newly Available となっており、Chrome 136+、Firefox 138+、Safari 18.4+ でサポートされている。しかし一部のユーザーはまだ旧バージョンを使用しているため、フォールバック方案を事前に検討しておく必要がある。

**戦略 1：@supports 検出 + class フォールバック**

```css
/* モダンブラウザ：style queries を使用 */
@supports (container-type: normal) and (style(--theme: dark)) {
  @container style(--theme: dark) {
    .card { background: #1a1a2e; color: #e0e0e0; }
  }
}

/* フォールバック：従来の class を使用 */
@supports not ((container-type: normal) and (style(--theme: dark))) {
  .theme-dark .card { background: #1a1a2e; color: #e0e0e0; }
}
```

**戦略 2：プログレッシブエンハンスメント――基本スタイルで保底**

最も汎用的なバリアントをデフォルトスタイルとし、style queries はエンハンスメントのみを担当させる。こうすれば非対応時でもコンポーネントは利用可能な外観を維持する：

```css
/* デフォルト = neutral + medium + comfortable */
.card {
  padding: 20px;
  font-size: 0.9375rem;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
}

/* style queries で非デフォルト値を上書き */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border-color: var(--color-primary); }
}
```

筆者は戦略 2 を推奨する。2 組のセレクタを管理する必要がなく、フォールバック時の体験はデフォルト外観に戻るだけで完全に崩れることはない。公衆向けコンテンツサイトにとって、このトレードオフは許容範囲だ。

## Size Container Queries との組み合わせ

Style Queries と Size Container Queries は同一コンテナ上で重ねて使用できる：

```css
.card-wrapper {
  container-type: inline-size; /* size と style queries を同時にサポート */
  --card-tone: neutral;
}

/* 狭いコンテナ + accent トーン */
@container (max-width: 300px) and style(--card-tone: accent) {
  .card {
    flex-direction: column;
    border-left: none;
    border-top: 3px solid var(--color-primary);
  }
}

/* 広いコンテナ + accent トーン */
@container (min-width: 301px) and style(--card-tone: accent) {
  .card {
    flex-direction: row;
    border-top: none;
    border-left: 3px solid var(--color-primary);
  }
}
```

この組み合わせ能力は class 方案ではほぼ不可能に等しい――サイズ×状態のあらゆる組み合わせに対して独立した class を書く必要があるが、CSS ネイティブでこの二次元関係を表現できるのだ。

## まとめ

Style Queries は CSS の条件付きスタイリングにおける重要な空白を埋めた：サイズではなく状態に基づくレスポンシブデザインだ。実際のプロジェクトにおける最大の価値は、class 組み合わせ爆発の解消と JS 層のスタイルロジックの削減にある。`@property` 登録で型安全性を獲得し、`@supports` でフォールバックを整備し、Size Container Queries と組み合わせて多次元レスポンシブを実現する。もしあなたのデザインシステムがまだ大量の modifier class でバリアントを管理しているなら、Style Queries は投資に値するリファクタリングの方向性だ。既存の方案を置き換える銀の弾丸ではないが、コンポーネントバリアント管理と局所テーマ切り替えの 2 つの場面において、これまでのどの純 CSS 方案よりも直接的である。
