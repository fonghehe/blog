---
title: "Exploring CSS Scroll-Driven Animations"
date: 2019-12-16 11:28:52
tags:
  - CSS
readingTime: 4
description: "Scroll-driven animation has become an important direction in web animation in recent years. Although the CSS Scroll-linked Animations spec is still a draft, its ideas can already be implemented in production via the Intersection Observer API and the scroll event. Starting from the draft spec and backed by real examples, this article explores how to achieve scroll-driven animation effects."
wordCount: 265
---

Scroll-driven animation has become an important direction in web animation in recent years. Although the CSS Scroll-linked Animations spec is still a draft, its ideas can already be implemented in production via the Intersection Observer API and the scroll event. Starting from the draft spec and backed by real examples, this article explores how to achieve scroll-driven animation effects.

## scroll-timeline Specification Draft

The CSS Scroll-linked Animations spec defines `scroll-timeline` and `animation-timeline`, binding an animation to scroll position rather than time:

```css
/* 规范草案语法（浏览器尚未原生支持） */

/* 定义一个基于滚动的 timeline */
@scroll-timeline scroll-timeline-1 {
  source: auto;       /* 滚动容器，默认为 document */
  orientation: block; /* block = 垂直滚动，inline = 水平滚动 */
  scroll-offsets: 0%, 100%; /* 滚动范围 */
}

/* 将动画绑定到 scroll-timeline */
.progress-bar {
  animation: grow-progress;
  animation-timeline: scroll-timeline-1;
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

Native support is still a long way off, but we can achieve the same effect with JavaScript. Here are two mainstream approaches.

## Option 1: Intersection Observer

Intersection Observer efficiently detects when an element enters or leaves the viewport, making it ideal for "scroll-in" animations:

```html
<!-- 典型场景：元素滚入视口时播放入场动画 -->
<div class="scroll-animate-section">
  <div class="animate-item" data-animate="fade-up">内容块 1</div>
  <div class="animate-item" data-animate="fade-up">内容块 2</div>
  <div class="animate-item" data-animate="fade-left">内容块 3</div>
  <div class="animate-item" data-animate="fade-right">内容块 4</div>
</div>
```

```css
/* 基础样式：隐藏待动画元素 */
.animate-item {
  opacity: 0;
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

/* 各种入场动画的初始状态 */
.animate-item[data-animate="fade-up"] {
  transform: translateY(40px);
}

.animate-item[data-animate="fade-left"] {
  transform: translateX(-40px);
}

.animate-item[data-animate="fade-right"] {
  transform: translateX(40px);
}

/* 动画触发后的最终状态 */
.animate-item.is-visible {
  opacity: 1;
  transform: translate(0, 0);
}

/* 支持交错动画 */
.animate-item:nth-child(1) { transition-delay: 0ms; }
.animate-item:nth-child(2) { transition-delay: 100ms; }
.animate-item:nth-child(3) { transition-delay: 200ms; }
.animate-item:nth-child(4) { transition-delay: 300ms; }
```

```javascript
// Intersection Observer 实现
class ScrollAnimator {
  constructor(options = {}) {
    this.options = {
      threshold: options.threshold || 0.15,  // 元素 15% 进入视口时触发
      rootMargin: options.rootMargin || '0px',
      once: options.once !== false,  // 是否只触发一次
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

        // 只触发一次时，取消观察
        if (this.options.once) {
          this.observer.unobserve(entry.target)
        }
      } else if (!this.options.once) {
        // 反复触发时，离开视口移除类
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

## Option 2: Scroll-Position Progress Animation

For progress bars, parallax scrolling, and other animations that must be precisely bound to scroll position, you need to listen to the scroll event:

```css
/* 进度条 */
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

/* 视差容器 */
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
// 使用 requestAnimationFrame 优化滚动性能
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

  // 获取页面滚动进度 (0-1)
  getPageProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    return Math.min(scrollTop / scrollHeight, 1)
  }

  // 获取元素在视口中的可见比例 (0-1)
  getElementVisibility(element) {
    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight

    if (rect.top >= windowHeight || rect.bottom <= 0) {
      return 0 // 完全不可见
    }

    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0)
    return Math.min(visibleHeight / rect.height, 1)
  }

  // 获取元素相对于视口的滚动进度
  // 元素顶部接触视口底部 = 0，元素底部接触视口顶部 = 1
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

// 阅读进度条
const progressBar = document.querySelector('.reading-progress')
scrollProgress.addCallback((progress) => {
  progressBar.style.transform = `scaleX(${progress})`
})
```

## Wrapping in React

In a React project, we wrap scroll animations into Hooks:

```jsx
{% raw %}
import React, { useEffect, useRef, useState } from 'react'

// Hook：检测元素是否在视口中
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

// Hook：获取滚动进度
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

// Hook：视差滚动效果
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
      {/* 阅读进度条 */}
      <div
        className="reading-progress"
        style={{ transform: `scaleX(${progress})` }}
      />

      <article>
        <h1>文章标题</h1>

        {/* 滚入动画 */}
        <FadeInSection>
          <p>第一段内容...</p>
        </FadeInSection>

        {/* 视差图片 */}
        <ParallaxImage
          src="/images/hero.jpg"
          speed={0.3}
        />

        <FadeInSection>
          <p>第二段内容...</p>
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

## Performance Considerations

Poorly handled scroll events can seriously hurt performance. Here are the key points:

```javascript
// 错误做法：直接在 scroll 事件中执行 DOM 操作
window.addEventListener('scroll', () => {
  // 每次 scroll 都触发，频率可达每秒几十上百次
  document.querySelector('.progress').style.width = getProgress() + '%'
})

// 正确做法 1：requestAnimationFrame 节流
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

// 正确做法 2：Intersection Observer 替代 scroll 监听
// 能用 Intersection Observer 解决的场景，就不要用 scroll 事件

// 正确做法 3：使用 CSS 属性 will-change 提示浏览器优化
.animate-element {
  will-change: transform, opacity;
  /* 告诉浏览器这两个属性会变化，提前创建合成层 */
}

// 正确做法 4：使用 CSS transform 代替 top/left
/* 错误：触发 layout 和 paint */
.moving-element {
  top: 0;
  transition: top 0.3s;
}

/* 正确：只触发 composite */
.moving-element {
  transform: translateY(0);
  transition: transform 0.3s;
}
```

## Summary

- The CSS Scroll-linked Animations spec is still a draft, but its ideas are advanced and worth following
- Intersection Observer is the best tool for "scroll-in" animations, outperforming the scroll event
- Scroll-position-based progress animations need the scroll event + requestAnimationFrame throttling
- In React, wrap them into Hooks like useInView, useScrollProgress, and useParallax for strong reusability
- Performance keys: passive event listeners, requestAnimationFrame throttling, transform instead of top/left, and will-change hints
- Prefer Intersection Observer over the scroll event when possible, and CSS transform over layout properties
