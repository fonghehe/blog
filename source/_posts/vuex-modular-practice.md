---
title: "Vuex 模块化实践：大型项目状态管理"
date: 2018-06-19 14:45:49
tags:
  - Vue
---

Vuex 入门容易，但项目规模大了之后，如何组织 store 是个挑战。这篇文章分享大型项目的 Vuex 模块化方案。

## 基础模块结构

```
store/
├── index.js           根 store
└── modules/
    ├── user.js        用户模块
    ├── permission.js  权限模块
    ├── app.js         应用状态（侧边栏、主题等）
    ├── order.js       订单模块
    └── product.js     产品模块
```

## 模块定义

```javascript
// store/modules/user.js
const state = {
  token: localStorage.getItem("token") || "",
  userInfo: null,
  avatar: "",
};

const getters = {
  isLoggedIn: (state) => !!state.token,
  username: (state) => state.userInfo?.name || "未登录",
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
  namespaced: true, // 必须开启，避免命名冲突
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
  // 全局 state（尽量少放）
  state: {},

  modules: {
    user,
    permission,
    app,
  },

  // 严格模式：防止直接修改 state（生产环境不要开，有性能影响）
  strict: process.env.NODE_ENV !== "production",
});
```

## 命名空间的使用

开启 `namespaced: true` 后，访问方式变化：

```javascript
// 不开命名空间
store.getters.isLoggedIn;
store.commit("SET_TOKEN", token);
store.dispatch("login", credentials);

// 开启命名空间 user 模块
store.getters["user/isLoggedIn"];
store.commit("user/SET_TOKEN", token);
store.dispatch("user/login", credentials);
```

### 在组件里使用 mapXxx

```javascript
import { mapGetters, mapActions } from "vuex";

export default {
  computed: {
    ...mapGetters("user", ["isLoggedIn", "username", "userId"]),
    // 等价于
    // isLoggedIn() { return this.$store.getters['user/isLoggedIn'] }
  },
  methods: {
    ...mapActions("user", ["login", "logout", "fetchProfile"]),
  },
};
```

## 跨模块访问

```javascript
// 在 action 里访问其他模块
const actions = {
  async someAction({ dispatch, rootState, rootGetters }) {
    // rootState：整个 store 的 state
    const token = rootState.user.token;

    // rootGetters：所有 getter
    const isAdmin = rootGetters["permission/isAdmin"];

    // 调用其他模块的 action（需要加 root: true）
    await dispatch("user/fetchProfile", null, { root: true });
  },
};
```

## 动态注册模块

某些模块只在特定场景需要，可以动态注册：

```javascript
// 路由跳转时注册模块
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

刷新页面后 Vuex state 重置，某些状态需要持久化：

```bash
npm install vuex-persistedstate
```

```javascript
import createPersistedState from "vuex-persistedstate";

export default new Vuex.Store({
  plugins: [
    createPersistedState({
      key: "myapp-state",
      paths: ["user.token", "app.theme", "app.locale"], // 只持久化这些
      storage: localStorage, // 或 sessionStorage
    }),
  ],
});
```

## 常见反模式

**不要在 mutation 里做异步操作：**

```javascript
// ❌ 错误
mutations: {
  async FETCH_USER(state) {
    state.user = await api.getUser()  // mutation 不能异步！
  }
}

// ✅ 正确：异步逻辑放 action
actions: {
  async fetchUser({ commit }) {
    const user = await api.getUser()
    commit('SET_USER', user)  // mutation 只同步修改 state
  }
}
```

**不要在组件里直接修改 state：**

```javascript
// ❌ 绕过了 Vuex 的追踪机制
this.$store.state.user.name = "Alice";

// ✅ 通过 mutation
this.$store.commit("user/SET_NAME", "Alice");
```

## 小结

- 大型项目按业务模块拆分 store，开启 `namespaced`
- mutations 只做同步状态修改，异步逻辑放 actions
- 合理使用持久化，不要把所有 state 都持久化
- `rootState` 和 `rootGetters` 实现跨模块访问
