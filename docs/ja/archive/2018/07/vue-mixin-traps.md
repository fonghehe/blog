---
title: "Vue mixinの使い方と落とし穴"
date: 2018-07-19 14:39:52
tags:
  - Vue
readingTime: 2
description: "mixinはVue 2でロジックを再利用するための主な方法です。うまく使えば便利ですが、いくつかの落とし穴があります。"
---

mixinはVue 2でロジックを再利用するための主な方法です。うまく使えば便利ですが、いくつかの落とし穴があります。

## 基本的な使い方

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

// コンポーネントでの使用
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

## マージ戦略

mixinとコンポーネントに同じプロパティがある場合のマージルール：

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
  }, // x=10がmixinのx=1を上書き、y=2は保持
  created() {
    console.log("component created");
  }, // 両方実行される。mixinが先
  methods: {
    foo() {
      return "component";
    },
  }, // コンポーネントがmixinを上書き
};
```

**ライフサイクルフック：両方実行され、mixinが優先**
**data/methods/computed：コンポーネントが優先**

## 実用的なmixinの例

```javascript
// mixins/permission.js - 権限チェック
export const permissionMixin = {
  methods: {
    hasPermission(permission) {
      const userPerms = this.$store.getters["user/permissions"];
      return userPerms.includes(permission);
    },
    checkPermission(permission) {
      if (!this.hasPermission(permission)) {
        this.$message.error("権限がありません");
        return false;
      }
      return true;
    },
  },
};

// mixins/table.js - テーブル共通ロジック
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

## 落とし穴：命名の衝突

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
  mixins: [mixinA, mixinB], // valueは'B'（後の方が上書き）
  // この問題は気づきにくい！
};
```

## 落とし穴：暗黙の依存関係

```javascript
// mixinがthis.userIdに依存しているが、宣言していない
export const userMixin = {
  methods: {
    fetchUser() {
      return getUser(this.userId); // コンポーネントのuserIdに依存——暗黙的！
    },
  },
};

// 使用時にはこの依存関係を知っている必要がある
export default {
  data() {
    return { userId: 123 };
  },
  mixins: [userMixin],
};
```

## mixin vs コンポーザブル関数（Composition）

Vue 3のコンポーザブルはmixinより優れています。命名の衝突がなく、出所が明確です：

```javascript
// mixin（Vue 2スタイル）
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
```
