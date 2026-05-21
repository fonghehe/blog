---
title: "Vue 全局過濾器和混入"
date: 2018-10-18 15:24:55
tags:
  - Vue
readingTime: 2
description: "項目裏有很多跨組件用的功能：日期格式化、金額顯示、權限判斷……Vue 的全局過濾器和 Mixin 可以讓這些邏輯集中管理。"
wordCount: 228
---

項目裏有很多跨組件用的功能：日期格式化、金額顯示、權限判斷……Vue 的全局過濾器和 Mixin 可以讓這些邏輯集中管理。

## 全局過濾器

```javascript
// main.js
import Vue from "vue";
import dayjs from "dayjs";

// 日期格式化
Vue.filter("date", (value, format = "YYYY-MM-DD") => {
  if (!value) return "-";
  return dayjs(value).format(format);
});

// 金額格式化（分轉元，千分位）
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

// 枚舉值翻譯
const STATUS_MAP = { 1: "正常", 2: "禁用", 3: "待審核" };
Vue.filter("status", (value) => STATUS_MAP[value] || "未知");
```

```html
{% raw %}
<!-- 模板裏使用：用管道符 | -->
<td>{{ order.createdAt | date }}</td>
<td>{{ order.createdAt | date('YYYY/MM/DD HH:mm') }}</td>
<td>{{ order.amount | money }}</td>
<td>{{ file.size | fileSize }}</td>
<td>{{ user.status | status }}</td>
{% endraw %}
```

## 局部過濾器（組件內）

```javascript
export default {
  filters: {
    // 只在這個組件裏用
    truncate(value, length = 20) {
      if (!value) return "";
      return value.length > length ? value.slice(0, length) + "..." : value;
    },
  },
};
```

## 全局混入

**慎用全局混入**，因為它影響所有組件，容易產生意外副作用：

```javascript
// main.js
Vue.mixin({
  // 所有組件都會有這個方法
  methods: {
    // 全局的權限判斷方法
    $hasPermission(permission) {
      const userPermissions = this.$store.getters.permissions;
      return userPermissions.includes(permission);
    },
  },
});
```

```html
<!-- 任意組件裏 -->
<el-button v-if="$hasPermission('user:delete')" @click="deleteUser(row)">
  刪除
</el-button>
```

## 局部混入（更推薦）

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
// 在組件裏使用混入
import { tableOperations } from "@/mixins/tableOperations";

export default {
  mixins: [tableOperations],
  methods: {
    // 實現混入裏調用的 fetchList
    fetchList(params) {
      return this.$api.getUserList(params);
    },
  },
};
```

## 混入的問題

Vue 2 混入的主要問題是**來源不透明**：在組件裏用到 `this.loading` 但不知道它是哪裏來的。

Vue 3 的 Composition API（`setup`）徹底解決了這個問題，混入已經不再推薦了。

## 小結

- 全局過濾器：日期、金額等格式化，在模板裏用 `|` 調用
- 全局混入：謹慎使用，適合權限判斷等真正全局的功能
- 局部混入：複用組件邏輯，但來源不透明，Vue 3 用 Composable 替代
