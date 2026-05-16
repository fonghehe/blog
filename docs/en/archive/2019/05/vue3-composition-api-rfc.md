---
title: "Reading the Vue 3 Composition API RFC"
date: 2019-05-10 16:14:05
tags:
  - Vue
readingTime: 1
description: "The Vue team has published the Composition API RFC, and the community erupted — supporters say it's great, opponents say it looks like React Hooks. I carefully "
---

The Vue team has published the Composition API RFC, and the community erupted — supporters say it's great, opponents say it looks like React Hooks. I carefully read the RFC and here is my understanding.

## Why the Composition API Was Needed

The problems with Options API become obvious in large components:

```javascript
// A 500-line Vue 2 component
export default {
  data() {
    // user-related: name, age, userLoading
    // search-related: query, results, searchLoading
    // pagination-related: page, total, pageSize
  },
  methods: {
    // user methods, search methods, pagination methods all mixed together
  },
  computed: {
    // all computed properties mixed together
  },
  watch: {
    // all watchers mixed together
  },
};
// Related logic is scattered across different options, hard to maintain
```

The Composition API lets related logic live together.

## Composition API Basics

```javascript
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";

export default {
  setup(props, { emit, attrs, slots }) {
    // ref: reactive primitive values
    const count = ref(0);
    console.log(count.value); // access with .value

    // reactive: reactive objects
    const user = reactive({
      name: "Alice",
      loading: false,
    });

    // computed
    const doubled = computed(() => count.value * 2);

    // watch
    watch(count, (newVal, oldVal) => {
      console.log(`${oldVal} → ${newVal}`);
    });

    // lifecycle hooks
    onMounted(() => {
      console.log("mounted");
    });

    onUnmounted(() => {
      console.log("unmounted");
    });

    // expose to template
    return { count, user, doubled };
  },
};
```

## Logic Reuse with Composables

This is the most important value of the Composition API:

```javascript
// useMousePosition.js
import { ref, onMounted, onUnmounted } from "vue";

export function useMousePosition() {
  const x = ref(0);
  const y = ref(0);

  function update(event) {
    x.value = event.pageX;
    y.value = event.pageY;
  }

  onMounted(() => window.addEventListener("mousemove", update));
  onUnmounted(() => window.removeEventListener("mousemove", update));

  return { x, y };
}

// Use in any component
export default {
  setup() {
    const { x, y } = useMousePosition();
    return { x, y };
  },
};
```

Compared to mixins, composables have explicit data flow — you can clearly see where `x` and `y` come from. This is the reason the Vue community eventually embraced the Composition API.
