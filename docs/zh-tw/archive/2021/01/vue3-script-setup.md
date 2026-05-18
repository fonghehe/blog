---
title: "Vue 3 script-setup 語法糖"
date: 2021-01-06 17:10:52
tags:
  - Vue
  - React
  - JavaScript
  - TypeScript
readingTime: 1
description: "Vue 3 script-setup 語法糖在前端開發中的應用越來越廣泛。本文從實際專案出發，深入分析其核心原理和最佳實踐。"
---

Vue 3 script-setup 語法糖在前端開發中的應用越來越廣泛。本文從實際專案出發，深入分析其核心原理和最佳實踐。

## 基礎用法

先來看基本的實現方式：

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('元件已掛載') })

    return { count, doubled }
  }
}

```

這段程式碼展示了基本的使用方式。實際專案中還需要考慮錯誤處理和邊界條件。

## 進階用法

在這個基礎上，我們可以進一步最佳化：

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

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 實戰案例

實際專案中的用法會更復雜一些：

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('元件已掛載') })

    return { count, doubled }
  }
}

```

通過這種方式，程式碼的可測試性和可擴充套件性都得到了提升。

## 效能最佳化

以下是一個完整的示例：

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

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- 程式碼示例僅供參考，需根據業務場景調整
- Vue 3 script-setup 語法糖不是銀彈，需要根據專案規模和技術棧選擇
- 理解底層原理比記住 API 更重要
