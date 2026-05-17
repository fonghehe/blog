---
title: "ES6 分割代入の実践"
date: 2018-03-15 14:48:15
tags:
  - ES6
readingTime: 1
description: "分割代入は私が最もよく使う ES6 の機能の一つで、繰り返しコードを大幅に削減できます。様々な使い方をまとめます。"
---

分割代入は私が最もよく使う ES6 の機能の一つで、繰り返しコードを大幅に削減できます。様々な使い方をまとめます。

## 配列の分割代入

```javascript
// 基本的な使い方
const [a, b, c] = [1, 2, 3];
console.log(a, b, c); // 1 2 3

// 要素のスキップ
const [, second, , fourth] = [1, 2, 3, 4];
console.log(second, fourth); // 2 4

// 残余要素
const [first, ...rest] = [1, 2, 3, 4];
console.log(first); // 1
console.log(rest); // [2, 3, 4]

// デフォルト値
const [x = 10, y = 20] = [1];
console.log(x, y); // 1 20

// 変数の交換（一時変数不要）
let m = 1,
  n = 2;
[m, n] = [n, m];
console.log(m, n); // 2 1
```

## オブジェクトの分割代入

```javascript
const user = { name: "山田太郎", age: 25, city: "東京" };

// 基本的な使い方
const { name, age } = user;
console.log(name, age); // '山田太郎' 25

// 名前の変更
const { name: userName, age: userAge } = user;
console.log(userName); // '山田太郎'

// デフォルト値
const { role = "user", name: uname } = user;
console.log(role); // 'user'（user オブジェクトに role がないのでデフォルト値を使用）

// ネストされた分割代入
const response = {
  code: 200,
  data: {
    list: [1, 2, 3],
    total: 100,
  },
};
const {
  data: { list, total },
} = response;
console.log(list, total); // [1, 2, 3] 100
```

## 関数パラメータの分割代入

```javascript
// 分割代入なし
function renderUser(user) {
  return `${user.name}、${user.age}歳`;
}

// 分割代入あり（より明確）
function renderUser({ name, age }) {
  return `${name}、${age}歳`;
}

// デフォルト値付き
function createUser({ name, age = 18, role = "user" } = {}) {
  return { name, age, role };
}
createUser({ name: "山田太郎" });
// { name: '山田太郎', age: 18, role: 'user' }
```

## 実際のプロジェクトでのシナリオ

```javascript
// API レスポンスの分割代入
async function fetchUser(id) {
  const {
    data: { name, email, avatar },
    status,
  } = await api.get(`/users/${id}`);
  return { name, email, avatar, status };
}

// Vue コンポーネント内
export default {
  methods: {
    async loadData() {
      const { data: list, total, page } = await this.$api.getList(this.params);
      this.list = list;
      this.total = total;
      this.page = page;
    },
  },
};

// import 時の分割代入（最もよく使うシナリオ）
import { ref, computed, watch, onMounted } from "vue";
import { mapState, mapActions } from "vuex";
```

## まとめ

- 配列の分割代入：位置で抽出、`...rest` で残りの要素を収集
- オブジェクトの分割代入：プロパティ名で抽出、名前変更とデフォルト値をサポート
- 関数パラメータの分割代入：パラメータの意図を明確にし、デフォルト値をサポート
