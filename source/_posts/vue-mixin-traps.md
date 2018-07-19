---
title: "Vue mixin 的使用与陷阱"
date: 2018-07-19 14:39:52
tags:
  - Vue
---

mixin 是 Vue 2 复用逻辑的主要方式，用好了很方便，但也有不少坑。

## 基础用法

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

// 在组件中使用
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

## 合并策略

mixin 和组件有相同属性时的合并规则：

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
  }, // x=10 覆盖 mixin 的 x=1，y=2 保留
  created() {
    console.log("component created");
  }, // 两个都执行，mixin 先
  methods: {
    foo() {
      return "component";
    },
  }, // 组件覆盖 mixin
};
```

**生命周期钩子：两者都执行，mixin 优先**
**data/methods/computed：组件优先**

## 实用 mixin 示例

```javascript
// mixins/permission.js - 权限检查
export const permissionMixin = {
  methods: {
    hasPermission(permission) {
      const userPerms = this.$store.getters["user/permissions"];
      return userPerms.includes(permission);
    },
    checkPermission(permission) {
      if (!this.hasPermission(permission)) {
        this.$message.error("没有权限");
        return false;
      }
      return true;
    },
  },
};

// mixins/table.js - 表格通用逻辑
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

## 陷阱：命名冲突

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
  mixins: [mixinA, mixinB], // value 是 'B'（后面的覆盖前面的）
  // 很难发现这个问题！
};
```

## 陷阱：隐式依赖

```javascript
// mixin 依赖 this.userId，但没有声明
export const userMixin = {
  methods: {
    fetchUser() {
      return getUser(this.userId); // 依赖组件的 userId，隐式的！
    },
  },
};

// 使用时必须知道这个依赖
export default {
  data() {
    return { userId: 123 };
  },
  mixins: [userMixin],
};
```

## mixin vs 组合式函数（Composition）

Vue 3 的 Composables 比 mixin 更好，没有命名冲突，来源清晰：

```javascript
// mixin（Vue 2 写法）
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

  return { loading, error, withLoading }; // 来源清晰！
}
```

## 小结

- mixin 是 Vue 2 逻辑复用的主要方式，生命周期都执行，data/methods 组件优先
- 注意命名冲突，建议 mixin 内的属性加前缀（如 `$_mixin_xxx`）
- 隐式依赖是最大的问题，mixin 内尽量不依赖组件的属性
- Vue 3 的 Composables 解决了这些问题，是更好的替代方案
