---
title: "CSS 滾動驅動動畫探索"
date: 2019-12-16 11:28:52
tags:
  - CSS
readingTime: 5
description: "滾動驅動動畫是近年來 Web 動畫領域的一個重要方向。CSS Scroll-linked Animations 規範雖然還在草案階段，但它的理念已經可以通過 Intersection Observer API 和 scroll 事件在生產環境中實現。這篇文章從規範草案出發，結合實際案例，探討如何實現滾動驅動的動畫效果。"
---

滾動驅動動畫是近年來 Web 動畫領域的一個重要方向。CSS Scroll-linked Animations 規範雖然還在草案階段，但它的理念已經可以通過 Intersection Observer API 和 scroll 事件在生產環境中實現。這篇文章從規範草案出發，結合實際案例，探討如何實現滾動驅動的動畫效果。

## scroll-timeline 規範草案

CSS Scroll-linked Animations 規範定義了 `scroll-timeline` 和 `animation-timeline`，讓動畫與滾動位置綁定而非時間：

```css
/* 規範草案語法（瀏覽器尚未原生支持） */

/* 定義一個基於滾動的 timeline */
@scroll-timeline scroll-timeline-1 {
  source: auto;       /* 滾動容器，默認為 document */
  orientation: block; /* block = 垂直滾動，inline = 水平滾動 */
  scroll-offsets: 0%, 100%; /* 滾動範圍 */
}

/* 將動畫綁定到 scroll-timeline */
.progress-bar {
  animation: grow-progress;
  animation-timeline: scroll-timeline-1;
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

雖然原生支持還遠，但我們可以用 JavaScript 實現相同效果。以下是兩種主流方案。

## 方案一：Intersection Observer

Intersection Observer 可以高效檢測元素進入/離開視口，非常適合實現"滾入動畫"：

```html
<!-- 典型場景：元素滾入視口時播放入場動畫 -->
<div class="scroll-animate-section">
  <div class="animate-item" data-animate="fade-up">內容塊 1</div>
  <div class="animate-item" data-animate="fade-up">內容塊 2</div>
  <div class="animate-item" data-animate="fade-left">內容塊 3</div>
  <div class="animate-item" data-animate="fade-right">內容塊 4</div>
</div>
```

```css
/* 基礎樣式：隱藏待動畫元素 */
.animate-item {
  opacity: 0;
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

/* 各種入場動畫的初始狀態 */
.animate-item[data-animate="fade-up"] {
  transform: translateY(40px);
}

.animate-item[data-animate="fade-left"] {
  transform: translateX(-40px);
}

.animate-item[data-animate="fade-right"] {
  transform: translateX(40px);
}

/* 動畫觸發後的最終狀態 */
.animate-item.is-visible {
  opacity: 1;
  transform: translate(0, 0);
}

/* 支持交錯動畫 */
.animate-item:nth-child(1) { transition-delay: 0ms; }
.animate-item:nth-child(2) { transition-delay: 100ms; }
.animate-item:nth-child(3) { transition-delay: 200ms; }
.animate-item:nth-child(4) { transition-delay: 300ms; }
```

```javascript
// Intersection Observer 實現
class ScrollAnimator {
  constructor(options = {}) {
    this.options = {
      threshold: options.threshold || 0.15,  // 元素 15% 進入視口時觸發
      rootMargin: options.rootMargin || '0px',
      once: options.once !== false,  // 是否只觸發一次
      ...options
    }

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        threshold: this.options.threshold,
        rootMargin: this.options.rootMargin
      }
    )
  }

  observe(selector) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => this.observer.observe(el))
    return this
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')

        // 只觸發一次時，取消觀察
        if (this.options.once) {
          this.observer.unobserve(entry.target)
        }
      } else if (!this.options.once) {
        // 反覆觸發時，離開視口移除類
        entry.target.classList.remove('is-visible')
      }
    })
  }

  disconnect() {
    this.observer.disconnect()
  }
}

// 使用
const animator = new ScrollAnimator({ threshold: 0.2 })
animator.observe('.animate-item')
```

## 方案二：基於滾動位置的進度動畫

對於進度條、視差滾動等需要與滾動位置精確綁定的動畫，需要監聽 scroll 事件：

```css
/* 進度條 */
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: #1890ff;
  transform-origin: left;
  transform: scaleX(0);
  z-index: 1000;
  will-change: transform;
}

/* 視差容器 */
.parallax-container {
  position: relative;
  height: 100vh;
  overflow: hidden;
}

.parallax-bg {
  position: absolute;
  top: -20%;
  left: 0;
  width: 100%;
  height: 140%;
  background-size: cover;
  background-position: center;
  will-change: transform;
}
```

```javascript
// 使用 requestAnimationFrame 優化滾動性能
class ScrollProgress {
  constructor() {
    this.ticking = false
    this.callbacks = []

    window.addEventListener('scroll', () => {
      if (!this.ticking) {
        requestAnimationFrame(() => {
          this.update()
          this.ticking = false
        })
        this.ticking = true
      }
    }, { passive: true })
  }

  // 獲取頁面滾動進度 (0-1)
  getPageProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    return Math.min(scrollTop / scrollHeight, 1)
  }

  // 獲取元素在視口中的可見比例 (0-1)
  getElementVisibility(element) {
    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight

    if (rect.top >= windowHeight || rect.bottom <= 0) {
      return 0 // 完全不可見
    }

    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0)
    return Math.min(visibleHeight / rect.height, 1)
  }

  // 獲取元素相對於視口的滾動進度
  // 元素頂部接觸視口底部 = 0，元素底部接觸視口頂部 = 1
  getElementProgress(element) {
    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight
    const totalDistance = rect.height + windowHeight
    const traveled = windowHeight - rect.top
    return Math.max(0, Math.min(traveled / totalDistance, 1))
  }

  addCallback(fn) {
    this.callbacks.push(fn)
    return this
  }

  update() {
    const pageProgress = this.getPageProgress()
    this.callbacks.forEach(fn => fn(pageProgress))
  }
}

// 使用
const scrollProgress = new ScrollProgress()

// 閲讀進度條
const progressBar = document.querySelector('.reading-progress')
scrollProgress.addCallback((progress) => {
  progressBar.style.transform = `scaleX(${progress})`
})
```

## React 中的封裝

在 React 項目中，我們將滾動動畫封裝為 Hook：

```jsx
{% raw %}
import React, { useEffect, useRef, useState } from 'react'

// Hook：檢測元素是否在視口中
function useInView(options = {}) {
  const ref = useRef(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting)

      if (entry.isIntersecting && options.once) {
        observer.unobserve(element)
      }
    }, {
      threshold: options.threshold || 0.1,
      rootMargin: options.rootMargin || '0px'
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [options.threshold, options.rootMargin, options.once])

  return [ref, isInView]
}

// Hook：獲取滾動進度
function useScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false

    function handleScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.pageYOffset
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
          setProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return progress
}

// Hook：視差滾動效果
function useParallax(speed = 0.5) {
  const ref = useRef(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let ticking = false

    function handleScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect()
            const scrolled = window.innerHeight - rect.top
            setOffset(scrolled * speed)
          }
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed])

  return [ref, offset]
}

// 使用示例
function BlogPost() {
  const progress = useScrollProgress()

  return (
    <div>
      {/* 閲讀進度條 */}
      <div
        className="reading-progress"
        style={{ transform: `scaleX(${progress})` }}
      />

      <article>
        <h1>文章標題</h1>

        {/* 滾入動畫 */}
        <FadeInSection>
          <p>第一段內容...</p>
        </FadeInSection>

        {/* 視差圖片 */}
        <ParallaxImage
          src="/images/hero.jpg"
          speed={0.3}
        />

        <FadeInSection>
          <p>第二段內容...</p>
        </FadeInSection>
      </article>
    </div>
  )
}

function FadeInSection({ children }) {
  const [ref, isInView] = useInView({ once: true, threshold: 0.15 })

  return (
    <div
      ref={ref}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
      }}
    >
      {children}
    </div>
  )
}

function ParallaxImage({ src, speed = 0.3 }) {
  const [ref, offset] = useParallax(speed)

  return (
    <div
      ref={ref}
      style={{
        height: '400px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          position: 'absolute',
          top: `-${offset}px`,
          width: '100%',
          height: '120%',
          objectFit: 'cover'
        }}
      />
    </div>
  )
}
{% endraw %}
```

## 性能注意事項

滾動事件處理不當會嚴重影響性能，以下是關鍵要點：

```javascript
// 錯誤做法：直接在 scroll 事件中執行 DOM 操作
window.addEventListener('scroll', () => {
  // 每次 scroll 都觸發，頻率可達每秒幾十上百次
  document.querySelector('.progress').style.width = getProgress() + '%'
})

// 正確做法 1：requestAnimationFrame 節流
let ticking = false
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateProgress()
      ticking = false
    })
    ticking = true
  }
}, { passive: true })

// 正確做法 2：Intersection Observer 替代 scroll 監聽
// 能用 Intersection Observer 解決的場景，就不要用 scroll 事件

// 正確做法 3：使用 CSS 屬性 will-change 提示瀏覽器優化
.animate-element {
  will-change: transform, opacity;
  /* 告訴瀏覽器這兩個屬性會變化，提前創建合成層 */
}

// 正確做法 4：使用 CSS transform 代替 top/left
/* 錯誤：觸發 layout 和 paint */
.moving-element {
  top: 0;
  transition: top 0.3s;
}

/* 正確：只觸發 composite */
.moving-element {
  transform: translateY(0);
  transition: transform 0.3s;
}
```

## 小結

- CSS Scroll-linked Animations 規範還在草案階段，但理念先進，值得持續關注
- Intersection Observer 是實現"滾入動畫"的最佳方案，性能優於 scroll 事件
- 基於滾動位置的進度動畫需要 scroll 事件 + requestAnimationFrame 節流
- React 中封裝為 useInView、useScrollProgress、useParallax 等 Hook，複用性好
- 性能關鍵：passive 事件監聽、requestAnimationFrame 節流、transform 代替 top/left、will-change 提示
- 能用 Intersection Observer 解決的就不用 scroll 事件，能用 CSS transform 的就不用 layout 屬性
