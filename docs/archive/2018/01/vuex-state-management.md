---
title: "Vuex 状态管理模式实践：何时用，如何组织"
date: 2018-01-18 16:46:58
tags:
  - Vue
readingTime: 3
description: "Vuex 是 Vue 生态里的状态管理方案，类似 Redux 之于 React。但 Vuex 的学习曲线比 Redux 平缓，因为它没有那么多样板代码。这篇文章结合实际项目，讲如何合理使用 Vuex。"
wordCount: 448
---

Vuex 是 Vue 生态里的状态管理方案，类似 Redux 之于 React。但 Vuex 的学习曲线比 Redux 平缓，因为它没有那么多样板代码。这篇文章结合实际项目，讲如何合理使用 Vuex。

## 什么时候应该引入 Vuex

这个问题比"如何使用 Vuex"更重要。Vuex 不是银弹，引入它有成本：

**不需要 Vuex 的场景：**

- 组件层级浅，父子通信够用
- 状态只在一个组件内使用
- 项目很小，维护成本低于收益

**应该引入 Vuex 的场景：**

- 多个无父子关系的组件需要共享状态
- 状态变化需要追踪（调试、回放）
- 服务端数据需要在多处使用，避免重复请求

Vuex 官方的建议是：如果你不确定是否需要，就暂时不用。

## 基础结构

```javascript
// store/index.js
import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    user: null,
    isLoading: false,
  },

  getters: {
    isLoggedIn: (state) => !!state.user,
    userDisplayName: (state) => (state.user ? state.user.name : "游客"),
  },

  mutations: {
    // 同步操作，直接修改 state
    SET_USER(state, user) {
      state.user = user;
    },
    SET_LOADING(state, status) {
      state.isLoading = status;
    },
  },

  actions: {
    // 异步操作，提交 mutation
    async fetchCurrentUser({ commit }) {
      commit("SET_LOADING", true);
      try {
        const user = await api.getCurrentUser();
        commit("SET_USER", user);
      } finally {
        commit("SET_LOADING", false);
      }
    },

    async logout({ commit }) {
      await api.logout();
      commit("SET_USER", null);
    },
  },
});
```

## 模块化：中大型项目的必选项

把所有状态塞进一个 store 对象会变得难以维护。Vuex 的模块化可以按功能拆分：

```
store/
├── index.js        # 根 store，组装所有模块
├── modules/
│   ├── user.js     # 用户相关
│   ├── cart.js     # 购物车
│   └── order.js    # 订单
```

```javascript
// store/modules/user.js
const state = {
  profile: null,
  permissions: [],
};

const getters = {
  hasPermission: (state) => (permission) => {
    return state.permissions.includes(permission);
  },
};

const mutations = {
  SET_PROFILE(state, profile) {
    state.profile = profile;
  },
};

const actions = {
  async fetchProfile({ commit }) {
    const profile = await api.getProfile();
    commit("SET_PROFILE", profile);
  },
};

export default {
  namespaced: true, // 重要：开启命名空间
  state,
  getters,
  mutations,
  actions,
};
```

```javascript
// store/index.js
import user from "./modules/user";
import cart from "./modules/cart";

export default new Vuex.Store({
  modules: { user, cart },
});
```

开启 `namespaced: true` 后，访问方式变为：

```javascript
// 在组件里
this.$store.state.user.profile;
this.$store.getters["user/hasPermission"]("edit");
this.$store.dispatch("user/fetchProfile");
this.$store.commit("user/SET_PROFILE", data);
```

## 在组件里使用：辅助函数

重复写 `this.$store.xxx` 很啰嗦，用辅助函数：

```javascript
import { mapState, mapGetters, mapActions, mapMutations } from "vuex";

export default {
  computed: {
    // 模块化后带命名空间
    ...mapState("user", ["profile"]),
    ...mapGetters("user", ["hasPermission"]),

    // 自定义名称
    ...mapState("cart", {
      cartItems: (state) => state.items,
      cartTotal: (state) => state.total,
    }),
  },

  methods: {
    ...mapActions("user", ["fetchProfile"]),
    ...mapMutations("cart", ["ADD_ITEM", "REMOVE_ITEM"]),
  },
};
```

## Action 的设计原则

Action 里不只是 API 调用，它负责**协调多个 mutation** 和处理**业务逻辑**：

```javascript
// actions/order.js
async createOrder({ commit, dispatch, state, rootState }) {
  // 1. 验证购物车不为空
  if (state.cart.items.length === 0) {
    throw new Error('购物车为空')
  }

  // 2. 锁定库存
  commit('SET_SUBMITTING', true)

  try {
    // 3. 调用接口
    const order = await api.createOrder({
      items: state.cart.items,
      userId: rootState.user.profile.id,
      address: state.selectedAddress
    })

    // 4. 清空购物车
    commit('cart/CLEAR_CART', null, { root: true })

    // 5. 刷新订单列表
    await dispatch('order/fetchOrders', null, { root: true })

    return order
  } finally {
    commit('SET_SUBMITTING', false)
  }
}
```

## 不要在 Getter 里处理异步

Getter 是同步的计算属性，不适合做异步操作：

```javascript
// 错误：getter 里不应该有异步
getters: {
  async userPosts(state) {  // 这不会按预期工作
    return await api.getUserPosts(state.user.id)
  }
}

// 正确：在 action 里获取，存到 state，getter 做衍生计算
getters: {
  publishedPosts: state => state.posts.filter(p => p.status === 'published'),
  postCount: state => state.posts.length
}
```

## 调试技巧

Vuex DevTools（Vue DevTools 的一部分）可以：

- 查看每次 mutation 前后的 state 快照
- 时间旅行（回滚到任意 mutation 之前的状态）
- 导入/导出 state 快照用于复现 bug

这是 Vuex 相比 prop drilling 最大的工程优势之一。

---

_下一篇：npm vs yarn 2018 年选择指南_
