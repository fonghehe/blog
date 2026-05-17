---
title: "Vueの深い監視と配列の監視"
date: 2018-05-01 09:32:57
tags:
  - Vue
readingTime: 2
description: "Vueのリアクティブシステムはオブジェクトのプロパティと配列にいくつかの特別な制限があります。これらを理解することで`watch`を正しく使えるようになります。"
---

Vueのリアクティブシステムはオブジェクトのプロパティと配列にいくつかの特別な制限があります。これらを理解することで`watch`を正しく使えるようになります。

## オブジェクトの監視：deepオプション

```javascript
export default {
  data() {
    return {
      form: {
        name: "",
        age: 0,
        address: {
          city: "",
          street: "",
        },
      },
    };
  },
  watch: {
    // デフォルト：formの参照が変わった時のみ発火（新しいオブジェクトが代入された場合）
    form(newVal, oldVal) {
      // form.nameが変わっても発火しない
    },

    // deep: true：ネストされた全プロパティの変化を監視
    form: {
      handler(newVal) {
        console.log("フォームが変わった", newVal);
      },
      deep: true,
    },
  },
};
```

**deepのコスト**：オブジェクトの全プロパティをトラバースするため、大きなオブジェクトではパフォーマンス負荷が大きいです。特定のプロパティだけ気にする場合は、そのパスを直接監視します：

```javascript
watch: {
  // ネストされたプロパティを監視（文字列パスを使用）
  'form.address.city'(newVal) {
    console.log('都市が変わった', newVal)
  }
}
```

## Vue 2の配列の制限

Vue 2は以下の配列の変化を検出できません：

```javascript
// ❌ Vueが検出できない
this.list[0] = "new value"; // インデックスで直接代入
this.list.length = 0; // lengthを直接変更

// ✅ 正しい方法
this.$set(this.list, 0, "new value"); // または：
Vue.set(this.list, 0, "new value");

this.list.splice(0, this.list.length); // 配列を空にする
```

Vueはこれらの配列メソッドをラップしています。これらを使うとビューの更新が発火します：

```javascript
// Vueがラップしているメソッドはビューのアップデートをトリガーする
this.list.push(item);
this.list.pop();
this.list.shift();
this.list.unshift(item);
this.list.splice(index, 1);
this.list.sort();
this.list.reverse();

// これらはアップデートをトリガーしない（新しい配列を返す）→ 代入が必要
this.list = this.list.filter((x) => x > 1);
this.list = this.list.map((x) => x * 2);
this.list = this.list.concat([4, 5]);
```

## 配列の監視

```javascript
watch: {
  // 配列を監視 — 直接書く（deepは不要；push/popなどは検出される）
  list(newVal) {
    console.log('listが変わった', newVal)
  },

  // 配列内の各オブジェクトのプロパティ変化も監視するには、deepが必要
  userList: {
    handler(newVal) {
      console.log('ユーザーのプロパティが変化した')
    },
    deep: true
  }
}
```

## immediate：初期化時に即時実行

```javascript
watch: {
  userId: {
    handler(id) {
      this.loadUserData(id)
    },
    immediate: true  // コンポーネント作成時にすぐ実行。変化を待たない
  }
}
```

以下と同等です：

```javascript
created() {
  this.loadUserData(this.userId)
},
watch: {
  userId(id) {
    this.loadUserData(id)
  }
}
```

`immediate: true`の方がシンプルです。

## まとめ

- オブジェクトのプロパティ変化を監視：`deep: true`、ただしパフォーマンスコストあり
- 特定のネストされたプロパティを監視：文字列パスを直接使用 — `deep`より効率的
- Vue 2の配列制限：インデックス代入と`length`変更は検出不可。`$set`または配列メソッドを使用
- `immediate: true`：初期化時に実行 — 重複したコードを避けられる
