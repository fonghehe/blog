---
title: "Pinia 下一代 Vuex 状态管理"
date: 2021-01-04 11:18:42
tags:
  - Vue
  - React
  - JavaScript
---

Pinia 下一代 Vuex 状态管理在前端开发中的应用越来越广泛。本文从实际项目出发，深入分析其核心原理和最佳实践。

## 基础用法

以下是一个完整的示例：

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

注意边界条件处理，这在生产环境中至关重要。

## 进阶用法

关键在于理解核心逻辑：

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

性能优化需要结合具体场景，不是所有情况都需要过度优化。

## 实战案例

我们可以通过以下方式来改进：

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

这套方案已经在线上稳定运行了半年以上，经过了实际验证。

## 性能优化

先来看基本的实现方式：

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

这段代码展示了基本的使用方式。实际项目中还需要考虑错误处理和边界条件。

## 常见陷阱

在这个基础上，我们可以进一步优化：

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

这种模式在大型项目中非常实用，能显著降低维护成本。

## 小结

- 团队协作中约定和文档比技术本身更重要
- 关注社区动态，技术方案需要持续迭代
- 不要为了用新技术而用新技术
