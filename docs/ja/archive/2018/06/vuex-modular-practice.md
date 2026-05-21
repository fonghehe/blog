---
title: "Vuexモジュール化実践：大規模プロジェクトの状態管理"
date: 2018-06-19 14:45:49
tags:
  - Vue
readingTime: 2
description: "Vuexは入門しやすいですが、プロジェクトが大きくなるとstoreをどう整理するかが課題になります。この記事では大規模プロジェクトのVuexモジュール化方法を共有します。"
wordCount: 358
---

Vuexは入門しやすいですが、プロジェクトが大きくなるとstoreをどう整理するかが課題になります。この記事では大規模プロジェクトのVuexモジュール化方法を共有します。

## 基本的なモジュール構成

```
store/
├── index.js           ルートstore
└── modules/
    ├── user.js        ユーザーモジュール
    ├── permission.js  権限モジュール
    ├── app.js         アプリ状態（サイドバー、テーマなど）
    ├── order.js       注文モジュール
    └── product.js     商品モジュール
```

## モジュールの定義

```javascript
// store/modules/user.js
const state = {
  token: localStorage.getItem("token") || "",
  userInfo: null,
  avatar: "",
};

const getters = {
  isLoggedIn: (state) => !!state.token,
  username: (state) => state.userInfo?.name || "未ログイン",
  userId: (state) => state.userInfo?.id,
};

const mutations = {
  SET_TOKEN(state, token) {
    state.token = token;
    localStorage.setItem("token", token);
  },
  SET_USER_INFO(state, info) {
    state.userInfo = info;
    state.avatar = info.avatar;
  },
  CLEAR_USER(state) {
    state.token = "";
    state.userInfo = null;
    localStorage.removeItem("token");
  },
};

const actions = {
  async login({ commit }, credentials) {
    const { token, user } = await authAPI.login(credentials);
    commit("SET_TOKEN", token);
    commit("SET_USER_INFO", user);
    return user;
  },

  async fetchProfile({ commit, state }) {
    if (!state.token) return;
    const user = await userAPI.getProfile();
    commit("SET_USER_INFO", user);
    return user;
  },

  logout({ commit }) {
    commit("CLEAR_USER");
    router.push("/login");
  },
};

export default {
  namespaced: true, // 命名衝突を避けるために必須
  state,
  getters,
  mutations,
  actions,
};
```

## ルートstore

```javascript
// store/index.js
import Vue from "vue";
import Vuex from "vuex";
import user from "./modules/user";
import permission from "./modules/permission";
import app from "./modules/app";

Vue.use(Vuex);

export default new Vuex.Store({
  // グローバルstate（できるだけ少なく）
  state: {},

  modules: {
    user,
    permission,
    app,
  },

  // strictモード：stateの直接変更を防ぐ（本番環境では使わない、パフォーマンスに影響）
  strict: process.env.NODE_ENV !== "production",
});
```

## 名前空間の使い方

`namespaced: true`を有効にすると、アクセス方法が変わります：

```javascript
// 名前空間なし
store.getters.isLoggedIn;
store.commit("SET_TOKEN", token);
store.dispatch("login", credentials);

// 名前空間ありのuserモジュール
store.getters["user/isLoggedIn"];
store.commit("user/SET_TOKEN", token);
store.dispatch("user/login", credentials);
```

### コンポーネントでmapXxxを使う

```javascript
import { mapGetters, mapActions } from "vuex";

export default {
  computed: {
    ...mapGetters("user", ["isLoggedIn", "username", "userId"]),
    // 以下と同等：
    // isLoggedIn() { return this.$store.getters['user/isLoggedIn'] }
  },
  methods: {
    ...mapActions("user", ["login", "logout", "fetchProfile"]),
  },
};
```

## モジュール間のアクセス

```javascript
// actionで他のモジュールにアクセス
const actions = {
  async someAction({ dispatch, rootState, rootGetters }) {
    // rootState：store全体のstate
    const token = rootState.user.token;

    // rootGetters：すべてのgetter
    const isAdmin = rootGetters["permission/isAdmin"];

    // 他のモジュールのactionを呼ぶ（root: trueが必要）
    await dispatch("user/fetchProfile", null, { root: true });
  },
};
```

## 動的モジュール登録

特定のシナリオでのみ必要なモジュールは動的に登録できます：

```javascript
// ルート遷移時にモジュールを登録
router.beforeEach(async (to, from, next) => {
  if (to.path.startsWith("/orders")) {
    if (!store.hasModule("order")) {
      const orderModule = await import("./store/modules/order");
      store.registerModule("order", orderModule.default);
    }
  }
  next();
});
```

## 永続化（vuex-persistedstate）

ページを更新するとVuex stateはリセットされます。一部の状態は永続化が必要です：

```bash
npm install vuex-persistedstate
```

```javascript
import createPersistedState from "vuex-persistedstate";

export default new Vuex.Store({
  plugins: [
    createPersistedState({
      key: "myapp-state",
      paths: ["user.token", "app.theme", "app.locale"], // これらのみ永続化
      storage: localStorage, // またはsessionStorage
    }),
  ],
});
```

## よくあるアンチパターン

**mutationで非同期処理をしない：**

```javascript
// ❌ 誤り
mutations: {
  async FETCH_USER(state) {
    state.user = await api.getUser()  // mutationは非同期にできない！
  }
}

// ✅ 正しい：非同期ロジックはactionに置く
actions: {
  async fetchUser({ commit }) {
    const user = await api.getUser()
    commit('SET_USER', user)  // mutationは同期的にstateを変更するのみ
  }
}
```

**コンポーネントでstateを直接変更しない：**

```javascript
// ❌ Vuexの追跡メカニズムを回避してしまう
this.$store.state.user.name = "Alice";

// ✅ mutationを通じて変更
this.$store.commit("user/SET_NAME", "Alice");
```

## まとめ

- 大規模プロジェクトはビジネスモジュールごとにstoreを分割し、`namespaced`を有効にする
- mutationは同期的な状態変更のみ。非同期ロジックはactionに置く
- 永続化は適切に使い、すべてのstateを永続化しない
- `rootState`と`rootGetters`でモジュール間アクセスを実現する
