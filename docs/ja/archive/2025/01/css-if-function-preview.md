---
title: "CSS if()関数：2025年最も期待されるCSS新プリミティブ"
date: 2025-01-15 14:09:46
tags:
  - CSS
readingTime: 3
description: "CSS `if()`関数は、State of CSS 2023の調査で「最も期待される新機能」として高得票を獲得した後、2025年についにブラウザの実験的な実装が登場しました。これにより、CSSプロパティの値内でインラインに条件ロジックを記述できるようになり、現在CSS変数＋メディアクエリ＋セレクターを組み合わせて乗り"
wordCount: 473
---

CSS `if()`関数は、State of CSS 2023の調査で「最も期待される新機能」として高得票を獲得した後、2025年についにブラウザの実験的な実装が登場しました。これにより、CSSプロパティの値内でインラインに条件ロジックを記述できるようになり、現在CSS変数＋メディアクエリ＋セレクターを組み合わせて乗り越えてきた条件付きスタイルの書き方が根本から変わります。

> **注意**：2025年1月時点で、`if()`はまだCSSワーキンググループの仕様草案段階にあります。Chromeの実験フラグ有効化後に使用可能ですが、まだ安定していません。

## 現在の課題：条件付きスタイルの回避策

```css
/* 現在、変数を使って条件スタイルを書くにはセレクターで回避するしかない */
:root {
  --is-dark: 0; /* 0 または 1 */
}

/* calc() ハック（数値にしか使えない） */
.bg {
  /* (1 - var(--is-dark)) × 255 + var(--is-dark) × 0 */
  /* 0 → 255（白）、1 → 0（黒）*/
  background: rgb(
    calc((1 - var(--is-dark)) * 255),
    calc((1 - var(--is-dark)) * 255),
    calc((1 - var(--is-dark)) * 255)
  );
}

/* または CSS セレクター :has()/:is() を使う */
:root:has([data-theme="dark"]) .bg {
  background: black;
}
:root:not(:has([data-theme="dark"])) .bg {
  background: white;
}
```

## CSS if()の構文（仕様草案）

```css
/* 基本構文 */
.element {
  color: if(style(--variant: primary): blue; else: gray);
}

/* 複数条件 */
.button {
  background: if(
    style(--size: large): hsl(200 80% 40%) ;
      style(--size: small): hsl(200 80% 60%) ; else: hsl(200 80% 50%)
  );

  padding: if(
    style(--size: large): 12px 24px; style(--size: small): 4px 8px; else: 8px
      16px
  );
}

/* media 条件の使用 */
.layout {
  display: if(media(width >= 768px): grid; else: flex);

  grid-template-columns: if(
    media(width >= 1024px): repeat(3, 1fr) ;
      media(width >= 768px): repeat(2, 1fr) ; else: 1fr
  );
}

/* supports 条件の使用 */
.animation {
  animation-timeline: if(
    supports(animation-timeline: scroll()): scroll() ; else: none
  );
}
```

## if()とカスタムプロパティの組み合わせ：コンポーネントバリアントシステム

これは`if()`の最も強力なユースケースです——HTML構造を変更せず、CSS変数だけでコンポーネントのバリアントを駆動できます。

```css
/* variant と size のバリアントをサポートするボタンを定義 */
.button {
  --variant: primary; /* デフォルト値 */
  --size: md;

  /* if() を使って変数に基づいてすべての関連プロパティを決定 */
  background: if(
    style(--variant: primary): var(--color-primary) ;
      style(--variant: secondary): transparent;
      style(--variant: danger): var(--color-danger) ; else: var(--color-primary)
  );

  color: if(style(--variant: secondary): var(--color-primary) ; else: white);

  border: if(
    style(--variant: secondary): 1px solid var(--color-primary) ; else: none
  );

  padding: if(
    style(--size: sm): 4px 10px; style(--size: lg): 12px 28px; else: 8px 16px
  );

  font-size: if(style(--size: sm): 13px; style(--size: lg): 17px; else: 15px);
}
```

```html
<!-- CSS 変数だけでバリアントを切り替える -->
<button class="button" style="--variant: primary; --size: lg">
  大きなプライマリボタン
</button>
<button class="button" style="--variant: secondary">セカンダリボタン</button>
<button class="button" style="--variant: danger; --size: sm">
  小さなデンジャーボタン
</button>
```

## 既存のアプローチとの比較

```
アプローチ比較（「ボタンバリアント」を例に、3バリアント × 3サイズ）：

アプローチ                        コード量  動的切り替え  JS実行時  セレクター詳細度
────────────────────────────────────────────────────────────────────────────────
CSS クラス名 (.btn-primary-lg)      多        JS必要        あり      累積
CSS 変数 + calc() ハック            多        CSS 変数      なし      影響なし
CSS セレクター :has() 組み合わせ    中        CSS 変数      なし      影響あり
CSS if()（将来）                    少        CSS 変数      なし      影響なし
```

## 今すぐ試す方法

```bash
# Chrome 125+ で実験フラグを有効化
# アドレスバーに入力：chrome://flags
# 「CSS if()」を検索
# または：--enable-experimental-web-platform-features
```

```css
/* または PostCSS プラグインで変換（polyfill アプローチ、部分的に互換）*/
/* postcss-if-value などのプラグインが開発中 */
```

## まとめ

CSS `if()`はCSSの条件ロジックの未来の方向性を示しています——コンポーネントのバリアントロジックをCSSにインライン化し、JavaScriptへの依存を減らしながら、CSS変数を「テーマ/状態の唯一の真実の源」にします。2025年初頭はまだプロダクション使用には適していませんが、今から構文を理解しておけば、安定化した後に素早く移行できます。
