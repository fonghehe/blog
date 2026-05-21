---
title: "ES2018の主な新機能まとめ"
date: 2018-06-02 16:13:59
tags:
  - フロントエンド
readingTime: 1
description: "ES2018が確定したので、最も実用的な新機能をまとめました。"
wordCount: 230
---

ES2018が確定したので、最も実用的な新機能をまとめました。

## Promise.finally

Promiseがresolveされてもrejectされてもどちらでも実行されます：

```javascript
fetch("/api/data")
  .then((res) => res.json())
  .catch((err) => console.error(err))
  .finally(() => {
    this.loading = false; // 成功・失敗にかかわらずローディングを閉じる
  });
```

`then`と`catch`それぞれに`loading = false`を書くよりもはるかにエレガントです。

## オブジェクトのrest/spread（ついに来た）

```javascript
// spread：コピーしてプロパティを上書き
const user = { name: "Alice", age: 25, role: "admin" };
const updated = { ...user, age: 26 };

// rest：残りのプロパティを抽出
const { role, ...userWithoutRole } = user;
// userWithoutRole = { name: 'Alice', age: 25 }
```

以前は配列のみ対応していましたが、オブジェクトのspreadはES2018でようやく正式標準になりました。

## 非同期イテレーション（for await...of）

```javascript
// 複数の非同期操作を順番に処理
async function processItems(ids) {
  for await (const item of fetchItems(ids)) {
    await saveItem(item);
  }
}

// カスタム非同期イテレーター
async function* generateSequence(start, end) {
  for (let i = start; i <= end; i++) {
    await delay(100);
    yield i;
  }
}

for await (const num of generateSequence(1, 5)) {
  console.log(num); // 1, 2, 3, 4, 5（100msごと）
}
```

## 正規表現の改善

```javascript
// 名前付きキャプチャグループ（非常に便利）
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
const match = '2018-06-02'.match(re)
const { year, month, day } = match.groups
// year='2018', month='06', day='02'

// sフラグ：.が改行にもマッチ
const html = '<div>\n  content\n</div>'
/<div>(.*)<\/div>/s.test(html)  // true（以前は[\s\S]が必要だった）

// 後行アサーション
/(?<=\$)\d+/.exec('$100')  // 100にマッチ（以前は先行アサーションのみ）
```

## まとめ

- `Promise.finally`でクリーンアップロジックがシンプルになる
- オブジェクトのspread/restが正式標準に
- `for await...of`で非同期シーケンスの処理が便利になった
- 名前付きキャプチャグループで正規表現の可読性が大幅向上
