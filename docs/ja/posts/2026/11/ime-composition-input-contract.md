---
title: "IME の変換状態を分ける：検索欄の文字欠落と誤送信を防ぐ"
date: 2026-11-03 10:28:18
tags:
  - JavaScript
  - エンジニアリング
description: "候補文字列と確定した業務入力を分け、Enter と非同期検索の境界を作る。"
readingTime: 4
wordCount: 1050
---

候補を選ぶ Enter で未確定の読みが検索される。毎回値を書式化する欄では候補ウィンドウが閉じる。英語キーボードで正常でも、変換入力が正しいとは言えない。

例は独立したネイティブ検索欄だ。フレームワークの制御入力、リッチエディター、モバイルキーボードは、それぞれの統合検証が必要になる。

## 変換中は最終的な業務値ではない

compositionstart から compositionend まで、入力方式が候補と中間文字列を保持する。変更や取消もあり、途中の値は確定値とは限らない。表示しても、自動検索、保存、文字数制限、書式化で扱うかを決める。

変換中に整形した value を書き戻すと、DOM、選択、IME の内部状態がずれる。制御入力では表示用の下書きを更新し、業務への反映を遅らせられる。イベントを全部無視すると、次の描画で古い値を戻してしまうので同じではない。

## イベント属性と内部フラグを使う

[UI Events](https://w3c.github.io/uievents/#events-compositionevents) と [Input Events](https://www.w3.org/TR/input-events-2/)を参照しつつ、境界の順序を実環境で確認する。例は変換中の通知を抑え、終了後に DOM を読み、直前の通知値と同じなら重複を除く。

```javascript
export function bindSearch(input, onChange, onSubmit) {
  let composing = false;
  let active = true;
  let last = input.value;
  const publish = () => {
    if (!active || composing || input.value === last) return;
    last = input.value;
    onChange(last);
  };
  const start = () => { composing = true; };
  const end = () => {
    composing = false;
    queueMicrotask(publish);
  };
  const change = event => {
    if (!event.isComposing) publish();
  };
  const key = event => {
    if (event.key !== 'Enter' || composing || event.isComposing) return;
    event.preventDefault();
    publish();
    onSubmit(input.value);
  };
  const listeners = [
    ['compositionstart', start], ['compositionend', end],
    ['input', change], ['keydown', key],
  ];
  for (const [name, fn] of listeners) input.addEventListener(name, fn);
  return () => {
    active = false;
    for (const [name, fn] of listeners) input.removeEventListener(name, fn);
  };
}
```

マイクロタスクは同じイベント列の読み取りをまとめるだけで、全環境の順序を保証しない。最終 input が後のタスクなら、そのイベントで新しい値を通知できる。同値は再通知しない。Enter の属性も実環境で確認し、互換処理には具体的な根拠を残す。

## 候補確定と検索実行は別の意図

一回目の Enter は候補確定、次が検索かもしれない。全体のキャプチャーで先にすべて奪わず、フォーム、共通ショートカット、入力欄の優先度を決める。例は独立欄が Enter を処理するため、フォーム統合では submit と二重送信しないようにする。

値の変更と明示的な実行も異なる。onChange は重複排除するが、同じ語の onSubmit は再検索の意図かもしれず許可する。デバウンスや要求世代、キャッシュは通信層で扱う。

## 編集可能な途中状態を残す

負号だけ、小数点だけ、末尾の空白は、完成値として無効でも入力途中には自然に現れる。下書きに保持し、失焦や送信時に業務値へ変換する。文字数の単位も決め、変換途中で切らない。

貼り付け、音声、補完、Undo は期待する keydown を起こすとは限らない。変化は input から得る。選択置換、取消、焦点移動でもカーソルと下書きを保ち、古い検索候補の応答が現在の入力を上書きしないようにする。

## 合成イベントだけでは実入力を証明できない

単体テストはフラグ、重複排除、破棄、既知の順序を検証できる。イベントを人工的に送っても OS の候補窓を再現したことにはならない。対象の PC と携帯で中国語・日本語 IME を使い、選択、取消、Enter、連続入力を試す。

OS、ブラウザー、入力方式、順序を記録する。文字を失わず、候補確定で送信せず、一度の変化で通信を重複させないことが受け入れ条件だ。根拠を残せば、任意の待ち時間ではなく境界の修正として対応できる。
