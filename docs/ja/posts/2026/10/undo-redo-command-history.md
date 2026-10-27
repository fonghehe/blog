---
title: "Undo・Redo のコマンド履歴：一操作で何を戻すのか"
date: 2026-10-27 15:18:29
tags:
  - JavaScript
  - エンジニアリング
description: "字幕編集を例に、逆操作、意図によるグループ化、保存基準、外部副作用を分ける。"
readingTime: 4
wordCount: 1098
---

ドラッグで 80 回更新された結果、一度の Undo では一ピクセルしか戻らない。逆にコンポーネント全体を保存すると、パネルの開閉や読み込み状態まで過去へ戻る。難しいのは二つの配列ではなく、利用者にとっての一操作の定義だ。

例では安定した ID を持つ既存字幕の文字列だけを置き換える。挿入、削除、共同編集、通信の取り消しは対象にしない。

## 文書の変更を履歴にする

字幕内容、順序、時刻範囲は文書状態であり、選択、再生位置、ホバーは操作状態だ。選択も戻すかは別に決められるが、UI 全体の保存では古い通信状態や無効な参照まで復活する。

「三行目を変更」では並べ替え後に別字幕へ適用される。安定 ID と必要な版や前提条件を記録する。対象がないとき黙って無視して成功扱いにしない。

## 逆操作にも前提条件がある

例は before と after を持ち、Undo 時に現在値が期待値と一致するか確認する。不一致ならスタックを移動する前に失敗し、呼び出し側で競合処理する。無条件の上書きは外部変更を失わせる。教材用のクラスなので、実装時は状態と配列を外から直接変更できない形にする。

```javascript
export class CaptionHistory {
  constructor(initial, limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit');
    this.state = { ...initial };
    this.past = [];
    this.future = [];
    this.limit = limit;
  }
  apply(command, reverse = false) {
    const expected = reverse ? command.after : command.before;
    const next = reverse ? command.before : command.after;
    if (this.state[command.id] !== expected) throw new Error('revision conflict');
    this.state = { ...this.state, [command.id]: next };
  }
  execute(id, after) {
    if (!Object.hasOwn(this.state, id) || typeof after !== 'string') {
      throw new Error('unknown caption or invalid text');
    }
    const command = { id, before: this.state[id], after };
    if (command.before === after) return;
    this.apply(command);
    this.past.push(command);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo() {
    const command = this.past.at(-1);
    if (!command) return false;
    this.apply(command, true);
    this.past.pop();
    this.future.push(command);
    return true;
  }
  redo() {
    const command = this.future.at(-1);
    if (!command) return false;
    this.apply(command);
    this.future.pop();
    this.past.push(command);
    return true;
  }
}
```

新規操作は放棄した未来の redo を消す。変化のない操作は履歴に入れない。件数上限はバイト上限ではないため、大きな文字列には容量管理も必要だ。画像などは本体を複製せず、管理された資源への参照を使う。

## 時間だけでなく意図でまとめる

連続入力はまとめられるが、一定ミリ秒だけでは不十分だ。カーソル移動、字幕切り替え、貼り付け、IME 確定は区切りになり得る。ドラッグは開始値を記録し、途中はプレビュー、終了時に一命令とする。キャンセルは元へ戻し、履歴を追加しない。

複数変更の一取引は全成功後に記録し、失敗時は実行済み部分を復元する。逆順で戻すことが多いが、外部副作用には真の逆操作がない場合もある。文字編集の履歴から、全機能を戻せるとは言えない。

## 保存済みかどうかは履歴数で判定しない

保存後に編集し、Undo で保存内容に戻っても、`past.length > 0` は変更ありになる。上限に達すると件数が同じでも内容は変わる。保存基準の指紋や修訂を持ち、文書を比較する。

非同期保存は開始時のスナップショットに属する。A の保存中に B へ編集したら、成功は A が基準になっただけで、B が保存されたことにはならない。失敗してもローカル履歴を捨てず、編集と Undo を回復手段として残す。

## 外部効果と共同編集には別の契約が必要

送信したメールの Undo は、ボタンを戻すだけでは成立しない。取消、補償、新しい業務命令のどれかを定義する。共同編集では古い before が無効になるため、変換、共同編集モデル、競合方針が要る。例の条件確認は競合検出までで、自動マージではない。

連続 Undo/Redo、Undo 後の分岐、無操作、対象消失、容量超過時の切り捨て、保存中入力、IME とドラッグの境界を試す。[Input Events](https://www.w3.org/TR/input-events-2/)も参照し、ブラウザーの履歴と独自履歴が同じ入力を二重処理しないようにする。
