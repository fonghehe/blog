---
title: "Vue Mixin Usage and Pitfalls"
date: 2018-07-19 14:39:52
tags:
  - Vue
readingTime: 1
description: "Mixin is the primary way to share logic in Vue 2. Used well it's very convenient, but it has several traps."
---

Mixin is the primary way to share logic in Vue 2. Used well it's very convenient, but it has several traps.

## Basic Usage

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

// Using in a component
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

## Merge Strategy

Rules when mixin and component have the same property:

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
  }, // x=10 overrides mixin's x=1, y=2 is kept
  created() {
    console.log("component created");
  }, // both execute, mixin first
  methods: {
    foo() {
      return "component";
    },
  }, // component overrides mixin
};
```

**Lifecycle hooks: both execute, mixin runs first**
**data/methods/computed: component takes precedence**

## Practical Mixin Examples

```javascript
// mixins/permission.js - permission checking
export const permissionMixin = {
  methods: {
    hasPermission(permission) {
      const userPerms = this.$store.getters["user/permissions"];
      return userPerms.includes(permission);
    },
    checkPermission(permission) {
      if (!this.hasPermission(permission)) {
        this.$message.error("No permission");
        return false;
      }
      return true;
    },
  },
};

// mixins/table.js - common table logic
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

## Pitfall: Naming Conflicts

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
  mixins: [mixinA, mixinB], // value is 'B' (later one wins)
  // very hard to spot this problem!
};
```

## Pitfall: Implicit Dependencies

```javascript
// mixin depends on this.userId but doesn't declare it
export const userMixin = {
  methods: {
    fetchUser() {
      return getUser(this.userId); // depends on component's userId — implicit!
    },
  },
};

// Users must know about this dependency
export default {
  data() {
    return { userId: 123 };
  },
  mixins: [userMixin],
};
```

## Mixin vs Composition Functions

Vue 3's Composables are better than mixins — no naming conflicts, source is clear:

```javascript
// mixin (Vue 2 style)
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
