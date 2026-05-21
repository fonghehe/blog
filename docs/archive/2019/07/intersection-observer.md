---
title: "Intersection Observer API 实战"
date: 2019-07-16 17:28:35
tags:
  - 前端
readingTime: 4
description: "以前做图片懒加载、无限滚动这些功能，基本都是靠 `scroll` 事件 + `getBoundingClientRect()` 来实现的。性能差不说，代码还丑。Intersection Observer API 的出现彻底改变了这个局面。"
wordCount: 408
---

以前做图片懒加载、无限滚动这些功能，基本都是靠 `scroll` 事件 + `getBoundingClientRect()` 来实现的。性能差不说，代码还丑。Intersection Observer API 的出现彻底改变了这个局面。

## 基本用法

Intersection Observer 可以异步监听目标元素与祖先元素（或视口）的交叉状态——进入视口、离开视口、交叉比例变化等。

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    console.log('目标元素:', entry.target)
    console.log('是否交叉:', entry.isIntersecting)
    console.log('交叉比例:', entry.intersectionRatio)
    console.log('交叉矩形:', entry.intersectionRect)
    console.log('根矩形:', entry.rootBounds)
    console.log('目标矩形:', entry.boundingClientRect)
    console.log('时间戳:', entry.time)
  })
}, {
  root: null,          // 默认为视口，也可以指定某个容器元素
  rootMargin: '0px',   // 根元素的外边距，类似 CSS margin
  threshold: 0         // 交叉比例阈值，可以是数组 [0, 0.25, 0.5, 0.75, 1]
})

// 开始观察
observer.observe(targetElement)

// 停止观察
observer.unobserve(targetElement)

// 销毁观察器
observer.disconnect()
```

## 实战一：图片懒加载

最经典的应用场景：

```html
<div class="image-list">
  <img data-src="https://cdn.example.com/photo1.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo2.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo3.jpg" class="lazy" />
  <!-- 更多图片 -->
</div>
```

```javascript
class LazyLoader {
  constructor(options = {}) {
    this.observer = null
    this.options = {
      rootMargin: options.rootMargin || '200px',  // 提前 200px 开始加载
      threshold: options.threshold || 0,
      placeholder: options.placeholder || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    }
  }

  observe(images) {
    // 先判断浏览器是否支持
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
      // 设置占位图
      if (!img.src) {
        img.src = this.options.placeholder
      }
      this.observer.observe(img)
    })
  }

  loadImage(img) {
    const src = img.dataset.src
    if (!src) return

    // 预加载
    const tempImg = new Image()
    tempImg.onload = () => {
      img.src = src
      img.classList.add('loaded')
    }
    tempImg.onerror = () => {
      img.classList.add('error')
      // 可以设置一个错误占位图
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

### Vue 组件封装

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
          // 进入视口，开始加载真实图片
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

## 实战二：无限滚动

```javascript
class InfiniteScroll {
  constructor({ container, loadMore, threshold = 200 }) {
    this.container = container
    this.loadMore = loadMore
    this.loading = false
    this.hasMore = true

    // 创建哨兵元素
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
      console.error('加载失败:', err)
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
      {loading && <div className="loading">加载中...</div>}
    </div>
  )
}
```

## 实战三：广告曝光统计

广告行业需要统计广告是否真正被用户看到（不仅仅是在 DOM 中，而是用户真的看到了）：

```javascript
class AdTracker {
  constructor() {
    // threshold: 0.5 表示广告至少 50% 可见才算"曝光"
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const adId = entry.target.dataset.adId
            this.trackImpression(adId)
            // 只统计一次，曝光后取消观察
            this.observer.unobserve(entry.target)
          }
        })
      },
      { threshold: [0.5] }  // 50% 可见时触发
    )
  }

  observe(adElement) {
    this.observer.observe(adElement)
  }

  trackImpression(adId) {
    // 上报曝光数据
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

**关键点：** 使用 `threshold: [0.5]` 确保广告至少 50% 可见才统计，避免用户快速滚动时误统计。用 `navigator.sendBeacon` 上报，即使页面关闭也能送达。

## 兼容性处理

截至 2019 年中，Intersection Observer 的浏览器支持情况：

| 浏览器 | 支持版本 |
|
--------|----------|
| Chrome | 51+ |
| Firefox | 55+ |
| Safari | 12.1+ |
| Edge | 15+ |
| IE | 不支持 |

对于不支持的浏览器，可以使用 W3C 官方 polyfill：

```bash
npm install intersection-observer
```

```javascript
// 在入口文件顶部引入
import 'intersection-observer'

// 或者按需加载
if (!('IntersectionObserver' in window)) {
  await import('intersection-observer')
}
```

也可以自己写一个降级方案：

```javascript
function createSafeObserver(callback, options) {
  if ('IntersectionObserver' in window) {
    return new IntersectionObserver(callback, options)
  }

  // 降级：用 scroll 事件模拟
  return {
    _targets: new Set(),
    observe(target) {
      this._targets.add(target)
      // 立即触发一次，认为元素可见
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

## 小结

- Intersection Observer 用异步回调替代 scroll + getBoundingClientRect，性能好得多
- 图片懒加载：`rootMargin` 提前加载，`unobserve` 加载后取消观察
- 无限滚动：用哨兵元素 + `isIntersecting` 判断是否需要加载更多
- 广告曝光：用 `threshold: [0.5]` 控制可见比例，`navigator.sendBeacon` 可靠上报
- 注意 `disconnect()` 清理观察器，避免内存泄漏
- IE 不支持，需要 polyfill 或降级方案
