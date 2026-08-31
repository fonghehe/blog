---
title: "Vue 3 script-setup Syntax Sugar"
date: 2021-01-06 17:10:52
tags:
  - Vue
  - TypeScript
  - JavaScript

readingTime: 1
description: "The script setup syntax sugar is being adopted more and more widely. This article starts from real projects and digs into its mechanics and best practices."
wordCount: 163
---

Vue 3's script-setup syntax sugar is being adopted more and more widely in frontend development. This article dives into its core principles and best practices from real projects.

## Basic Usage

Let's start with the basic implementation:

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('组件已挂载') })

    return { count, doubled }
  }
}

```

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Advanced Usage

Building on this foundation, we can further optimize:

```javascript
import { reactive, toRefs, computed } from 'vue'

function useCounter(initial = 0) {
  const state = reactive({ count: initial, history: [initial] })
  const doubled = computed(() => state.count * 2)

  function increment() {
    state.count++
    state.history.push(state.count)
  }

  return { ...toRefs(state), doubled, increment }
}

```

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Practical Cases

In real projects the usage gets a bit more complex:

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('组件已挂载') })

    return { count, doubled }
  }
}

```

Through this approach, both the testability and scalability of the code are improved.

## Performance Optimization

Here is a complete example:

```javascript
import { reactive, toRefs, computed } from 'vue'

function useCounter(initial = 0) {
  const state = reactive({ count: initial, history: [initial] })
  const doubled = computed(() => state.count * 2)

  function increment() {
    state.count++
    state.history.push(state.count)
  }

  return { ...toRefs(state), doubled, increment }
}

```

Pay attention to boundary condition handling, which is critical in production.

## Summary

- Code examples are for reference only and need to be adjusted according to your business scenario
- script-setup isn't a silver bullet; choose it based on your project's size and tech stack
- Understanding underlying principles is more important than memorizing APIs
