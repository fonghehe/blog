---
title: "Vuex 模塊化實踐：大型項目狀態管理"
date: 2018-06-19 14:45:49
tags:
  - Vue
readingTime: 2
description: "Vuex 入門容易，但項目規模大了之後，如何組織 store 是個挑戰。這篇文章分享大型項目的 Vuex 模塊化方案。"
wordCount: 222
---

Vuex 入門容易，但項目規模大了之後，如何組織 store 是個挑戰。這篇文章分享大型項目的 Vuex 模塊化方案。

## 基礎模塊結構

```
store/
├── index.js           根 store
└── modules/
    ├── user.js        用户模塊
    ├── permission.js  權限模塊
    ├── app.js         應用狀態（側邊欄、主題等）
    ├── order.js       訂單模塊
    └── product.js     產品模塊
```

## 模塊定義

```javascript
// store/modules/user.js
const state = {
  token: localStorage.getItem("token") || "",
  userInfo: null,
  avatar: "",
};

const getters = {
  isLoggedIn: (state) => !!state.token,
  username: (state) => state.userInfo?.name || "未登錄",
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
  namespaced: true, // 必須開啓，避免命名衝突
  state,
  getters,
  mutations,
  actions,
};
```

## 根 store

```javascript
// store/index.js
import Vue from "vue";
import Vuex from "vuex";
import user from "./modules/user";
import permission from "./modules/permission";
import app from "./modules/app";

Vue.use(Vuex);

export default new Vuex.Store({
  // 全局 state（儘量少放）
  state: {},

  modules: {
    user,
    permission,
    app,
  },

  // 嚴格模式：防止直接修改 state（生產環境不要開，有性能影響）
  strict: process.env.NODE_ENV !== "production",
});
```

## 命名空間的使用

開啓 `namespaced: true` 後，訪問方式變化：

```javascript
// 不開命名空間
store.getters.isLoggedIn;
store.commit("SET_TOKEN", token);
store.dispatch("login", credentials);

// 開啓命名空間 user 模塊
store.getters["user/isLoggedIn"];
store.commit("user/SET_TOKEN", token);
store.dispatch("user/login", credentials);
```

### 在組件裏使用 mapXxx

```javascript
import { mapGetters, mapActions } from "vuex";

export default {
  computed: {
    ...mapGetters("user", ["isLoggedIn", "username", "userId"]),
    // 等價於
    // isLoggedIn() { return this.$store.getters['user/isLoggedIn'] }
  },
  methods: {
    ...mapActions("user", ["login", "logout", "fetchProfile"]),
  },
};
```

## 跨模塊訪問

```javascript
// 在 action 裏訪問其他模塊
const actions = {
  async someAction({ dispatch, rootState, rootGetters }) {
    // rootState：整個 store 的 state
    const token = rootState.user.token;

    // rootGetters：所有 getter
    const isAdmin = rootGetters["permission/isAdmin"];

    // 調用其他模塊的 action（需要加 root: true）
    await dispatch("user/fetchProfile", null, { root: true });
  },
};
```

## 動態註冊模塊

某些模塊只在特定場景需要，可以動態註冊：

```javascript
// 路由跳轉時註冊模塊
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

## 持久化（vuex-persistedstate）

刷新頁面後 Vuex state 重置，某些狀態需要持久化：

```bash
npm install vuex-persistedstate
```

```javascript
import createPersistedState from "vuex-persistedstate";

export default new Vuex.Store({
  plugins: [
    createPersistedState({
      key: "myapp-state",
      paths: ["user.token", "app.theme", "app.locale"], // 只持久化這些
      storage: localStorage, // 或 sessionStorage
    }),
  ],
});
```

## 常見反模式

**不要在 mutation 裏做異步操作：**

```javascript
// ❌ 錯誤
mutations: {
  async FETCH_USER(state) {
    state.user = await api.getUser()  // mutation 不能異步！
  }
}

// ✅ 正確：異步邏輯放 action
actions: {
  async fetchUser({ commit }) {
    const user = await api.getUser()
    commit('SET_USER', user)  // mutation 只同步修改 state
  }
}
```

**不要在組件裏直接修改 state：**

```javascript
// ❌ 繞過了 Vuex 的追蹤機制
this.$store.state.user.name = "Alice";

// ✅ 通過 mutation
this.$store.commit("user/SET_NAME", "Alice");
```

## 小結

- 大型項目按業務模塊拆分 store，開啓 `namespaced`
- mutations 只做同步狀態修改，異步邏輯放 actions
- 合理使用持久化，不要把所有 state 都持久化
- `rootState` 和 `rootGetters` 實現跨模塊訪問
