---
title: "Lodash よく使うメソッドまとめ"
date: 2018-09-28 15:30:34
tags:
  - JavaScript
readingTime: 2
description: "Lodash はフロントエンドプロジェクトで最もよく使われるユーティリティライブラリの一つですが、多くの人はごく一部しか使っていません。仕事で最も実用的なメソッドを整理します。"
wordCount: 235
---

Lodash はフロントエンドプロジェクトで最もよく使われるユーティリティライブラリの一つですが、多くの人はごく一部しか使っていません。仕事で最も実用的なメソッドを整理します。

## オブジェクト操作

```javascript
import _ from "lodash";

const user = {
  name: "山田太郎",
  address: {
    city: "東京",
    district: "渋谷",
  },
  roles: ["admin", "editor"],
};

// _.get：深いプロパティに安全にアクセス
_.get(user, "address.city"); // '東京'
_.get(user, "address.country"); // undefined（エラーなし）
_.get(user, "address.country", "日本"); // '日本'（デフォルト値）

// _.set：深いプロパティに安全に設定
const updated = _.set({ ...user }, "address.country", "日本");

// _.pick：指定したプロパティだけ取得
_.pick(user, ["name", "address"]); // { name: '山田太郎', address: {...} }

// _.omit：指定したプロパティを除外
_.omit(user, ["roles"]); // roles プロパティを除外

// _.cloneDeep：ディープコピー
const copy = _.cloneDeep(user);

// _.merge：ディープマージ（Object.assign はシャローマージ）
const defaults = { theme: "light", lang: "ja", pagination: { pageSize: 20 } };
const userConfig = { lang: "en", pagination: { page: 1 } };
_.merge({}, defaults, userConfig);
// { theme: 'light', lang: 'en', pagination: { pageSize: 20, page: 1 } }
```

## 配列操作

```javascript
const arr = [1, 2, 3, 2, 1];

_.uniq(arr); // [1, 2, 3]（重複排除）
_.uniqBy(users, "id"); // id で重複排除
_.chunk([1, 2, 3, 4, 5], 2); // [[1,2],[3,4],[5]]（グループ分け）
_.flatten([
  [1, 2],
  [3, [4]],
]); // [1,2,3,[4]]（1段階展開）
_.flattenDeep([[1, [2, [3]]]]); // [1,2,3]（完全展開）
_.sortBy(users, ["age", "name"]); // 複数フィールドでソート
_.groupBy(users, "city"); // 都市でグループ化
_.keyBy(users, "id"); // 配列を id をキーとするオブジェクトに変換

// 実際の活用：ユーザー配列を id → user のマップに変換
const userMap = _.keyBy(users, "id");
userMap["123"]; // id で直接検索
```

## 関数ツール

```javascript
// _.debounce：デバウンス（操作が止まってから n ミリ秒後に実行）
const handleSearch = _.debounce((keyword) => {
  fetchResults(keyword);
}, 300);

// _.throttle：スロットル（n ミリ秒に最大1回実行）
const handleScroll = _.throttle(() => {
  checkScrollPosition();
}, 100);

// _.memoize：関数の結果をキャッシュ
const expensiveCalc = _.memoize((n) => {
  // 複雑な計算
  return n * n;
});

// _.once：1回だけ実行
const init = _.once(() => {
  console.log("初期化は1回だけ");
});
init();
init(); // 実行されない
```

## 文字列操作

```javascript
_.camelCase("hello-world"); // 'helloWorld'
_.kebabCase("helloWorld"); // 'hello-world'
_.snakeCase("helloWorld"); // 'hello_world'
_.startCase("helloWorld"); // 'Hello World'
_.truncate("非常に長いテキスト", { length: 10 }); // '非常に長い...'
_.template("こんにちは、<%= name %>！")({ name: "太郎" }); // 'こんにちは、太郎！'
```

## オンデマンドインポート（バンドルサイズ削減）

```javascript
// 全量インポート：サイズが大きい
import _ from "lodash";

// オンデマンドインポート：使うものだけバンドル
import get from "lodash/get";
import debounce from "lodash/debounce";
import cloneDeep from "lodash/cloneDeep";

// または lodash-es（ES module 版、tree-shaking 対応）
import { get, debounce } from "lodash-es";
```

## まとめ

- `_.get/set`：深いプロパティへの安全なアクセス/変更。undefined を気にしなくていい
- `_.cloneDeep`：ディープコピー
- `_.merge`：ディープマージ。`Object.assign` より徹底的
- `_.groupBy/keyBy`：配列からオブジェクトへの変換。非常に実用的
- `_.debounce/throttle`：手書きより信頼性が高い
- 本番環境はオンデマンドインポートでバンドルサイズを削減
