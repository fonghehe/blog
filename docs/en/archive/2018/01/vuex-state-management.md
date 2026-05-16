---
title: "Vuex State Management in Practice: When to Use It and How to Organize It"
date: 2018-01-18 16:46:58
tags:
  - Vue
readingTime: 2
description: "Vuex is Vue's official state management library, but many beginners use it everywhere or nowhere. The key is knowing when Vuex is the right tool."
---

Vuex is Vue's official state management library, but many beginners use it everywhere or nowhere. The key is knowing when Vuex is the right tool.

## When to Use Vuex

The classic signal: "when multiple components need to share state."

**Don't use Vuex for:**

- State local to a single component (form inputs, toggles)
- State shared between parent and child (use props/events)
- Simple sibling communication (consider EventBus or lifting state)

**Use Vuex when:**

- Multiple unrelated components need the same data (user info, cart items)
- State needs to persist across route navigation
- Complex state transitions that are hard to reason about with props/events
- You need time-travel debugging

## Basic Store Structure

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
    // Mutations must be synchronous
    SET_USER(state, user) {
      state.user = user;
    },
    ADD_TO_CART(state, item) {
      state.cartItems.push(item);
    },
    REMOVE_FROM_CART(state, itemId) {
      state.cartItems = state.cartItems.filter((item) => item.id !== itemId);
    },
  },

  actions: {
    // Actions can be async
    async login({ commit }, credentials) {
      const user = await authAPI.login(credentials);
      commit("SET_USER", user);
    },
    async logout({ commit }) {
      await authAPI.logout();
      commit("SET_USER", null);
    },
  },
});
```

## Modules with Namespacing

For large apps, split the store into modules:

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

```javascript
// store/index.js
import user from "./modules/user";
import cart from "./modules/cart";

export default new Vuex.Store({
  modules: { user, cart },
});
```

Accessing namespaced state:

```javascript
this.$store.state.user.profile;
this.$store.getters["user/isAdmin"];
this.$store.dispatch("user/fetchProfile");
```

## Helper Functions

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

## Action Design Principles

Actions should contain business logic, not just API calls:

```javascript
actions: {
  async addToCart({ state, commit, dispatch }, product) {
    // Check if user is logged in
    if (!state.user) {
      dispatch('openLoginModal')
      return
    }
    // Check inventory
    const inStock = await productAPI.checkStock(product.id)
    if (!inStock) {
      dispatch('showToast', { message: 'Out of stock', type: 'error' })
      return
    }
    // Add to cart
    commit('ADD_TO_CART', product)
    dispatch('showToast', { message: 'Added to cart', type: 'success' })
  },
}
```
