---
title: "JavaScript正規表現の実践"
date: 2018-06-16 10:11:40
tags:
  - JavaScript
readingTime: 1
description: "正規表現はいつも「忘れてしまう」知識です。よく使うパターンと実際のユースケースをまとめました。"
---

正規表現はいつも「忘れてしまう」知識です。よく使うパターンと実際のユースケースをまとめました。

## 基本構文

```javascript
// 2つの作成方法
const re1 = /pattern/flags    // リテラル（推奨）
const re2 = new RegExp('pattern', 'flags')  // 動的に作成するときに使う

// よく使うフラグ
// i：大文字小文字を無視
// g：グローバルマッチ（gがないと最初の1つだけ見つかる）
// m：マルチラインモード（^ $が各行の先頭・末尾にマッチ）
// s：.が改行にもマッチ（ES2018）
```

## よく使う文字クラス

```javascript
// メタ文字
\d  // 数字 [0-9]
\w  // 英数字+アンダースコア [a-zA-Z0-9_]
\s  // 空白文字（スペース、タブ、改行）
\b  // 単語境界
.   // 任意の文字（改行を除く；sフラグで改行も含む）

// 量指定子
*   // 0個以上
+   // 1個以上
?   // 0個または1個
{n} // ちょうどn個
{n,m} // nからm個
{n,}  // n個以上

// 非貪欲（?を追加して最短マッチに）
.*?  // できるだけ少なくマッチ
```

## よく使うメソッド

```javascript
const str = 'Hello World 2018'

// test：マッチするか確認し、真偽値を返す
/\d+/.test(str)          // true

// match：マッチした結果を抽出
str.match(/\d+/)         // ['2018']
str.match(/[A-Z]/g)      // ['H', 'W']

// replace：置換
str.replace(/\d+/, '2019')    // 'Hello World 2019'
str.replace(/[a-z]/g, '*')    // 'H**** W**** ****'

// 関数で置換（強力）
'hello_world'.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
// 'helloWorld'（アンダースコアをキャメルケースに変換）

// split：分割
'a, b , c'.split(/\s*,\s*/)   // ['a', 'b', 'c']

// matchAll（ES2020；現在はループで代替）
const re = /(\d+)-(\d+)/g
let m
while ((m = re.exec(str)) !== null) {
  console.log(m[1], m[2])
}
```

## 実際のユースケース

```javascript
// 中国の携帯番号を検証
const isMobile = /^1[3-9]\d{9}$/.test(phone);

// メールアドレスを検証（シンプル版、厳しすぎるパターンは使わない）
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// URLパラメーターを抽出
function getQueryParam(name) {
  const re = new RegExp(`[?&]${name}=([^&]*)`);
  const match = location.search.match(re);
  return match ? decodeURIComponent(match[1]) : null;
}

// 電話番号をマスク：138****8888
phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");

// 数字を3桁区切りに：1234567 → 1,234,567
String(num).replace(/\B(?=(\d{3})+$)/g, ",");

// キャメルケースをケバブケースに：camelCase → camel-case
str.replace(/([A-Z])/g, "-$1").toLowerCase();

// HTMLタグを除去
html.replace(/<[^>]+>/g, "");
```

## 名前付きキャプチャグループ（ES2018）

```javascript
// 日付文字列を解析
const dateRe = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const {
  groups: { year, month, day },
} = "2018-06-16".match(dateRe);

// 置換で名前付きグループを使用
"2018-06-16".replace(
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
  "$<day>/$<month>/$<year>",
);
// '16/06/2018'
```

## まとめ

- `test()`はマッチ確認、`match()`は抽出、`replace()`は置換
- グローバルマッチには`g`フラグを追加する
- 名前付きキャプチャグループ`(?<name>...)`でコードが読みやすくなる
- オンラインツールregex101.comで正規表現のデバッグが便利
