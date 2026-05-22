---
title: "Vue 3 Composables 設計模式：落地路徑與實戰建議"
date: 2024-02-15 16:44:18
tags:
  - Vue
readingTime: 2
description: "關於Vue 3 Composables 設計模式，很多開發者隻停留在 API 調用層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。"
wordCount: 337
---

關於Vue 3 Composables 設計模式，很多開發者隻停留在 API 調用層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。

## 基本原理

在這個基礎上，我們可以進一步優化：

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

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 高級特性

實際項目中的用法會更復雜一些：

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('組件已掛載') })

    return { count, doubled }
  }
}

```

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 項目實踐

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

## 最佳實踐

關鍵在於理解核心邏輯：

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('組件已掛載') })

    return { count, doubled }
  }
}

```

效能優化需要結合具體場景，不是所有情況都需要過度優化。

## 踩坑記錄

我們可以通過以下方式來改進：

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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 小結

- 關注社區動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
- 代碼示例僅供參考，需根據業務場景調整
- Vue 3 Composables 設計模式不是銀彈，需要根據項目規模和技術棧選擇