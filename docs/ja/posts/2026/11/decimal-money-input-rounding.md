---
title: "金額入力と丸めの契約：小数二桁の表示だけでは正しさは分からない"
date: 2026-11-12 15:33:05
tags:
  - JavaScript
  - エンジニアリング
description: "十進文字列、最小単位整数、端数配分を分けて、合計の不変条件を守る。"
readingTime: 4
wordCount: 1091
---

画面で 0.10 と 0.20 の合計が 0.30 に見えても、金額モデルの証明にはならない。toFixed は表示であり、中間計算、負の返金、行ごとの配分を定義しない。二桁にするという説明だけでは、前後のシステムで方向や段階が異なり得る。

ここではソフトウェア上の表現と検証を扱い、会計や税の規則は提案しない。例は二桁と明示した業務通貨だけが対象で、ほかの通貨や高精度資産には別の桁数契約が必要だ。

## 下書き、業務値、表示を分ける

入力途中の負号や 1. は自然な状態だ。原文の下書きを保ち、送信時に厳密に解析する。表示の通貨記号や桁区切りを計算へ戻さない。

JavaScript Number は二進浮動小数点であり、[ECMAScript Number](https://tc39.es/ecma262/#sec-number-objects)を参照できる。十進ライブラリーや最小単位整数を選び、範囲、桁数、乗除規則を決める。Number にして百倍する方法は先に二進へ変換するので、汎用の十進解析ではない。

## 文字列から最小単位へ直接変換する

例は長さを制限し、区切りや指数なし、小数二桁までを受け付け、直接 BigInt のセントを作る。.5、1.、過剰桁、先頭ゼロは拒否する。許すかどうかは製品の選択だが、クライアントとサーバーで統一する。

```javascript
export function parseCents(text) {
  if (typeof text !== 'string' || text.length > 128) {
    throw new TypeError('bounded decimal text required');
  }
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('invalid two-decimal amount');
  const magnitude = BigInt(match[2]) * 100n +
    BigInt((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -magnitude : magnitude;
}

export function roundRatioHalfAway(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError('positive denominator required');
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

console.assert(parseCents('0.10') + parseCents('0.20') === 30n);
console.assert(roundRatioHalfAway(-5n, 2n) === -3n);
```

BigInt でも無制限入力を許す理由にはならない。JSON へ直接は出せないため、十進整数文字列と単位・通貨を送れる。サーバーも独立して範囲を確認する。

## 丸めの方向と時点を指定する

例は中点でゼロから離れる方向なので -2.5 は -3 になる。これは選んだ算法で、業務全体の正解ではない。偶数丸め、切り下げ、現金単位への丸めは別の結果になり得る。

行、分類小計、最終合計のどこで丸めるかも決める。各行で丸めた和と、合計後の丸めは違うことがある。率は有理数や十進型で表し、途中を表示文字列へ変えて再解析しない。

## 配分後も合計を保持する

100 セントを三つへ 33 ずつでは 99 になる。まず 33 を割り当て、残り一つを安定した順で配れば 34、33、33 になる。不均等配分では余りの順序と同点の規則も必要だ。画面順より安定 ID が再現しやすい。

返金では元の配分記録を参照し、現在の並びで再計算しない。並べ替えで返金先の一セントが変わるのを避ける。規則と最終配分を残して、明細と合計を説明できるようにする。

## 地域化は解析規則の代わりではない

[Intl.NumberFormat](https://tc39.es/ecma402/#numberformat-objects)は表示用で、汎用金額パーサーではない。カンマや空白の意味は地域による。すべてのカンマを削除せず、入力形式と地域を明示する。

大きな整数を表示のためだけに Number へ変換しない。安全な業務範囲か、精度を保つ表示経路を選ぶ。負のゼロも意味のある返金に見せず、例では BigInt によりゼロへ統一される。

## 一連の不変条件で検証する

最小単位、上限、指数、長すぎる入力、過剰小数、負の中点、配分合計を試す。単位と通貨を含めて通信の往復も確認し、共通資料で前後の結果を照合する。

許す入力、内部表現、丸める段階、余りの配分を契約にする。最後の書式で正常に見せるのでなく、規則から正しさを説明できるようにする。
