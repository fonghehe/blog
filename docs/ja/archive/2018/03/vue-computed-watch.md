---
title: "Vue computed と watch の使い分け"
date: 2018-03-04 09:32:17
tags:
  - Vue
readingTime: 2
description: "`computed` と `watch` はどちらもデータの変化に反応しますが、適したシナリオが異なります。間違えて使っても エラーにはなりませんが、コードがぎこちなくなります。"
wordCount: 318
---

`computed` と `watch` はどちらもデータの変化に反応しますが、適したシナリオが異なります。間違えて使っても エラーにはなりませんが、コードがぎこちなくなります。

## computed：派生値

`computed` は既存のデータから新しい値を**計算する**ために使います。キャッシュされます。

```javascript
export default {
  data() {
    return {
      firstName: "山田",
      lastName: "太郎",
      cartItems: [
        { name: "商品A", price: 100, count: 2 },
        { name: "商品B", price: 50, count: 1 },
      ],
    };
  },
  computed: {
    // firstName または lastName が変わらない限り、キャッシュを返す
    fullName() {
      return this.lastName + " " + this.firstName;
    },

    // カート合計金額
    totalPrice() {
      return this.cartItems.reduce((sum, item) => {
        return sum + item.price * item.count;
      }, 0);
    },
  },
};
```

**キャッシュの意味：** `fullName` がテンプレートの複数箇所で使われる場合、通常の `methods` はレンダリングのたびに再実行されますが、`computed` は依存データが変わったときだけ再計算します。

## watch：変化を監視して副作用を実行

`watch` はデータの変化を**監視し**、何かをする（リクエスト送信、ログ出力、ローカルストレージへの書き込みなど）ために使います。

```javascript
export default {
  data() {
    return {
      searchKeyword: "",
      userId: null,
    };
  },
  watch: {
    // 検索ワード変化 → リクエスト送信
    searchKeyword(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.fetchSearchResults(newVal);
      }
    },

    // deep：オブジェクトの変化を深く監視
    // immediate：即座に一度実行（変化を待たずに）
    userId: {
      handler(newId) {
        if (newId) this.fetchUserInfo(newId);
      },
      immediate: true, // 初期化時にも一度実行
    },
  },
};
```

## 選択の基準

```
自問してみましょう：「値」が必要か、それとも「操作を実行」したいのか？

値が必要 → computed
  例：fullName、totalPrice、filteredList、isFormValid

操作を実行したい → watch
  例：ルート変化 → リクエスト、データ変化 → localStorage 更新、トップへスクロール
```

## よくある誤用

```javascript
// ❌ 間違い：watch で派生値を計算する
watch: {
  firstName() {
    this.fullName = this.firstName + this.lastName
  },
  lastName() {
    this.fullName = this.firstName + this.lastName
  }
}

// ✅ 正しい：これこそ computed の使いどころ
computed: {
  fullName() {
    return this.firstName + this.lastName
  }
}

// ❌ 間違い：computed で非同期操作
computed: {
  // computed は非同期をサポートしない — fullName が Promise になってしまう
  async fullName() {
    return await fetchName()
  }
}

// ✅ 正しい：非同期操作には watch を使う
watch: {
  userId: {
    async handler(id) {
      this.userInfo = await fetchUserInfo(id)
    },
    immediate: true
  }
}
```

## まとめ

- `computed`：派生値、キャッシュあり、同期のみ
- `watch`：変化を監視、副作用を実行、非同期対応
- 判断基準：「値」が必要なら computed、「何かをしたい」なら watch
