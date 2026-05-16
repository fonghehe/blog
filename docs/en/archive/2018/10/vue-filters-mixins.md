---
title: "Vue Global Filters and Mixins"
date: 2018-10-18 15:24:55
tags:
  - Vue
readingTime: 2
description: "Many projects share cross-component concerns: date formatting, currency display, permission checks… Vue global filters and mixins let you centralize this logic."
---

Many projects share cross-component concerns: date formatting, currency display, permission checks… Vue global filters and mixins let you centralize this logic.

## Global Filters

```javascript
// main.js
import Vue from "vue";
import dayjs from "dayjs";

// Date formatting
Vue.filter("date", (value, format = "YYYY-MM-DD") => {
  if (!value) return "-";
  return dayjs(value).format(format);
});

// Currency formatting (cents to yuan, thousands separator)
Vue.filter("money", (value) => {
  if (value === null || value === undefined) return "-";
  return (value / 100).toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
  });
});

// File size
Vue.filter("fileSize", (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
});

// Enum label translation
const STATUS_MAP = { 1: "Active", 2: "Disabled", 3: "Pending Review" };
Vue.filter("status", (value) => STATUS_MAP[value] || "Unknown");
```

```html
{% raw %}
<!-- In templates: use the pipe | operator -->
<td>{{ order.createdAt | date }}</td>
<td>{{ order.createdAt | date('YYYY/MM/DD HH:mm') }}</td>
<td>{{ order.amount | money }}</td>
<td>{{ file.size | fileSize }}</td>
<td>{{ user.status | status }}</td>
{% endraw %}
```

## Local Filters (Component-level)

```javascript
export default {
  filters: {
    // Only available in this component
    truncate(value, length = 20) {
      if (!value) return "";
      return value.length > length ? value.slice(0, length) + "..." : value;
    },
  },
};
```

## Global Mixins

**Use global mixins with caution** — they affect every component and can cause unexpected side effects:

```javascript
// main.js
Vue.mixin({
  // Every component will have this method
  methods: {
    // Global permission check
    $hasPermission(permission) {
      const userPermissions = this.$store.getters.permissions;
      return userPermissions.includes(permission);
    },
  },
});
```

```html
<!-- In any component -->
<el-button v-if="$hasPermission('user:delete')" @click="deleteUser(row)">
  Delete
</el-button>
```

## Local Mixins (Preferred)

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
// Using the mixin in a component
import { tableOperations } from "@/mixins/tableOperations";

export default {
  mixins: [tableOperations],
  methods: {
    // Implement the fetchList method called by the mixin
    fetchList(params) {
      return this.$api.getUserList(params);
    },
  },
};
```

## The Problem with Mixins

The main issue with Vue 2 mixins is **opaque origins**: you use `this.loading` in a component but can't immediately tell where it came from.

Vue 3's Composition API (`setup`) completely solves this problem, and mixins are no longer recommended.

## Summary

- Global filters: date, currency, and similar formatting — called in templates with the `|` pipe
- Global mixins: use with caution; appropriate for truly global concerns like permission checks
- Local mixins: reuse component logic, but origins are opaque — Vue 3 replaces them with Composables
