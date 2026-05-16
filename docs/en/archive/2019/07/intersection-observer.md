---
title: "Intersection Observer API in Practice"
date: 2019-07-16 17:28:35
tags:
  - Frontend
readingTime: 2
description: "Previously, implementing lazy image loading or infinite scroll typically relied on `scroll` events combined with `getBoundingClientRect()`. Not only was perform"
---

Previously, implementing lazy image loading or infinite scroll typically relied on `scroll` events combined with `getBoundingClientRect()`. Not only was performance poor, the code was messy too. The Intersection Observer API has completely changed this situation.

## Basic Usage

Intersection Observer can asynchronously watch the intersection state of a target element with an ancestor element (or the viewport) — entering the viewport, leaving the viewport, intersection ratio changes, etc.

```javascript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      console.log("Target element:", entry.target);
      console.log("Is intersecting:", entry.isIntersecting);
      console.log("Intersection ratio:", entry.intersectionRatio);
      console.log("Intersection rect:", entry.intersectionRect);
      console.log("Root bounds:", entry.rootBounds);
      console.log("Bounding client rect:", entry.boundingClientRect);
      console.log("Timestamp:", entry.time);
    });
  },
  {
    root: null, // defaults to viewport, can be a container element
    rootMargin: "0px", // margin around the root, like CSS margin
    threshold: 0, // ratio threshold, can be an array [0, 0.25, 0.5, 0.75, 1]
  },
);

// Start observing
observer.observe(targetElement);

// Stop observing
observer.unobserve(targetElement);

// Destroy observer
observer.disconnect();
```

## Practice 1: Lazy Image Loading

The most classic use case:

```html
<div class="image-list">
  <img data-src="https://cdn.example.com/photo1.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo2.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo3.jpg" class="lazy" />
</div>
```

```javascript
class LazyLoader {
  constructor(options = {}) {
    this.observer = null;
    this.options = {
      rootMargin: options.rootMargin || "200px", // start loading 200px early
      threshold: options.threshold || 0,
      placeholder:
        options.placeholder ||
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    };
  }

  observe(images) {
    if (!("IntersectionObserver" in window)) {
      this.loadAllImages(images);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      },
    );

    images.forEach((img) => {
      if (!img.src) {
        img.src = this.options.placeholder;
      }
      this.observer.observe(img);
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add("loaded");
    };
    tempImg.onerror = () => {
      img.classList.add("error");
    };
    tempImg.src = src;
  }

  loadAllImages(images) {
    images.forEach((img) => this.loadImage(img));
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Usage
const lazyLoader = new LazyLoader({ rootMargin: "300px" });
const images = document.querySelectorAll("img.lazy");
lazyLoader.observe(images);
```

### Vue Component Wrapper

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
    rootMargin: { type: String, default: "200px" },
  },
  data() {
    return {
      loaded: false,
      hasError: false,
      observer: null,
      placeholder:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    };
  },
  mounted() {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const img = this.$refs.img;
          const tempImg = new Image();
          tempImg.onload = () => {
            img.src = this.src;
          };
          tempImg.src = this.src;
          this.observer.unobserve(img);
        }
      },
      { rootMargin: this.rootMargin },
    );
    this.observer.observe(this.$refs.img);
  },
  beforeDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  methods: {
    onLoad() {
      this.loaded = true;
    },
    onError() {
      this.hasError = true;
    },
  },
};
</script>
```

## Practice 2: Infinite Scroll

```javascript
function setupInfiniteScroll(loadMore) {
  const sentinel = document.createElement("div");
  document.body.appendChild(sentinel);

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    },
    { rootMargin: "100px" },
  );

  observer.observe(sentinel);
  return observer;
}
```

## Practice 3: Scroll Animation Reveal

```javascript
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target); // animate only once
      }
    });
  },
  { threshold: 0.1 },
);

document.querySelectorAll(".reveal-on-scroll").forEach((el) => {
  revealObserver.observe(el);
});
```

## Summary

- Intersection Observer replaces scroll + getBoundingClientRect(), with better performance
- `rootMargin` enables "pre-loading" resources before they enter the viewport
- `threshold` controls the intersection percentage that triggers the callback
- `unobserve` after single-use actions to avoid memory leaks
