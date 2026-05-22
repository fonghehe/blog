---
title: "CSS アンカーポジショニング：2025年、実験から実戦へ"
date: 2025-09-24 09:38:15
tags:
  - CSS
readingTime: 2
description: "CSS Anchor Positioning（CSSアンカーポジショニング）は2024年にChrome 125+で導入された後、2025年にFirefoxとSafariも対応し、実際に使えるサポート率（グローバル約78%）に達しました。これはフロントエンドが長年JavaScriptに頼ってきた「フローティングUI」のポ"
wordCount: 456
---

CSS Anchor Positioning（CSSアンカーポジショニング）は2024年にChrome 125+で導入された後、2025年にFirefoxとSafariも対応し、実際に使えるサポート率（グローバル約78%）に達しました。これはフロントエンドが長年JavaScriptに頼ってきた「フローティングUI」のポジション計算問題を解決します：Tooltip、Popover、ドロップダウンメニュー、フローティングパネル——これらすべてがアンカーポジショニングで実現でき、Popper.jsやFloating UIは不要になります。

## コアコンセプト：アンカーと配置要素

```css
/* 1. アンカーを定義（参照される要素）*/
.trigger-button {
  anchor-name: --my-anchor; /* 要素にアンカー名を付ける */
}

/* 2. 配置要素：アンカーに対して相対的に配置 */
.tooltip {
  position: absolute; /* 絶対/固定ポジショニングが必須 */
  position-anchor: --my-anchor; /* アンカーにバインド */

  /* anchor()関数：アンカーの各辺を参照 */
  bottom: anchor(top); /* アンカーの上辺に接する */
  left: anchor(left); /* 左揃え */

  /* アンカーの水平中央に */
  left: calc(anchor(left) + (anchor(width) / 2));
  translate: -50% 0;
}
```

## 実践：純CSS Tooltip

```html
<button class="btn" popovertarget="tip">
  ホバーしてヒントを表示
  <span id="tip" popover>純粋なCSS Tooltip、JSは不要！</span>
</button>
```

```css
.btn {
  anchor-name: --btn-anchor;
  position: relative; /* containing blockとして */
}

#tip {
  position: fixed; /* fixedでビューポートの任意の位置にアンカーに対して配置可能 */
  position-anchor: --btn-anchor;

  /* デフォルト：ボタンの上に中央揃えで表示 */
  bottom: calc(anchor(top) - 8px);
  left: anchor(center);
  translate: -50% 0;

  /* スタイリング */
  background: #1a1a2e;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
}

/* 矢印 */
#tip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  border: 6px solid transparent;
  border-top-color: #1a1a2e;
}
```

## @position-try：自動フリップ（オーバーフロー処理）

アンカーがビューポートの端に近い場合、ポップアップは自動的に方向を反転する必要があります：

```css
.popover {
  position: fixed;
  position-anchor: --trigger;

  /* デフォルト：下に表示 */
  top: anchor(bottom);
  left: anchor(left);

  /* 自動フリップルール */
  position-try-fallbacks:
    --above,   /* 試行案1 */
    --left,    /* 試行案2 */
    --right;   /* 試行案3 */
}

/* フリップ案を定義 */
@position-try --above {
  top: auto;
  bottom: anchor(top); /* 上に表示 */
}

@position-try --left {
  left: auto;
  right: anchor(left); /* 左側に表示 */
}

@position-try --right {
  left: anchor(right); /* 右側に表示 */
}
```

## 実践：ドロップダウン選択メニュー（Select代替）

```css
/* トリガーボタン */
.select-trigger {
  anchor-name: --select-trigger;
}

/* ドロップダウンリスト */
.select-dropdown {
  position: fixed;
  position-anchor: --select-trigger;

  /* トリガーボタンと同幅、真下に表示 */
  top: anchor(bottom);
  left: anchor(left);
  width: anchor-size(width); /* anchor-size()：アンカーのサイズを取得 */
  min-width: 120px;

  position-try-fallbacks: --above;
  margin-top: 4px;

  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

@position-try --above {
  top: auto;
  bottom: calc(anchor(top) - 4px);
}
```

## Floating UIとの比較

```
                  Floating UI/Popper.js    CSS Anchor Positioning
────────────────────────────────────────────────────────────────
実装方式          JavaScript              純CSS
バンドルサイズ    ~12KB gzip              0（ブラウザネイティブ）
動的計算          スクロール/リサイズ毎   ブラウザが自動処理
自動フリップ      middlewareを手動設定    @position-try
SSR互換性         hydration処理が必要     問題なし
ブラウザサポート  全て                   ~78%（2025年9月）
複雑なシナリオ    より柔軟               制限あり
```

**推奨戦略**：新プロジェクトではシンプルなシナリオ（Tooltip、ドロップダウン）にCSS Anchor Positioningを使い、複雑なインタラクション（アニメーション、複雑な位置合わせロジック）は引き続きFloating UIを使用できます。

## まとめ

CSS Anchor Positioningは「JavaScriptがCSSの仕事をする時代がついに終わった」というもう一つの例です。2025年にFirefoxのサポートが加わり、「プログレッシブエンハンスメント」の段階に達しました。内部ツールやBtoBシステム（モダンブラウザを要件にできる）では、Popper.js/Floating UIの基本シナリオを今すぐ置き換えることができます。
