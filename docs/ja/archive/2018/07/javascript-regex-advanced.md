---
title: "JavaScript正規表現の上級テクニック"
date: 2018-07-14 09:32:14
tags:
  - JavaScript
readingTime: 1
description: "基本的な正規表現は書けるようになりましたが、業務で複雑な要件に出会うとまだ戸惑います。上級テクニックをまとめます。"
---

基本的な正規表現は書けるようになりましたが、業務で複雑な要件に出会うとまだ戸惑います。上級テクニックをまとめます。

## よく使う特殊文字

```javascript
// 文字クラス
\d  数字 [0-9]
\w  単語文字 [A-Za-z0-9_]
\s  空白文字（スペース、タブ、改行）
\D  非数字、\W 非単語文字、\S 非空白

// 量指定子
?   0または1回
*   0回以上
+   1回以上
{n} ちょうどn回
{n,m} nからm回

// アンカー
^   文字列の先頭
$   文字列の末尾
\b  単語の境界
```

## キャプチャグループ

```javascript
// キャプチャグループ：マッチした部分を抽出
const date = "2018-07-14";
const match = date.match(/(\d{4})-(\d{2})-(\d{2})/);
// match[0]: '2018-07-14'（全体のマッチ）
// match[1]: '2018'（グループ1）
// match[2]: '07'（グループ2）
// match[3]: '14'（グループ3）

// 名前付きキャプチャグループ（ES2018）
const match2 = date.match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/);
console.log(match2.groups.year); // '2018'
console.log(match2.groups.month); // '07'
```

## 置換でのキャプチャグループの活用

```javascript
// 日付フォーマット変換：2018-07-14 → 07/14/2018
"2018-07-14".replace(/(\d{4})-(\d{2})-(\d{2})/, "$2/$3/$1");
// '07/14/2018'

// 電話番号のマスキング：138****5678
"13812345678".replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
// '138****5678'
```

## 非貪欲マッチ

```javascript
// 貪欲（デフォルト）：できるだけ多くマッチ
"<a>テキスト</a><b>太字</b>".match(/<.+>/);
// ['<a>テキスト</a><b>太字</b>']  全体がマッチされた

// 非貪欲（?を追加）：できるだけ少なくマッチ
"<a>テキスト</a><b>太字</b>".match(/<.+?>/);
// ['<a>']  最初のタグのみマッチ
```

## よく使う正規表現

```javascript
// メールアドレス
const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 電話番号（中国大陸）
const phoneReg = /^1[3-9]\d{9}$/;

// URL
const urlReg = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;

// 身分証（簡易版）
const idCardReg = /^\d{17}[\dX]$/;

// 使い方
function validateEmail(email) {
  return emailReg.test(email);
}
```

## よく使うメソッド

```javascript
const str = "hello world hello";
const reg = /hello/g;

// test：マッチするか確認
reg.test(str); // true

// match：マッチ配列を返す
str.match(/hello/g); // ['hello', 'hello']

// replace：置換
str.replace(/hello/g, "hi"); // 'hi world hi'

// split：分割
"a,b;c d".split(/[,; ]/); // ['a', 'b', 'c', 'd']

// matchAll（ES2020）：すべてのマッチの詳細情報を返す
const matches = [...str.matchAll(/hello/g)];
```

## まとめ

- 名前付きキャプチャグループ`(?<name>...)`でコードが読みやすくなる
- 非貪欲`+?` `*?`で貪欲マッチの問題を解決
- `g`フラグで全体マッチ、`i`で大文字小文字を無視、`m`で複数行
- 複雑な正規表現にはコメントを加えるか、テストツール（regex101.comなど）を使う
