---
title: "Vue computed 和 watch 的使用場景"
date: 2018-03-04 09:32:17
tags:
  - Vue
readingTime: 1
description: "`computed` 和 `watch` 都能響應數據變化，但適合的場景不一樣。用錯了不會報錯，但代碼會很彆扭。"
wordCount: 188
---

`computed` 和 `watch` 都能響應數據變化，但適合的場景不一樣。用錯了不會報錯，但代碼會很彆扭。

## computed：派生值

`computed` 用於從已有數據**計算出**新值，有緩存。

```javascript
export default {
  data() {
    return {
      firstName: "張",
      lastName: "三",
      cartItems: [
        { name: "商品A", price: 100, count: 2 },
        { name: "商品B", price: 50, count: 1 },
      ],
    };
  },
  computed: {
    // 只要 firstName 或 lastName 沒變，直接返回緩存
    fullName() {
      return this.firstName + this.lastName;
    },

    // 購物車總價
    totalPrice() {
      return this.cartItems.reduce((sum, item) => {
        return sum + item.price * item.count;
      }, 0);
    },
  },
};
```

**緩存的意義：** 如果模板裏多處用到 `fullName`，普通 `methods` 每次渲染都會重新執行，`computed` 只在依賴變了才重新計算。

## watch：響應變化，執行副作用

`watch` 用於**監聽**數據變化，然後做一些事情（發請求、打日誌、寫本地存儲等）。

```javascript
export default {
  data() {
    return {
      searchKeyword: "",
      userId: null,
    };
  },
  watch: {
    // 搜索詞變化，發請求
    searchKeyword(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.fetchSearchResults(newVal);
      }
    },

    // deep：深度監聽對象變化
    // immediate：立即執行一次（不需要等數據變化）
    userId: {
      handler(newId) {
        if (newId) this.fetchUserInfo(newId);
      },
      immediate: true, // 初始化時也執行一次
    },
  },
};
```

## 兩者的選擇原則

```
問自己：我要的是一個"值"，還是要"執行某個操作"？

需要值 → computed
  例：fullName、totalPrice、filteredList、isFormValid

要執行操作 → watch
  例：路由變了發請求、數據變了更新 localStorage、滾動到頂部
```

## 常見誤用

```javascript
// ❌ 錯：用 watch 來計算派生值
watch: {
  firstName() {
    this.fullName = this.firstName + this.lastName
  },
  lastName() {
    this.fullName = this.firstName + this.lastName
  }
}

// ✅ 對：這就是 computed 的場景
computed: {
  fullName() {
    return this.firstName + this.lastName
  }
}

// ❌ 錯：用 computed 做異步操作
computed: {
  // computed 不支持異步，這樣寫 fullName 是 Promise 對象
  async fullName() {
    return await fetchName()
  }
}

// ✅ 對：異步操作用 watch
watch: {
  userId: {
    async handler(id) {
      this.userInfo = await fetchUserInfo(id)
    },
    immediate: true
  }
}
```

## 小結

- `computed`：派生值，有緩存，純同步
- `watch`：監聽變化，執行副作用，支持異步
- 判斷標準：要"值"用 computed，要"做事"用 watch