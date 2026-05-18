---
title: "Vue 过渡与动画实战"
date: 2018-06-21 10:55:46
tags:
  - Vue
readingTime: 1
description: "Vue 的 `<transition>` 组件让添加动画变得很简单。记录几个常用场景。"
---

Vue 的 `<transition>` 组件让添加动画变得很简单。记录几个常用场景。

## 基础用法

用 `<transition>` 包裹要添加动画的元素，Vue 会在进入/离开时自动添加 class：

```html
<transition name="fade">
  <p v-if="show">Hello</p>
</transition>
```

```css
/* 进入和离开的最终状态 */
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

/* 进入的初始状态 / 离开的最终状态 */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 过渡动画的配置 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
```

Vue 2 的 class 名稍有不同：`v-enter`（不是 `v-enter-from`），Vue 3 统一了命名。

```css
/* Vue 2 写法 */
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

## 常用动画效果

```css
/* 滑动进入 */
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

/* 缩放 */
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

## 列表过渡

用 `<transition-group>` 给列表添加动画：

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

/* 其他项的位移动画 */
.list-move {
  transition: transform 0.3s;
}
```

## 结合第三方动画库 Animate.css

```html
<transition
  enter-active-class="animated fadeInDown"
  leave-active-class="animated fadeOutUp"
>
  <div v-if="show">内容</div>
</transition>
```

## 路由切换动画

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

`mode="out-in"` 确保旧页面离开后新页面才进入，避免两个页面同时出现。

## JavaScript 钩子

需要精细控制时用 JS 钩子（结合 GSAP 等库）：

```html
<transition @enter="onEnter" @leave="onLeave" :css="false">
  <div v-if="show">内容</div>
</transition>
```

```javascript
methods: {
  onEnter(el, done) {
    // el 是要进入的 DOM 元素，完成后调用 done()
    gsap.from(el, { duration: 0.4, opacity: 0, y: -20, onComplete: done })
  },
  onLeave(el, done) {
    gsap.to(el, { duration: 0.3, opacity: 0, y: 20, onComplete: done })
  }
}
```

## 小结

- `<transition name="xxx">` + CSS 类是最简单的方式
- `<transition-group>` 处理列表，记得加 `:key` 和 `.xxx-move`
- `mode="out-in"` 避免新旧页面重叠
- 复杂动画用 JS 钩子 + GSAP
