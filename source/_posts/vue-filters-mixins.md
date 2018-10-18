---
title: "Vue 全局过滤器和混入"
date: 2018-10-18 15:24:55
tags:
  - Vue
---

项目里有很多跨组件用的功能：日期格式化、金额显示、权限判断……Vue 的全局过滤器和 Mixin 可以让这些逻辑集中管理。

## 全局过滤器

```javascript
// main.js
import Vue from "vue";
import dayjs from "dayjs";

// 日期格式化
Vue.filter("date", (value, format = "YYYY-MM-DD") => {
  if (!value) return "-";
  return dayjs(value).format(format);
});

// 金额格式化（分转元，千分位）
Vue.filter("money", (value) => {
  if (value === null || value === undefined) return "-";
  return (value / 100).toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
  });
});

// 文件大小
Vue.filter("fileSize", (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
});

// 枚举值翻译
const STATUS_MAP = { 1: "正常", 2: "禁用", 3: "待审核" };
Vue.filter("status", (value) => STATUS_MAP[value] || "未知");
```

```html
{% raw %}
<!-- 模板里使用：用管道符 | -->
<td>{{ order.createdAt | date }}</td>
<td>{{ order.createdAt | date('YYYY/MM/DD HH:mm') }}</td>
<td>{{ order.amount | money }}</td>
<td>{{ file.size | fileSize }}</td>
<td>{{ user.status | status }}</td>
{% endraw %}
```

## 局部过滤器（组件内）

```javascript
export default {
  filters: {
    // 只在这个组件里用
    truncate(value, length = 20) {
      if (!value) return "";
      return value.length > length ? value.slice(0, length) + "..." : value;
    },
  },
};
```

## 全局混入

**慎用全局混入**，因为它影响所有组件，容易产生意外副作用：

```javascript
// main.js
Vue.mixin({
  // 所有组件都会有这个方法
  methods: {
    // 全局的权限判断方法
    $hasPermission(permission) {
      const userPermissions = this.$store.getters.permissions;
      return userPermissions.includes(permission);
    },
  },
});
```

```html
<!-- 任意组件里 -->
<el-button v-if="$hasPermission('user:delete')" @click="deleteUser(row)">
  删除
</el-button>
```

## 局部混入（更推荐）

```javascript
// mixins/tableOperations.js
export const tableOperations = {
  data() {
    return {
      loading: false,
      list: [],
      total: 0,
      params: { page: 1, pageSize: 20 },
    };
  },
  methods: {
    async loadList() {
      this.loading = true;
      try {
        const { list, total } = await this.fetchList(this.params);
        this.list = list;
        this.total = total;
      } finally {
        this.loading = false;
      }
    },
    handlePageChange(page) {
      this.params.page = page;
      this.loadList();
    },
  },
  created() {
    this.loadList();
  },
};
```

```javascript
// 在组件里使用混入
import { tableOperations } from "@/mixins/tableOperations";

export default {
  mixins: [tableOperations],
  methods: {
    // 实现混入里调用的 fetchList
    fetchList(params) {
      return this.$api.getUserList(params);
    },
  },
};
```

## 混入的问题

Vue 2 混入的主要问题是**来源不透明**：在组件里用到 `this.loading` 但不知道它是哪里来的。

Vue 3 的 Composition API（`setup`）彻底解决了这个问题，混入已经不再推荐了。

## 小结

- 全局过滤器：日期、金额等格式化，在模板里用 `|` 调用
- 全局混入：谨慎使用，适合权限判断等真正全局的功能
- 局部混入：复用组件逻辑，但来源不透明，Vue 3 用 Composable 替代
