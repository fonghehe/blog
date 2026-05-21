---
title: "Vue mixin 的使用與陷阱"
date: 2018-07-19 14:39:52
tags:
  - Vue
readingTime: 2
description: "mixin 是 Vue 2 複用邏輯的主要方式，用好了很方便，但也有不少坑。"
wordCount: 204
---

mixin 是 Vue 2 複用邏輯的主要方式，用好了很方便，但也有不少坑。

## 基礎用法

```javascript
// mixins/loading.js
export const loadingMixin = {
  data() {
    return {
      loading: false,
      error: null,
    };
  },
  methods: {
    async withLoading(fn) {
      this.loading = true;
      this.error = null;
      try {
        return await fn();
      } catch (e) {
        this.error = e.message;
        throw e;
      } finally {
        this.loading = false;
      }
    },
  },
};

// 在元件中使用
import { loadingMixin } from "@/mixins/loading";

export default {
  mixins: [loadingMixin],
  methods: {
    async fetchData() {
      await this.withLoading(async () => {
        this.list = await getList();
      });
    },
  },
};
```

## 合併策略

mixin 和元件有相同屬性時的合併規則：

```javascript
const mixin = {
  data() {
    return { x: 1, y: 2 };
  },
  created() {
    console.log("mixin created");
  },
  methods: {
    foo() {
      return "mixin";
    },
  },
};

export default {
  mixins: [mixin],
  data() {
    return { x: 10 };
  }, // x=10 覆蓋 mixin 的 x=1，y=2 保留
  created() {
    console.log("component created");
  }, // 兩個都執行，mixin 先
  methods: {
    foo() {
      return "component";
    },
  }, // 元件覆蓋 mixin
};
```

**生命週期鉤子：兩者都執行，mixin 優先**
**data/methods/computed：元件優先**

## 實用 mixin 示例

```javascript
// mixins/permission.js - 許可權檢查
export const permissionMixin = {
  methods: {
    hasPermission(permission) {
      const userPerms = this.$store.getters["user/permissions"];
      return userPerms.includes(permission);
    },
    checkPermission(permission) {
      if (!this.hasPermission(permission)) {
        this.$message.error("沒有許可權");
        return false;
      }
      return true;
    },
  },
};

// mixins/table.js - 表格通用邏輯
export const tableMixin = {
  data() {
    return {
      tableData: [],
      total: 0,
      page: 1,
      pageSize: 20,
      loading: false,
    };
  },
  methods: {
    handlePageChange(page) {
      this.page = page;
      this.fetchTableData();
    },
    handleSizeChange(size) {
      this.pageSize = size;
      this.page = 1;
      this.fetchTableData();
    },
  },
};
```

## 陷阱：命名衝突

```javascript
// mixin A
const mixinA = {
  data() {
    return { value: "A" };
  },
};
// mixin B
const mixinB = {
  data() {
    return { value: "B" };
  },
};

export default {
  mixins: [mixinA, mixinB], // value 是 'B'（後面的覆蓋前面的）
  // 很難發現這個問題！
};
```

## 陷阱：隱式依賴

```javascript
// mixin 依賴 this.userId，但沒有宣告
export const userMixin = {
  methods: {
    fetchUser() {
      return getUser(this.userId); // 依賴元件的 userId，隱式的！
    },
  },
};

// 使用時必須知道這個依賴
export default {
  data() {
    return { userId: 123 };
  },
  mixins: [userMixin],
};
```

## mixin vs 組合式函式（Composition）

Vue 3 的 Composables 比 mixin 更好，沒有命名衝突，來源清晰：

```javascript
// mixin（Vue 2 寫法）
export const loadingMixin = {
  data() {
    return { loading: false, error: null }
  },
  methods: {
    async withLoading(fn) {
      this.loading = true
      this.error = null
      try {
      return await fn();
    } catch (e) {
      error.value = e.message;
    } finally {
      this.loading = false;
    }
  }

  return { loading, error, withLoading }; // 來源清晰！
}
```

## 小結

- mixin 是 Vue 2 邏輯複用的主要方式，生命週期都執行，data/methods 元件優先
- 注意命名衝突，建議 mixin 內的屬性加字首（如 `$_mixin_xxx`）
- 隱式依賴是最大的問題，mixin 內儘量不依賴元件的屬性
- Vue 3 的 Composables 解決了這些問題，是更好的替代方案
