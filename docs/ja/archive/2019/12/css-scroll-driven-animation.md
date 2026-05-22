---
title: "CSSスクロール駆動アニメーションの探索"
date: 2019-12-16 11:28:52
tags:
  - CSS
readingTime: 6
description: "スクロール駆動アニメーションは近年の Web アニメーション分野における重要な方向性です。CSS Scroll-linked Animations 仕様はまだ草案段階ですが、その概念は Intersection Observer API と scroll イベントを使用して本番環境で実装可能です。この記事では仕様草案から出発し、実際のケースを交えてスクロール駆動アニメーションの実装方法を探ります。"
wordCount: 737
---

スクロール駆動アニメーションは、近年の Web アニメーション分野における重要なトレンドです。CSS Scroll-linked Animations の仕様はまだ草案の段階ですが、そのアイデアは Intersection Observer API や scroll イベントを使って本番環境で実装することがすでに可能です。この記事では仕様草案を出発点としながら、実際のケースを交えてスクロール駆動アニメーションの実装方法を探っていきます。

## scroll-timeline 仕様草案

CSS Scroll-linked Animations 仕様では `scroll-timeline` と `animation-timeline` が定義されており、アニメーションを時間ではなくスクロール位置にバインドします：

```css
/* 規範草案の構文（ブラウザはまだネイティブ対応していない） */

/* スクロールベースのタイムラインを定義 */
@scroll-timeline scroll-timeline-1 {
  source: auto;       /* スクロールコンテナ、デフォルトは document */
  orientation: block; /* block = 垂直スクロール、inline = 水平スクロール */
  scroll-offsets: 0%, 100%; /* スクロール範囲 */
}

/* アニメーションを scroll-timeline にバインド */
.progress-bar {
  animation: grow-progress;
  animation-timeline: scroll-timeline-1;
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

ネイティブサポートはまだ先ですが、JavaScript で同じ効果を実現できます。以下に2つの主流な方法を紹介します。

## 方法1：Intersection Observer

Intersection Observer は要素がビューポートに入る/出るを効率的に検出でき、「スクロールインアニメーション」の実装に最適です：

```html
<!-- 典型的なシナリオ：要素がビューポートに入ったときに登場アニメーションを再生 -->
<div class="scroll-animate-section">
  <div class="animate-item" data-animate="fade-up">コンテンツ 1</div>
  <div class="animate-item" data-animate="fade-up">コンテンツ 2</div>
  <div class="animate-item" data-animate="fade-left">コンテンツ 3</div>
  <div class="animate-item" data-animate="fade-right">コンテンツ 4</div>
</div>
```

```css
/* 基本スタイル：アニメーション対象要素を非表示 */
.animate-item {
  opacity: 0;
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

/* 各種登場アニメーションの初期状態 */
.animate-item[data-animate="fade-up"] {
  transform: translateY(40px);
}

.animate-item[data-animate="fade-left"] {
  transform: translateX(-40px);
}

.animate-item[data-animate="fade-right"] {
  transform: translateX(40px);
}

/* アニメーション発動後の最終状態 */
.animate-item.is-visible {
  opacity: 1;
  transform: translate(0, 0);
}

/* インターレースアニメーション対応 */
.animate-item:nth-child(1) { transition-delay: 0ms; }
.animate-item:nth-child(2) { transition-delay: 100ms; }
.animate-item:nth-child(3) { transition-delay: 200ms; }
.animate-item:nth-child(4) { transition-delay: 300ms; }
```

```javascript
// Intersection Observer 実装
class ScrollAnimator {
  constructor(options = {}) {
    this.options = {
      threshold: options.threshold || 0.15,  // 要素が 15% ビューポートに入ったら発動
      rootMargin: options.rootMargin || '0px',
      once: options.once !== false,  // 一度だけ発動するかどうか
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

        // 一度だけの場合は監視を解除
        if (this.options.once) {
          this.observer.unobserve(entry.target)
        }
      } else if (!this.options.once) {
        // 繰り返し発動の場合は、ビューポートを離れたらクラスを削除
        entry.target.classList.remove('is-visible')
      }
    })
  }

  disconnect() {
    this.observer.disconnect()
  }
}

// 使用例
const animator = new ScrollAnimator({ threshold: 0.2 })
animator.observe('.animate-item')
```

## 方法2：スクロール位置ベースのプログレスアニメーション

プログレスバーやパララックススクロールなど、スクロール位置と正確にバインドする必要があるアニメーションでは、scroll イベントを監視します：

```css
/* 進捗バー */
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

/* パララックスコンテナ */
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
// requestAnimationFrame を使用してスクロールパフォーマンスを最適化
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

  // ページのスクロール進捗を取得 (0-1)
  getPageProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    return Math.min(scrollTop / scrollHeight, 1)
  }

  // 要素のビューポート内での可視比率を取得 (0-1)
  getElementVisibility(element) {
    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight

    if (rect.top >= windowHeight || rect.bottom <= 0) {
      return 0 // 完全に非表示
    }

    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0)
    return Math.min(visibleHeight / rect.height, 1)
  }

  // 要素のビューポートに対するスクロール進捗を取得
  // 要素の上部がビューポート下部に触れた = 0、要素の下部がビューポート上部に触れた = 1
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

// 使用例
const scrollProgress = new ScrollProgress()

// 読書進捗バー
const progressBar = document.querySelector('.reading-progress')
scrollProgress.addCallback((progress) => {
  progressBar.style.transform = `scaleX(${progress})`
})
```

## Reactでのラッピング

React プロジェクトでは、スクロールアニメーションを Hook としてカプセル化します：

```jsx
{% raw %}
import React, { useEffect, useRef, useState } from 'react'

// Hook：要素がビューポート内にあるか検出
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

// Hook：スクロール進捗を取得
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

// Hook：パララックススクロール効果
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

// 使用例
function BlogPost() {
  const progress = useScrollProgress()

  return (
    <div>
      {/* 読書進捗バー */}
      <div
        className="reading-progress"
        style={{ transform: `scaleX(${progress})` }}
      />

      <article>
        <h1>記事タイトル</h1>

        {/* スクロールインアニメーション */}
        <FadeInSection>
          <p>最初の段落...</p>
        </FadeInSection>

        {/* パララックス画像 */}
        <ParallaxImage
          src="/images/hero.jpg"
          speed={0.3}
        />

        <FadeInSection>
          <p>2番目の段落...</p>
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

## パフォーマンス上の注意点

スクロールイベントの処理を適切に行わないと、パフォーマンスに深刻な影響を与えます。以下に重要なポイントを示します：

```javascript
// 誤った方法：scroll イベント内で直接 DOM 操作を実行
window.addEventListener('scroll', () => {
  // スクロールごとに発火し、毎秒数十〜数百回の頻度になる
  document.querySelector('.progress').style.width = getProgress() + '%'
})

// 正しい方法 1：requestAnimationFrame によるスロットル
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

// 正しい方法 2：Intersection Observer で scroll 監視を代替
// Intersection Observer で解決できる場合は、scroll イベントを使わない

// 正しい方法 3：CSS プロパティ will-change でブラウザに最適化を指示
.animate-element {
  will-change: transform, opacity;
  /* ブラウザにこれらのプロパティが変更されることを伝え、事前に合成レイヤーを作成 */
}

// 正しい方法 4：CSS transform で top/left を代替
/* 誤り：layout と paint を誘発 */
.moving-element {
  top: 0;
  transition: top 0.3s;
}

/* 正しい：composite のみを誘発 */
.moving-element {
  transform: translateY(0);
  transition: transform 0.3s;
}
```

## まとめ

- CSS Scroll-linked Animations 仕様はまだ草案段階だが、先進的なコンセプトであり、引き続き注目に値する
- Intersection Observer は「スクロールインアニメーション」を実現する最適な方法で、scroll イベントよりもパフォーマンスが優れている
- スクロール位置ベースの進捗アニメーションには、scroll イベント + requestAnimationFrame スロットルが必要
- React では useInView、useScrollProgress、useParallax などの Hook としてカプセル化し、再利用性を高める
- パフォーマンスの鍵：passive イベントリスナー、requestAnimationFrame スロットル、transform での top/left 代替、will-change の指定
- Intersection Observer で解決できる場合は scroll イベントを使わず、CSS transform で実現できる場合は layout プロパティを使わない
