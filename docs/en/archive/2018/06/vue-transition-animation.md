---
title: "Vue Transitions and Animations in Practice"
date: 2018-06-21 10:55:46
tags:
  - Vue
readingTime: 1
description: "Vue's `<transition>` component makes adding animations straightforward. Here are some commonly used scenarios."
wordCount: 135
---

Vue's `<transition>` component makes adding animations straightforward. Here are some commonly used scenarios.

## Basic Usage

Wrap the element you want to animate with `<transition>`, and Vue will automatically add classes on enter/leave:

```html
<transition name="fade">
  <p v-if="show">Hello</p>
</transition>
```

```css
/* Final state for entering and leaving */
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

/* Initial state for entering / final state for leaving */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Transition animation config */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
```

Vue 2 class names are slightly different: `v-enter` (not `v-enter-from`). Vue 3 unified the naming.

```css
/* Vue 2 syntax */
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

## Common Animation Effects

```css
/* Slide in */
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

/* Scale */
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

## List Transitions

Use `<transition-group>` to animate a list:

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

/* Displacement animation for other items */
.list-move {
  transition: transform 0.3s;
}
```

## Using Third-Party Animation Library Animate.css

```html
<transition
  enter-active-class="animated fadeInDown"
  leave-active-class="animated fadeOutUp"
>
  <div v-if="show">Content</div>
</transition>
```

## Route Transition Animations

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

`mode="out-in"` ensures the old page leaves before the new one enters, preventing both pages from appearing at the same time.

## JavaScript Hooks

For fine-grained control, use JS hooks (combined with libraries like GSAP):

```html
<transition @enter="onEnter" @leave="onLeave" :css="false">
  <div v-if="show">Content</div>
</transition>
```

```javascript
methods: {
  onEnter(el, done) {
    // el is the entering DOM element; call done() when finished
    gsap.from(el, { duration: 0.4, opacity: 0, y: -20, onComplete: done })
  },
  onLeave(el, done) {
    gsap.to(el, { duration: 0.3, opacity: 0, y: 20, onComplete: done })
  }
}
```

## Summary

- `<transition name="xxx">` + CSS classes is the simplest approach
- `<transition-group>` handles lists; remember to add `:key` and `.xxx-move`
- `mode="out-in"` prevents the old and new pages from overlapping
- Use JS hooks + GSAP for complex animations
