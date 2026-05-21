---
title: "Vue コンポーネント設計の原則"
date: 2018-09-03 14:47:08
tags:
  - Vue
readingTime: 2
description: "Vue を2年間書いてきて、最近コンポーネントの設計について振り返り始めました。コンポーネントをより保守しやすくするいくつかの原則をまとめます。"
wordCount: 379
---

Vue を2年間書いてきて、最近コンポーネントの設計について振り返り始めました。コンポーネントをより保守しやすくするいくつかの原則をまとめます。

## 単一責任の原則

各コンポーネントは1つのことだけを行います：

```javascript
// ❌ 1つのコンポーネントが多くのことをしすぎている
// UserPage.vue：ユーザー情報の表示 + 権限管理 + ページネーション + API 呼び出し
export default {
  data() {
    return { user: null, permissions: [], list: [], page: 1 };
  },
  created() {
    this.fetchUser();
    this.fetchPermissions();
    this.fetchList();
  },
  // 200行のコード...
};

// ✅ 関心を分離する
// UserProfile.vue：ユーザー情報の表示のみ
// PermissionPanel.vue：権限管理
// UserList.vue：リスト表示（ページネーション含む）
// UserPage.vue：上記のコンポーネントを組み合わせ、ページレベルのロジックを処理
```

## Props はできるだけ原子的に

```javascript
{% raw %}
// ❌ user オブジェクト全体を渡す。コンポーネントがオブジェクト構造に依存する
props: { user: Object }
// テンプレート内：{{ user.profile.avatar }}

// ✅ コンポーネントが本当に必要なデータだけを渡す
props: {
  name: String,
  avatarUrl: String,
  role: String
}
{% endraw %}
```

メリット：コンポーネントがテストしやすくなり、依存関係が明確になります。

## イベント名：動詞を使う

```javascript
// ❌ イベント名が曖昧
this.$emit("click");
this.$emit("change");
this.$emit("update");

// ✅ イベント名が何が起きたかを説明する
this.$emit("user:saved", savedUser);
this.$emit("filter:changed", newFilter);
this.$emit("item:deleted", itemId);
```

## Props を直接変更しない

```javascript
// ❌ props を変更する（Vue が警告を出す）
props: { value: String },
methods: {
  clear() { this.value = '' }  // これはできない！
}

// ✅ イベントを発火し、親コンポーネントに変更させる
props: { value: String },
methods: {
  clear() { this.$emit('update:value', '') }
}

// 親コンポーネント
<MyInput :value="text" @update:value="text = $event" />
// または .sync シンタックスシュガーを使う
<MyInput :value.sync="text" />
```

## 設定可能なデフォルト値

```javascript
props: {
  size: {
    type: String,
    default: 'medium',
    validator: (v) => ['small', 'medium', 'large'].includes(v)
  },
  loading: {
    type: Boolean,
    default: false
  }
}
```

## 制御と非制御

制御コンポーネント：データは親コンポーネントが管理（v-model / props を通じて）

```javascript
// 制御：親コンポーネントが値を管理
<SearchInput :value="searchText" @input="searchText = $event" />

// 非制御：内部で独自に状態を管理
// 必要な時だけイベントで結果を外部に伝える
<DatePicker @change="handleDateSelect" />
```

シーンに応じて選択します。すべての状態を親コンポーネントに引き上げる必要はありません。

## ドキュメント化

コメントだけでも、prop の用途を説明しましょう：

```javascript
props: {
  // リストデータ。形式：[{ id, name, status }]
  items: {
    type: Array,
    required: true
  },
  // 選択中のアイテムの id。.sync による双方向バインディングをサポート
  selectedId: {
    type: [Number, null],
    default: null
  }
}
```

## まとめ

- 単一責任：1つのコンポーネントは1つのことだけ。分割は美徳
- Props は原子的に：本当に必要なデータだけを渡す
- イベントで動作を記述し、props を直接変更しない
- コンポーネントには適切なデフォルト値とパラメーター検証を設ける
