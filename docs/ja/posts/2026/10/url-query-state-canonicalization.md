---
title: "URL に検索条件を載せる：共有できる画面の正規化契約"
date: 2026-10-29 11:01:42
tags:
  - JavaScript
  - エンジニアリング
description: "解析、履歴、問い合わせの識別をそろえ、リンクと画面の意味を一致させる。"
readingTime: 4
wordCount: 1181
---

一覧のリンクを送っても相手には初期条件が表示される。パラメーターを足すと、今度は戻る操作が一文字ずつ入力をたどり、再読み込みでは二度通信する。URL は状態の保存先だけでなく、外部入力、共有形式、ブラウザー履歴でもある。

例はキーワード、状態、ページの三項目だけを所有する。解析用パラメーターなども共有する実システムでは、未知項目を捨てる前に所有範囲を決める。

## 境界で検証し、内部表現を一つにする

URL は手入力や旧版からも届く。負数、巨大値、重複したページ、未知の状態を想定する。例では状態を許可集合に限定して重複を除き、ソートする。単値項目は最初を採用し、ページは 1 から 9999 に制限する。

キーワードの 100 は UTF-16 単位の明示的な上限であり、見える文字数ではない。書記素単位が必要なら共通の分割規則へ替える。符号化と重複パラメーターは [WHATWG URL 標準](https://url.spec.whatwg.org/)を参照する。

```javascript
export function parseFilters(search) {
  const params = new URLSearchParams(search);
  const allowed = new Set(['open', 'closed']);
  const status = [...new Set(params.getAll('status')
    .filter(value => allowed.has(value)))].sort();
  const rawPage = params.get('page') ?? '1';
  const page = /^\d{1,4}$/.test(rawPage) && Number(rawPage) >= 1
    ? Number(rawPage) : 1;
  return { q: (params.get('q') ?? '').trim().slice(0, 100), status, page };
}

export function serializeFilters(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const status of filters.status) params.append('status', status);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}

export function canonicalSearch(search) {
  return serializeFilters(parseFilters(search));
}
```

シリアライザーには正規化済みのモデルを渡し、外部オブジェクトを直接入れない。既定のページを省略し状態の順序を固定すると、等価な URL が同じ形になる。正規化の冪等性と、解析・出力後の意味の保持を検証する。

## 入力途中を毎回履歴にしない

入力中のキーワードは下書きとして保持し、確定や決めた待機境界で URL に反映する。意味のある移動は push、無効値の清掃や同一操作の中間状態は replace と使い分ける。各キー入力を戻る対象にする必要はない。

ルーターが履歴を管理するなら、その API を使う。戻る・進むでは URL を解析して確定済みの値を復元する。新しい条件でページを戻すことと、過去のページを履歴から復元することは異なる。「変化したら常に一ページ目」の効果でまとめない。

## 通信とキャッシュも同じモデルから作る

表示、問い合わせ、キャッシュの識別を一つの確定モデルから導く。状態パラメーターの順序が違っても同じ検索になる。遅い応答を反映する前にも識別を確認し、新しい検索を上書きさせない。

操作が URL を書き、URL が入力を更新し、入力がまた URL を書く循環を避ける。下書きから操作、操作から移動、解析からモデル、モデルから表示と通信、という経路を決める。正規形と違うときだけ修正し、それだけで同じ検索を二回読み込まない。

## 共有には機密性と寿命がある

クエリーは履歴、ログ、コピー、参照情報に残り得る。トークンや個人の機密検索を直接入れない。複雑な共有ビューはサーバーの記録と短い ID にしてもよいが、ID の所持を閲覧権限と同一視しない。

項目や列挙値を変えるときは旧リンクの移行方針を決める。省略した既定値の変更でも意味が変わる。厳密な再現が必要なら版や重要な既定値を明記し、「開ける」だけで互換性を判断しない。

## 外から開く経路と履歴復元を試す

空、重複、無効なページ、未知状態、中国語、プラス、順序違い、旧版を試す。その上で直接表示、再読込、戻る・進む、連続検索を行い、操作欄、URL、通信条件が一致し、正規化だけで通信が重複しないことを確かめる。

共有の価値は同じ状況を別の人が見られることだ。小さな通信契約として扱えば、条件が増えてもその意味を維持できる。
