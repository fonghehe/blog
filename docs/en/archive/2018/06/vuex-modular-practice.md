---
title: "Vuex Modular Practice: State Management in Large Projects"
date: 2018-06-19 14:45:49
tags:
  - Vue
readingTime: 2
description: "Vuex is easy to get started with, but organizing the store as the project scales becomes a real challenge. This article shares a modular Vuex approach for large"
wordCount: 131
---

Vuex is easy to get started with, but organizing the store as the project scales becomes a real challenge. This article shares a modular Vuex approach for large projects.

## Basic Module Structure

```
store/
├── index.js           root store
└── modules/
    ├── user.js        user module
    ├── permission.js  permission module
    ├── app.js         app state (sidebar, theme, etc.)
    ├── order.js       order module
    └── product.js     product module
```

## Module Definition

```javascript
// store/modules/user.js
const state = {
  token: localStorage.getItem("token") || "",
  userInfo: null,
  avatar: "",
};

const getters = {
  isLoggedIn: (state) => !!state.token,
  username: (state) => state.userInfo?.name || "Not logged in",
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
  namespaced: true, // required to avoid naming conflicts
  state,
  getters,
  mutations,
  actions,
};
```

## Root Store

```javascript
// store/index.js
import Vue from "vue";
import Vuex from "vuex";
import user from "./modules/user";
import permission from "./modules/permission";
import app from "./modules/app";

Vue.use(Vuex);

export default new Vuex.Store({
  // global state (keep minimal)
  state: {},

  modules: {
    user,
    permission,
    app,
  },

  // strict mode: prevents directly mutating state (don't use in production — has performance impact)
  strict: process.env.NODE_ENV !== "production",
});
```

## Using Namespaces

After enabling `namespaced: true`, access patterns change:

```javascript
// Without namespace
store.getters.isLoggedIn;
store.commit("SET_TOKEN", token);
store.dispatch("login", credentials);

// With namespaced user module
store.getters["user/isLoggedIn"];
store.commit("user/SET_TOKEN", token);
store.dispatch("user/login", credentials);
```

### Using mapXxx in Components

```javascript
import { mapGetters, mapActions } from "vuex";

export default {
  computed: {
    ...mapGetters("user", ["isLoggedIn", "username", "userId"]),
    // equivalent to:
    // isLoggedIn() { return this.$store.getters['user/isLoggedIn'] }
  },
  methods: {
    ...mapActions("user", ["login", "logout", "fetchProfile"]),
  },
};
```

## Cross-Module Access

```javascript
// Accessing other modules in an action
const actions = {
  async someAction({ dispatch, rootState, rootGetters }) {
    // rootState: the entire store's state
    const token = rootState.user.token;

    // rootGetters: all getters
    const isAdmin = rootGetters["permission/isAdmin"];

    // Call another module's action (requires root: true)
    await dispatch("user/fetchProfile", null, { root: true });
  },
};
```

## Dynamic Module Registration

Some modules are only needed in certain scenarios and can be registered dynamically:

```javascript
// Register module on route navigation
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

## Persistence (vuex-persistedstate)

Vuex state resets on page refresh; some state needs to be persisted:

```bash
npm install vuex-persistedstate
```

```javascript
import createPersistedState from "vuex-persistedstate";

export default new Vuex.Store({
  plugins: [
    createPersistedState({
      key: "myapp-state",
      paths: ["user.token", "app.theme", "app.locale"], // only persist these
      storage: localStorage, // or sessionStorage
    }),
  ],
});
```

## Common Anti-Patterns

**Don't do async operations in mutations:**

```javascript
// ❌ Wrong
mutations: {
  async FETCH_USER(state) {
    state.user = await api.getUser()  // mutations can't be async!
  }
}

// ✅ Correct: async logic goes in actions
actions: {
  async fetchUser({ commit }) {
    const user = await api.getUser()
    commit('SET_USER', user)  // mutations only synchronously modify state
  }
}
```

**Don't directly mutate state in components:**

```javascript
// ❌ Bypasses Vuex tracking
this.$store.state.user.name = "Alice";

// ✅ Via mutation
this.$store.commit("user/SET_NAME", "Alice");
```

## Summary

- Split large projects' store by business module; enable `namespaced`
- Mutations only do synchronous state changes; async logic goes in actions
- Use persistence judiciously — don't persist all state
- Use `rootState` and `rootGetters` for cross-module access
