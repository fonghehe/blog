---
title: "Flutter フォームの非同期検証：古い結果で新しい入力を上書きしない"
date: 2026-09-18 10:25:57
tags:
  - モバイル
description: "入力の世代管理、防振、送信の重複防止、サーバーエラーの反映を扱う。"
readingTime: 3
wordCount: 847
---

ユーザー名、クーポン、振込先の確認は非同期になりやすい。A を入力してすぐ B に変えた場合、遅れて返る A の結果で B を「使用不可」と表示してはならない。結果がどの入力に属するかを管理する。

## 入力時点と検証結果を結び付ける

入力が変わるたびに世代番号を進め、短い待機後に検証する。応答が来たら世代と現在のテキストを再確認し、違えば捨てる。ローカルの正規表現だけで送信可能とせず、必要な非同期検証を待ち、最終判断はサーバーでも行う。

画面破棄時はタイマーを止める。通信障害を「名前が使えない」と誤表示せず、再試行できる状態を示す。

```dart
int generation = 0;

Future<void> validateName(String name) async {
  final current = ++generation;
  final result = await repository.checkName(name);
  if (!mounted || current != generation || controller.text != name) return;
  setState(() => nameError = result.isAvailable ? null : 'Name unavailable');
}
```

## 送信は別の状態として扱う

送信中は連打を防ぎ、冪等キーを付ける。サーバーから項目別エラーが来たら該当欄へ戻し、他の入力は保持する。失敗なら修正と再試行を許し、成功時は一度だけ画面を移る。

応答の順序逆転、画面離脱、回転、送信中の断線を試験する。

## 入力を変えたら古い結果は無効

登録フォームのユーザー名確認を考える。`alice` の要求 A が処理中に利用者が `alice2` へ変え、要求 B を出す。A が後で「使用中」と返しても、そのエラーを `alice2` に付けてはいけない。非同期検証ごとに開始時の値と連番を保存し、表示前に現在値と最新番号の両方を比較する。HTTP の中断は通信量を節約するが、中断と応答が競合するので、この検査も必要だ。

必須・長さ・形式などのローカル規則は入力時に確認できる。ユーザー名の空きやクーポンの有効性などサーバーが必要な検証は、入力が少し止まってから行う。画面を離れたらタイマーと購読を解放する。送信時には数秒前の「使用可能」を信用せず、サーバーが一意性を原子的に検査する。返された項目別エラーを対応する欄に置き、入力値は残す。通信障害はフォーム全体の問題であり、欄の値が不正という意味ではない。

```dart
final valueAtStart = controller.text;
final ticket = ++latestValidation;
final available = await api.isUsernameAvailable(valueAtStart);
if (!mounted || ticket != latestValidation || controller.text != valueAtStart) return;
setState(() => usernameError = available ? null : 'Name is taken');
```

## フォームの生存期間全体を試す

高速入力、削除後に同じ値を再入力、遅い応答の逆転、画面回転、離脱後の応答、送信中の切断、連打を試す。成功後の画面遷移は一回だけで、失敗後にはボタンが再び使えることを確認する。`StatefulWidget` ではなく状態管理器を使うなら `mounted` を対応する生存期間検査に置き換える。重要なのは、結果が現在の値と現在の要求に属することだ。
