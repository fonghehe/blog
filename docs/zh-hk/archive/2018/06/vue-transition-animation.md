---
title: "Vue 過渡與動畫實戰"
date: 2018-06-21 10:55:46
tags:
  - Vue
readingTime: 1
description: "Vue 的 `<transition>` 組件讓添加動畫變得很簡單。記錄幾個常用場景。"
---

Vue 的 `<transition>` 組件讓添加動畫變得很簡單。記錄幾個常用場景。

## 基礎用法

用 `<transition>` 包裹要添加動畫的元素，Vue 會在進入/離開時自動添加 class：

```html
<transition name="fade">
  <p v-if="show">Hello</p>
</transition>
```

```css
/* 進入和離開的最終狀態 */
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

/* 進入的初始狀態 / 離開的最終狀態 */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 過渡動畫的配置 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
```

Vue 2 的 class 名稍有不同：`v-enter`（不是 `v-enter-from`），Vue 3 統一了命名。

```css
/* Vue 2 寫法 */
.fade-enter {
  opacity: 0;
}
.fade-leave-to {
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
```

## 常用動畫效果

```css
/* 滑動進入 */
.slide-enter {
  transform: translateY(-20px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

/* 縮放 */
.scale-enter {
  transform: scale(0.9);
  opacity: 0;
}
.scale-leave-to {
  transform: scale(0.9);
  opacity: 0;
}
.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}
```

## 列表過渡

用 `<transition-group>` 給列表添加動畫：

```html
{% raw %}
<transition-group name="list" tag="ul">
  <li v-for="item in items" :key="item.id">{{ item.name }}</li>
</transition-group>
{% endraw %}
```

```css
.list-enter {
  opacity: 0;
  transform: translateX(-30px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.list-enter-active,
.list-leave-active {
  transition: all 0.3s;
}

/* 其他項的位移動畫 */
.list-move {
  transition: transform 0.3s;
}
```

## 結合第三方動畫庫 Animate.css

```html
<transition
  enter-active-class="animated fadeInDown"
  leave-active-class="animated fadeOutUp"
>
  <div v-if="show">內容</div>
</transition>
```

## 路由切換動畫

```html
<!-- App.vue -->
<transition name="page" mode="out-in">
  <router-view :key="$route.path" />
</transition>
```

```css
.page-enter {
  opacity: 0;
  transform: translateX(20px);
}
.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
.page-enter-active,
.page-leave-active {
  transition: all 0.25s ease;
}
```

`mode="out-in"` 確保舊頁面離開後新頁面才進入，避免兩個頁面同時出現。

## JavaScript 鈎子

需要精細控制時用 JS 鈎子（結合 GSAP 等庫）：

```html
<transition @enter="onEnter" @leave="onLeave" :css="false">
  <div v-if="show">內容</div>
</transition>
```

```javascript
methods: {
  onEnter(el, done) {
    // el 是要進入的 DOM 元素，完成後調用 done()
    gsap.from(el, { duration: 0.4, opacity: 0, y: -20, onComplete: done })
  },
  onLeave(el, done) {
    gsap.to(el, { duration: 0.3, opacity: 0, y: 20, onComplete: done })
  }
}
```

## 小結

- `<transition name="xxx">` + CSS 類是最簡單的方式
- `<transition-group>` 處理列表，記得加 `:key` 和 `.xxx-move`
- `mode="out-in"` 避免新舊頁面重疊
- 複雜動畫用 JS 鈎子 + GSAP
