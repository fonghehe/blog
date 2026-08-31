---
title: "Vuex 狀態管理模式實踐：幾時用、點樣組織"
date: 2018-01-18 16:46:58
tags:
  - Vue
readingTime: 3
description: "Vuex 係 Vue 生態裡面嘅狀態管理方案，類似 Redux 之於 React。但 Vuex 嘅學習曲線比 Redux 平緩，因為佢冇咁多樣板代碼。呢篇文章結合實際項目，講點樣合理使用 Vuex。"
wordCount: 451
---

Vuex 係 Vue 生態裡面嘅狀態管理方案，類似 Redux 之於 React。但 Vuex 嘅學習曲線比 Redux 平緩，因為佢冇咁多樣板代碼。呢篇文章結合實際項目，講點樣合理使用 Vuex。

## 幾時應該引入 Vuex

呢個問題比「點樣使用 Vuex」更重要。Vuex 唔係萬能藥，引入佢有成本：

**唔需要 Vuex 嘅場景：**

- 組件層級淺，父子通信就夠用
- 狀態只喺一個組件內使用
- 項目好細，維護成本低於收益

**應該引入 Vuex 嘅場景：**

- 多個冇父子關係嘅組件需要共享狀態
- 狀態變化需要追蹤（調試、回放）
- 服務端數據需要喺多處使用，避免重複請求

Vuex 官方嘅建議係：如果你唔確定係咪需要，就暫時唔用。

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
    // 異步操作，提交 mutation
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

## 模塊化：中大型項目嘅必選項

將所有狀態塞進一個 store 對象會變得難以維護。Vuex 嘅模塊化可以按功能拆分：

```
store/
├── index.js        # 根 store，組裝所有模塊
├── modules/
│   ├── user.js     # 用戶相關
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

開啟 `namespaced: true` 後，訪問方式變為：

```javascript
// 喺組件裡面
this.$store.state.user.profile;
this.$store.getters["user/hasPermission"]("edit");
this.$store.dispatch("user/fetchProfile");
this.$store.commit("user/SET_PROFILE", data);
```

## 喺組件裡面使用：輔助函數

重複寫 `this.$store.xxx` 好囉嗦，用輔助函數：

```javascript
import { mapState, mapGetters, mapActions, mapMutations } from "vuex";

export default {
  computed: {
    // 模塊化後帶命名空間
    ...mapState("user", ["profile"]),
    ...mapGetters("user", ["hasPermission"]),

    // 自定義名稱
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

## Action 嘅設計原則

Action 裡面唔只係 API 調用，佢負責**協調多個 mutation** 同處理**業務邏輯**：

```javascript
// actions/order.js
async createOrder({ commit, dispatch, state, rootState }) {
  // 1. 驗證購物車唔係空嘅
  if (state.cart.items.length === 0) {
    throw new Error('購物車為空')
  }

  // 2. 鎖定庫存
  commit('SET_SUBMITTING', true)

  try {
    // 3. 調用接口
    const order = await api.createOrder({
      items: state.cart.items,
      userId: rootState.user.profile.id,
      address: state.selectedAddress
    })

    // 4. 清空購物車
    commit('cart/CLEAR_CART', null, { root: true })

    // 5. 刷新訂單列表
    await dispatch('order/fetchOrders', null, { root: true })

    return order
  } finally {
    commit('SET_SUBMITTING', false)
  }
}
```

## 唔好喺 Getter 裡面處理異步

Getter 係同步嘅計算屬性，唔適合做異步操作：

```javascript
// 錯誤：getter 裡面唔應該有異步
getters: {
  async userPosts(state) {  // 呢個唔會按預期工作
    return await api.getUserPosts(state.user.id)
  }
}

// 正確：喺 action 裡面獲取，存到 state，getter 做衍生計算
getters: {
  publishedPosts: state => state.posts.filter(p => p.status === 'published'),
  postCount: state => state.posts.length
}
```

## 調試技巧

Vuex DevTools（Vue DevTools 嘅一部分）可以：

- 查看每次 mutation 前後嘅 state 快照
- 時間旅行（回滾到任意 mutation 之前嘅狀態）
- 導入/導出 state 快照用於重現 bug

呢個係 Vuex 相比 prop drilling 最大嘅工程優勢之一。

---

_下一篇：npm vs yarn 2018 年選擇指南_
