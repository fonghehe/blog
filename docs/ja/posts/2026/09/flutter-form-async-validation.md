---
title: "Flutter フォームの非同期検証：古い結果で新しい入力を上書きしない"
date: 2026-09-18 10:25:57
tags:
  - モバイル
description: "入力の世代管理、防振、送信の重複防止、サーバーエラーの反映を扱う。"
readingTime: 1
wordCount: 353
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
