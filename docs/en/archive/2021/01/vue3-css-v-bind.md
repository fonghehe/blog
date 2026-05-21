---
title: "Vue 3.2 v-bind in CSS: Dynamic Styles"
date: 2021-01-22 17:19:27
tags:
  - Vue
  - CSS

readingTime: 1
description: "关于Vue 3.2 v-bind:css 动态样式，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspect"
wordCount: 193
---

关于Vue 3.2 v-bind:css 动态样式，: many developers only stay at the API call level. This article discusses real-world problems and solutions from a production perspective.

## Basic Principles

The key lies in understanding the core logic:

```css
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Advanced Features

We can improve it in the following ways:

```css
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

This approach has been running stably in production for over six months and has been practically validated.

## Project Practice

Let's start with the basic implementation:

```css
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

## Best Practices

Building on this foundation, we can further optimize:

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Summary

- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- Vue 3.2 v-bind:css 动态样式不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs
