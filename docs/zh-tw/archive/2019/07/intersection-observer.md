---
title: "Intersection Observer API 實戰"
date: 2019-07-16 17:28:35
tags:
  - 前端
readingTime: 4
description: "以前做圖片懶載入、無限滾動這些功能，基本都是靠 `scroll` 事件 + `getBoundingClientRect()` 來實現的。效能差不說，程式碼還醜。Intersection Observer API 的出現徹底改變了這個局面。"
---

以前做圖片懶載入、無限滾動這些功能，基本都是靠 `scroll` 事件 + `getBoundingClientRect()` 來實現的。效能差不說，程式碼還醜。Intersection Observer API 的出現徹底改變了這個局面。

## 基本用法

Intersection Observer 可以非同步監聽目標元素與祖先元素（或視口）的交叉狀態——進入視口、離開視口、交叉比例變化等。

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    console.log('目標元素:', entry.target)
    console.log('是否交叉:', entry.isIntersecting)
    console.log('交叉比例:', entry.intersectionRatio)
    console.log('交叉矩形:', entry.intersectionRect)
    console.log('根矩形:', entry.rootBounds)
    console.log('目標矩形:', entry.boundingClientRect)
    console.log('時間戳:', entry.time)
  })
}, {
  root: null,          // 預設為視口，也可以指定某個容器元素
  rootMargin: '0px',   // 根元素的外邊距，類似 CSS margin
  threshold: 0         // 交叉比例閾值，可以是陣列 [0, 0.25, 0.5, 0.75, 1]
})

// 開始觀察
observer.observe(targetElement)

// 停止觀察
observer.unobserve(targetElement)

// 銷燬觀察器
observer.disconnect()
```

## 實戰一：圖片懶載入

最經典的應用場景：

```html
<div class="image-list">
  <img data-src="https://cdn.example.com/photo1.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo2.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo3.jpg" class="lazy" />
  <!-- 更多圖片 -->
</div>
```

```javascript
class LazyLoader {
  constructor(options = {}) {
    this.observer = null
    this.options = {
      rootMargin: options.rootMargin || '200px',  // 提前 200px 開始載入
      threshold: options.threshold || 0,
      placeholder: options.placeholder || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    }
  }

  observe(images) {
    // 先判斷瀏覽器是否支援
    if (!('IntersectionObserver' in window)) {
      this.loadAllImages(images)
      return
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target)
          this.observer.unobserve(entry.target)
        }
      })
    }, {
      rootMargin: this.options.rootMargin,
      threshold: this.options.threshold
    })

    images.forEach(img => {
      // 設定佔位圖
      if (!img.src) {
        img.src = this.options.placeholder
      }
      this.observer.observe(img)
    })
  }

  loadImage(img) {
    const src = img.dataset.src
    if (!src) return

    // 預載入
    const tempImg = new Image()
    tempImg.onload = () => {
      img.src = src
      img.classList.add('loaded')
    }
    tempImg.onerror = () => {
      img.classList.add('error')
      // 可以設定一個錯誤佔位圖
      img.src = this.options.errorImage || ''
    }
    tempImg.src = src
  }

  loadAllImages(images) {
    images.forEach(img => this.loadImage(img))
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}

// 使用
const lazyLoader = new LazyLoader({ rootMargin: '300px' })
const images = document.querySelectorAll('img.lazy')
lazyLoader.observe(images)
```

### Vue 元件封裝

```vue
<!-- LazyImage.vue -->
<template>
  <img
    ref="img"
    :src="loaded ? src : placeholder"
    :class="{ loaded: loaded, error: hasError }"
    @load="onLoad"
    @error="onError"
  />
</template>

<script>
export default {
  props: {
    src: { type: String, required: true },
    rootMargin: { type: String, default: '200px' }
  },
  data() {
    return {
      loaded: false,
      hasError: false,
      observer: null,
      placeholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    }
  },
  mounted() {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // 進入視口，開始載入真實圖片
          const img = this.$refs.img
          const tempImg = new Image()
          tempImg.onload = () => {
            img.src = this.src
          }
          tempImg.src = this.src
          this.observer.unobserve(img)
        }
      },
      { rootMargin: this.rootMargin }
    )
    this.observer.observe(this.$refs.img)
  },
  beforeDestroy() {
    if (this.observer) {
      this.observer.disconnect()
    }
  },
  methods: {
    onLoad() {
      this.loaded = true
    },
    onError() {
      this.hasError = true
    }
  }
}
</script>

<style scoped>
img {
  transition: opacity 0.3s;
  opacity: 0;
}
img.loaded {
  opacity: 1;
}
</style>
```

## 實戰二：無限滾動

```javascript
class InfiniteScroll {
  constructor({ container, loadMore, threshold = 200 }) {
    this.container = container
    this.loadMore = loadMore
    this.loading = false
    this.hasMore = true

    // 建立哨兵元素
    this.sentinel = document.createElement('div')
    this.sentinel.className = 'scroll-sentinel'
    this.sentinel.style.height = '1px'
    container.appendChild(this.sentinel)

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.loading && this.hasMore) {
          this.load()
        }
      },
      { rootMargin: `${threshold}px` }
    )
    this.observer.observe(this.sentinel)
  }

  async load() {
    this.loading = true
    try {
      const result = await this.loadMore()
      this.hasMore = result.hasMore
    } catch (err) {
      console.error('載入失敗:', err)
    } finally {
      this.loading = false
    }
  }

  destroy() {
    this.observer.disconnect()
    this.sentinel.remove()
  }
}

// 使用
const scroller = new InfiniteScroll({
  container: document.querySelector('.list'),
  loadMore: async () => {
    const res = await fetch(`/api/items?page=${currentPage++}`)
    const data = await res.json()
    renderItems(data.items)
    return { hasMore: data.hasMore }
  }
})
```

### React Hooks 版本

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'

function useInfiniteScroll(loadMore, options = {}) {
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const observerRef = useRef(null)
  const sentinelRef = useRef(null)

  const handleIntersect = useCallback(async (entries) => {
    if (entries[0].isIntersecting && !loading && hasMore) {
      setLoading(true)
      try {
        const result = await loadMore()
        setHasMore(result.hasMore)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
  }, [loading, hasMore, loadMore])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: options.rootMargin || '200px'
    })

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [handleIntersect])

  return { sentinelRef, loading, hasMore }
}

// 使用
function ArticleList() {
  const [articles, setArticles] = useState([])
  const [page, setPage] = useState(1)

  const { sentinelRef, loading } = useInfiniteScroll(async () => {
    const res = await fetch(`/api/articles?page=${page}`)
    const data = await res.json()
    setArticles(prev => [...prev, ...data.items])
    setPage(p => p + 1)
    return { hasMore: data.hasMore }
  })

  return (
    <div className="article-list">
      {articles.map(article => (
        <ArticleCard key={article.id} article={article} />
      ))}
      <div ref={sentinelRef} className="sentinel" />
      {loading && <div className="loading">載入中...</div>}
    </div>
  )
}
```

## 實戰三：廣告曝光統計

廣告行業需要統計廣告是否真正被使用者看到（不僅僅是在 DOM 中，而是使用者真的看到了）：

```javascript
class AdTracker {
  constructor() {
    // threshold: 0.5 表示廣告至少 50% 可見才算"曝光"
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const adId = entry.target.dataset.adId
            this.trackImpression(adId)
            // 只統計一次，曝光後取消觀察
            this.observer.unobserve(entry.target)
          }
        })
      },
      { threshold: [0.5] }  // 50% 可見時觸發
    )
  }

  observe(adElement) {
    this.observer.observe(adElement)
  }

  trackImpression(adId) {
    // 上報曝光資料
    navigator.sendBeacon('/api/ad/impression', JSON.stringify({
      adId,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }))
  }

  disconnect() {
    this.observer.disconnect()
  }
}

// 使用
const tracker = new AdTracker()
document.querySelectorAll('.ad-slot').forEach(ad => {
  tracker.observe(ad)
})
```

**關鍵點：** 使用 `threshold: [0.5]` 確保廣告至少 50% 可見才統計，避免使用者快速滾動時誤統計。用 `navigator.sendBeacon` 上報，即使頁面關閉也能送達。

## 相容性處理

截至 2019 年中，Intersection Observer 的瀏覽器支援情況：

| 瀏覽器 | 支援版本 |
|
--------|----------|
| Chrome | 51+ |
| Firefox | 55+ |
| Safari | 12.1+ |
| Edge | 15+ |
| IE | 不支援 |

對於不支援的瀏覽器，可以使用 W3C 官方 polyfill：

```bash
npm install intersection-observer
```

```javascript
// 在入口檔案頂部引入
import 'intersection-observer'

// 或者按需載入
if (!('IntersectionObserver' in window)) {
  await import('intersection-observer')
}
```

也可以自己寫一個降級方案：

```javascript
function createSafeObserver(callback, options) {
  if ('IntersectionObserver' in window) {
    return new IntersectionObserver(callback, options)
  }

  // 降級：用 scroll 事件模擬
  return {
    _targets: new Set(),
    observe(target) {
      this._targets.add(target)
      // 立即觸發一次，認為元素可見
      callback([{
        target,
        isIntersecting: true,
        intersectionRatio: 1
      }])
    },
    unobserve(target) {
      this._targets.delete(target)
    },
    disconnect() {
      this._targets.clear()
    }
  }
}
```

## 小結

- Intersection Observer 用非同步回撥替代 scroll + getBoundingClientRect，效能好得多
- 圖片懶載入：`rootMargin` 提前載入，`unobserve` 載入後取消觀察
- 無限滾動：用哨兵元素 + `isIntersecting` 判斷是否需要載入更多
- 廣告曝光：用 `threshold: [0.5]` 控制可見比例，`navigator.sendBeacon` 可靠上報
- 注意 `disconnect()` 清理觀察器，避免記憶體洩漏
- IE 不支援，需要 polyfill 或降級方案
