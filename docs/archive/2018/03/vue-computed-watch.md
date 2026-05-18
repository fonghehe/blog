---
title: "Vue computed 和 watch 的使用场景"
date: 2018-03-04 09:32:17
tags:
  - Vue
readingTime: 1
description: "`computed` 和 `watch` 都能响应数据变化，但适合的场景不一样。用错了不会报错，但代码会很别扭。"
---

`computed` 和 `watch` 都能响应数据变化，但适合的场景不一样。用错了不会报错，但代码会很别扭。

## computed：派生值

`computed` 用于从已有数据**计算出**新值，有缓存。

```javascript
export default {
  data() {
    return {
      firstName: "张",
      lastName: "三",
      cartItems: [
        { name: "商品A", price: 100, count: 2 },
        { name: "商品B", price: 50, count: 1 },
      ],
    };
  },
  computed: {
    // 只要 firstName 或 lastName 没变，直接返回缓存
    fullName() {
      return this.firstName + this.lastName;
    },

    // 购物车总价
    totalPrice() {
      return this.cartItems.reduce((sum, item) => {
        return sum + item.price * item.count;
      }, 0);
    },
  },
};
```

**缓存的意义：** 如果模板里多处用到 `fullName`，普通 `methods` 每次渲染都会重新执行，`computed` 只在依赖变了才重新计算。

## watch：响应变化，执行副作用

`watch` 用于**监听**数据变化，然后做一些事情（发请求、打日志、写本地存储等）。

```javascript
export default {
  data() {
    return {
      searchKeyword: "",
      userId: null,
    };
  },
  watch: {
    // 搜索词变化，发请求
    searchKeyword(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.fetchSearchResults(newVal);
      }
    },

    // deep：深度监听对象变化
    // immediate：立即执行一次（不需要等数据变化）
    userId: {
      handler(newId) {
        if (newId) this.fetchUserInfo(newId);
      },
      immediate: true, // 初始化时也执行一次
    },
  },
};
```

## 两者的选择原则

```
问自己：我要的是一个"值"，还是要"执行某个操作"？

需要值 → computed
  例：fullName、totalPrice、filteredList、isFormValid

要执行操作 → watch
  例：路由变了发请求、数据变了更新 localStorage、滚动到顶部
```

## 常见误用

```javascript
// ❌ 错：用 watch 来计算派生值
watch: {
  firstName() {
    this.fullName = this.firstName + this.lastName
  },
  lastName() {
    this.fullName = this.firstName + this.lastName
  }
}

// ✅ 对：这就是 computed 的场景
computed: {
  fullName() {
    return this.firstName + this.lastName
  }
}

// ❌ 错：用 computed 做异步操作
computed: {
  // computed 不支持异步，这样写 fullName 是 Promise 对象
  async fullName() {
    return await fetchName()
  }
}

// ✅ 对：异步操作用 watch
watch: {
  userId: {
    async handler(id) {
      this.userInfo = await fetchUserInfo(id)
    },
    immediate: true
  }
}
```

## 小结

- `computed`：派生值，有缓存，纯同步
- `watch`：监听变化，执行副作用，支持异步
- 判断标准：要"值"用 computed，要"做事"用 watch