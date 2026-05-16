---
title: "Vue computed and watch: When to Use Each"
date: 2018-03-04 09:32:17
tags:
  - Vue
readingTime: 1
description: "Both `computed` and `watch` respond to data changes, but they suit different scenarios. Using the wrong one won't throw an error, but your code will feel awkwar"
---

Both `computed` and `watch` respond to data changes, but they suit different scenarios. Using the wrong one won't throw an error, but your code will feel awkward.

## computed: Derived Values

`computed` is used to **calculate** a new value from existing data. It is cached.

```javascript
export default {
  data() {
    return {
      firstName: "John",
      lastName: "Doe",
      cartItems: [
        { name: "Item A", price: 100, count: 2 },
        { name: "Item B", price: 50, count: 1 },
      ],
    };
  },
  computed: {
    // Returns cached result unless firstName or lastName changes
    fullName() {
      return this.firstName + " " + this.lastName;
    },

    // Shopping cart total
    totalPrice() {
      return this.cartItems.reduce((sum, item) => {
        return sum + item.price * item.count;
      }, 0);
    },
  },
};
```

**Why caching matters:** If `fullName` is used in multiple places in the template, a regular `methods` function would re-execute on every render, while `computed` only recalculates when its dependencies change.

## watch: React to Changes, Execute Side Effects

`watch` is used to **observe** data changes and then do something (make a request, log, write to local storage, etc.).

```javascript
export default {
  data() {
    return {
      searchKeyword: "",
      userId: null,
    };
  },
  watch: {
    // Keyword changes — trigger a request
    searchKeyword(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.fetchSearchResults(newVal);
      }
    },

    // deep: deeply watch object changes
    // immediate: run once immediately (no need to wait for a change)
    userId: {
      handler(newId) {
        if (newId) this.fetchUserInfo(newId);
      },
      immediate: true, // also run once on initialization
    },
  },
};
```

## Choosing Between the Two

```
Ask yourself: do I need a "value", or do I need to "perform an action"?

Need a value → computed
  e.g. fullName, totalPrice, filteredList, isFormValid

Need to perform an action → watch
  e.g. route changed → fetch data, data changed → update localStorage, scroll to top
```

## Common Misuse

```javascript
// ❌ Wrong: using watch to compute a derived value
watch: {
  firstName() {
    this.fullName = this.firstName + this.lastName
  },
  lastName() {
    this.fullName = this.firstName + this.lastName
  }
}

// ✅ Correct: this is exactly what computed is for
computed: {
  fullName() {
    return this.firstName + this.lastName
  }
}

// ❌ Wrong: async operations in computed
computed: {
  // computed doesn't support async — fullName would be a Promise
  async fullName() {
    return await fetchName()
  }
}

// ✅ Correct: use watch for async operations
watch: {
  userId: {
    async handler(id) {
      this.userInfo = await fetchUserInfo(id)
    },
    immediate: true
  }
}
```

## Summary

- `computed`: derived values, cached, synchronous only
- `watch`: observe changes, execute side effects, supports async
- Decision rule: use computed when you need a "value," use watch when you need to "do something"
