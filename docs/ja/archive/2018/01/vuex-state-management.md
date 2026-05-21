---
title: "Vuex 状態管理パターン実践：いつ使うか、どう整理するか"
date: 2018-01-18 16:46:58
tags:
  - Vue
readingTime: 2
description: "Vuex は Vue の公式状態管理ライブラリですが、多くの初心者は至る所で使うか、まったく使わないかのどちらかです。重要なのはいつ Vuex が適切なツールかを知ることです。"
wordCount: 398
---

Vuex は Vue の公式状態管理ライブラリですが、多くの初心者は至る所で使うか、まったく使わないかのどちらかです。重要なのはいつ Vuex が適切なツールかを知ることです。

## Vuex を使う場面

古典的なシグナル：「複数のコンポーネントが状態を共有する必要がある場合」。

**Vuex を使わない場合：**

- 単一コンポーネントにローカルな状態（フォーム入力、トグル）
- 親子間で共有される状態（props/イベントを使用）
- シンプルな兄弟間通信（EventBus や状態の引き上げを検討）

**Vuex を使う場合：**

- 無関係な複数のコンポーネントが同じデータを必要とする（ユーザー情報、カートアイテム）
- ルートナビゲーション間で状態を持続させる必要がある
- props/イベントでは複雑な状態遷移を把握しにくい

## 基本的なストア構造

```javascript
// store/index.js
import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    user: null,
    cartItems: [],
    notifications: [],
  },

  getters: {
    isLoggedIn: (state) => !!state.user,
    cartTotal: (state) =>
      state.cartItems.reduce((sum, item) => sum + item.price, 0),
    unreadCount: (state) => state.notifications.filter((n) => !n.read).length,
  },

  mutations: {
    // ミューテーションは同期的でなければならない
    SET_USER(state, user) {
      state.user = user;
    },
    ADD_TO_CART(state, item) {
      state.cartItems.push(item);
    },
  },

  actions: {
    // アクションは非同期にできる
    async login({ commit }, credentials) {
      const user = await authAPI.login(credentials);
      commit("SET_USER", user);
    },
  },
});
```

## 名前空間付きモジュール

大規模アプリケーションでは、ストアをモジュールに分割します：

```javascript
// store/modules/user.js
export default {
  namespaced: true,
  state: () => ({ profile: null, token: "" }),
  getters: {
    isAdmin: (state) => state.profile?.role === "admin",
  },
  mutations: {
    SET_PROFILE(state, profile) {
      state.profile = profile;
    },
  },
  actions: {
    async fetchProfile({ commit }) {
      const profile = await userAPI.getProfile();
      commit("SET_PROFILE", profile);
    },
  },
};
```

名前空間付き状態へのアクセス：

```javascript
this.$store.state.user.profile;
this.$store.getters["user/isAdmin"];
this.$store.dispatch("user/fetchProfile");
```

## ヘルパー関数

```javascript
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";

export default {
  computed: {
    ...mapState("user", ["profile"]),
    ...mapGetters("user", ["isAdmin"]),
  },
  methods: {
    ...mapActions("user", ["fetchProfile"]),
    ...mapMutations("cart", ["ADD_TO_CART"]),
  },
};
```

## アクション設計の原則

アクションには API 呼び出しだけでなく、ビジネスロジックを含めるべきです：

```javascript
actions: {
  async addToCart({ state, commit, dispatch }, product) {
    // ユーザーがログインしているか確認
    if (!state.user) {
      dispatch('openLoginModal')
      return
    }
    // 在庫確認
    const inStock = await productAPI.checkStock(product.id)
    if (!inStock) {
      dispatch('showToast', { message: '在庫切れです', type: 'error' })
      return
    }
    // カートに追加
    commit('ADD_TO_CART', product)
    dispatch('showToast', { message: 'カートに追加しました', type: 'success' })
  },
}
```
