---
title: "Vuex 狀態管理模式實踐：何時用、如何組織"
date: 2018-01-18 16:46:58
tags:
  - Vue
readingTime: 3
description: "Vuex 是 Vue 生態裡的狀態管理方案，類似 Redux 之於 React。但 Vuex 的學習曲線比 Redux 平緩，因為它沒有那麼多樣板程式碼。這篇文章結合實際專案，講如何合理使用 Vuex。"
wordCount: 453
---

Vuex 是 Vue 生態裡的狀態管理方案，類似 Redux 之於 React。但 Vuex 的學習曲線比 Redux 平緩，因為它沒有那麼多樣板程式碼。這篇文章結合實際專案，講如何合理使用 Vuex。

## 什麼時候應該引入 Vuex

這個問題比「如何使用 Vuex」更重要。Vuex 不是萬靈丹，引入它有成本：

**不需要 Vuex 的場景：**

- 元件層級淺，父子通訊就夠用
- 狀態隻在一個元件內使用
- 專案很小，維護成本低於收益

**應該引入 Vuex 的場景：**

- 多個無父子關係的元件需要共享狀態
- 狀態變化需要追蹤（除錯、回放）
- 伺服端資料需要在多處使用，避免重複請求

Vuex 官方的建議是：如果你不確定是否需要，就暫時不用。

## 基礎結構

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
    userDisplayName: (state) => (state.user ? state.user.name : "訪客"),
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
    // 非同步操作，提交 mutation
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

## 模組化：中大型專案的必選項

把所有狀態塞進一個 store 物件會變得難以維護。Vuex 的模組化可以按功能拆分：

```
store/
├── index.js        # 根 store，組裝所有模組
├── modules/
│   ├── user.js     # 使用者相關
│   ├── cart.js     # 購物車
│   └── order.js    # 訂單
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
  namespaced: true, // 重要：開啟命名空間
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

開啟 `namespaced: true` 後，存取方式變為：

```javascript
// 在元件裡
this.$store.state.user.profile;
this.$store.getters["user/hasPermission"]("edit");
this.$store.dispatch("user/fetchProfile");
this.$store.commit("user/SET_PROFILE", data);
```

## 在元件裡使用：輔助函式

重複寫 `this.$store.xxx` 很囉唆，用輔助函式：

```javascript
import { mapState, mapGetters, mapActions, mapMutations } from "vuex";

export default {
  computed: {
    // 模組化後帶命名空間
    ...mapState("user", ["profile"]),
    ...mapGetters("user", ["hasPermission"]),

    // 自訂名稱
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

## Action 的設計原則

Action 裡不隻是 API 呼叫，它負責**協調多個 mutation** 和處理**業務邏輯**：

```javascript
// actions/order.js
async createOrder({ commit, dispatch, state, rootState }) {
  // 1. 驗證購物車不為空
  if (state.cart.items.length === 0) {
    throw new Error('購物車為空')
  }

  // 2. 鎖定庫存
  commit('SET_SUBMITTING', true)

  try {
    // 3. 呼叫介面
    const order = await api.createOrder({
      items: state.cart.items,
      userId: rootState.user.profile.id,
      address: state.selectedAddress
    })

    // 4. 清空購物車
    commit('cart/CLEAR_CART', null, { root: true })

    // 5. 重新整理訂單列表
    await dispatch('order/fetchOrders', null, { root: true })

    return order
  } finally {
    commit('SET_SUBMITTING', false)
  }
}
```

## 不要在 Getter 裡處理非同步

Getter 是同步的計算屬性，不適合做非同步操作：

```javascript
// 錯誤：getter 裡不應該有非同步
getters: {
  async userPosts(state) {  // 這不會按預期運作
    return await api.getUserPosts(state.user.id)
  }
}

// 正確：在 action 裡取得，存到 state，getter 做衍生計算
getters: {
  publishedPosts: state => state.posts.filter(p => p.status === 'published'),
  postCount: state => state.posts.length
}
```

## 除錯技巧

Vuex DevTools（Vue DevTools 的一部分）可以：

- 查看每次 mutation 前後的 state 快照
- 時間旅行（回滾到任意 mutation 之前的狀態）
- 匯入/匯出 state 快照用於重現 bug

這是 Vuex 相比 prop drilling 最大的工程優勢之一。

---

_下一篇：npm vs yarn 2018 年選擇指南_
