---
title: "Vue 2 Mixins: Usage and Pitfalls"
date: 2019-05-07 17:00:41
tags:
  - Vue
readingTime: 1
description: "Many developers have misconceptions about Vue 2 Mixins. This article systematically covers the key points and common pitfalls."
wordCount: 144
---

Many developers have misconceptions about Vue 2 Mixins. This article systematically covers the key points and common pitfalls.

## Basic Usage

A mixin is an object containing component options. It can be mixed into any component:

```javascript
// Define a mixin
const loadingMixin = {
  data() {
    return { loading: false, error: null };
  },
  methods: {
    async fetchData(fn) {
      this.loading = true;
      this.error = null;
      try {
        return await fn();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
  },
};

// Use in a component
export default {
  mixins: [loadingMixin],
  data() {
    return { users: [] };
  },
  async created() {
    this.users = await this.fetchData(() => api.getUsers());
  },
};
```

## Merge Strategy

When a mixin and a component have the same option, they merge according to specific rules:

- **data**: recursively merged, component takes precedence on conflicts
- **lifecycle hooks**: merged into an array, mixin hooks run first
- **methods/computed/components**: component takes precedence on conflicts

```javascript
const mixin = {
  data() {
    return { name: "mixin", extra: "from mixin" };
  },
  created() {
    console.log("mixin created");
  },
};

const component = {
  mixins: [mixin],
  data() {
    return { name: "component" };
  }, // overrides mixin
  created() {
    console.log("component created");
  },
};
// Log output: 'mixin created' then 'component created'
// data: { name: 'component', extra: 'from mixin' }
```

## Common Pitfalls

1. **Naming conflicts**: mixins silently override each other — use a prefix like `$_mixinName_method`
2. **Implicit dependencies**: mixin methods may rely on data or methods not defined in the mixin itself
3. **Hard to trace**: when there are multiple mixins it's hard to tell where a property comes from

In Vue 3, the Composition API's `composables` solve all of these problems, making mixins largely obsolete.
