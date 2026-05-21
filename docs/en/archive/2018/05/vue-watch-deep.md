---
title: "Vue Deep Watch and Array Watching"
date: 2018-05-01 09:32:57
tags:
  - Vue
readingTime: 1
description: "Vue's reactivity system has some special limitations for object properties and arrays. Understanding them is essential for using `watch` correctly."
wordCount: 141
---

Vue's reactivity system has some special limitations for object properties and arrays. Understanding them is essential for using `watch` correctly.

## Watching Objects: the `deep` Option

```javascript
export default {
  data() {
    return {
      form: {
        name: "",
        age: 0,
        address: {
          city: "",
          street: "",
        },
      },
    };
  },
  watch: {
    // Default: only watches when the form reference changes (a new object is assigned)
    form(newVal, oldVal) {
      // Changing form.name won't trigger this
    },

    // deep: true — watches changes to any nested property
    form: {
      handler(newVal) {
        console.log("Form changed", newVal);
      },
      deep: true,
    },
  },
};
```

**Cost of `deep`**: it traverses all properties of the object — expensive for large objects. If you only care about a specific property, watch that path directly:

```javascript
watch: {
  // Watch a nested property (string path)
  'form.address.city'(newVal) {
    console.log('City changed', newVal)
  }
}
```

## Vue's Array Limitations

Vue 2 cannot detect the following array mutations:

```javascript
// ❌ Vue cannot detect these
this.list[0] = "new value"; // direct index assignment
this.list.length = 0; // direct length modification

// ✅ Correct approaches
this.$set(this.list, 0, "new value"); // or:
Vue.set(this.list, 0, "new value");

this.list.splice(0, this.list.length); // clear the array
```

Vue wraps these array methods — using them triggers reactivity:

```javascript
// These methods are wrapped by Vue and trigger view updates
this.list.push(item);
this.list.pop();
this.list.shift();
this.list.unshift(item);
this.list.splice(index, 1);
this.list.sort();
this.list.reverse();

// These don't trigger updates (they return a new array) — assign back
this.list = this.list.filter((x) => x > 1);
this.list = this.list.map((x) => x * 2);
this.list = this.list.concat([4, 5]);
```

## Watching Arrays

```javascript
watch: {
  // Watching an array — write directly (no deep needed; push/pop etc. are detected)
  list(newVal) {
    console.log('list changed', newVal)
  },

  // To watch changes to properties inside each array item, use deep
  userList: {
    handler(newVal) {
      console.log('user property changed')
    },
    deep: true
  }
}
```

## `immediate`: Run on Initialization

```javascript
watch: {
  userId: {
    handler(id) {
      this.loadUserData(id)
    },
    immediate: true  // runs once when the component is created, not just on change
  }
}
```

Equivalent to:

```javascript
created() {
  this.loadUserData(this.userId)
},
watch: {
  userId(id) {
    this.loadUserData(id)
  }
}
```

`immediate: true` is cleaner.

## Summary

- Watching object property changes: use `deep: true`, but it has a performance cost
- Watching a specific nested property: use the string path directly — more efficient than `deep`
- Vue 2 array limitations: index assignment and `length` changes are not detected; use `$set` or array methods
- `immediate: true`: runs on initialization — avoids writing duplicate code
